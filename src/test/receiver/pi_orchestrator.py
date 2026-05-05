# -*- coding: utf-8 -*-
"""
UniCast Pi Benchmark Orchestrator - TCP Command Server
======================================================
Windows (master) TCP komutlarıyla kontrol eder.
Protokol:
  PREPARE:<mode>:<iteration>  →  READY / ERROR:<msg>
  STOP                        →  DONE
  FINISH                      →  (temiz kapanış)
"""

import subprocess
import socket
import time
import sys
import os
import io
import json
import signal
import threading
from datetime import datetime

# Terminali UTF-8'e zorla
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# --- Yapilandirma ---
CONFIG_FILE = "benchmark_config.json"

def load_json(path):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


class PiOrchestrator:
    def __init__(self, config):
        self.config = config
        self.control_port = config.get("control_port", 5010)
        self.video_port   = config.get("video_port", 5000)
        self.audio_port   = config.get("audio_port", 5002)
        self.echo_port    = config.get("echo_port", 5005)
        self.agent_proc   = None
        self.running       = True

        # Kernel UDP buffer optimizasyonu (bir kez)
        try:
            subprocess.run(["sudo", "sysctl", "-w", "net.core.rmem_max=26214400"],
                           capture_output=True)
            log("Kernel UDP buffer optimize edildi.")
        except:
            pass

    def _kill_old_processes(self):
        """Eski GStreamer ve agent process'lerini temizle."""
        try:
            subprocess.run(["pkill", "-9", "-f", "gst-launch"], capture_output=True)
        except:
            pass
        try:
            ports = [str(self.video_port), str(self.audio_port), str(self.echo_port)]
            subprocess.run(["sudo", "fuser", "-k"] + [p + "/udp" for p in ports],
                           capture_output=True)
        except:
            pass

    def _spawn_agent(self, mode, iteration):
        """agent.py'yi subprocess olarak başlat."""
        self._kill_old_processes()
        time.sleep(0.5)  # Port temizliği için kısa bekleme

        agent_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.py")
        cmd = [
            sys.executable, agent_script,
            "--mode",          mode,
            "--benchmark-csv", "benchmark_log.csv",
            "--iteration",     str(iteration),
            "--video-port",    str(self.video_port),
            "--audio-port",    str(self.audio_port),
            "--echo-port",     str(self.echo_port)
        ]

        log(f"Agent baslatiliyor: {mode} (Tur {iteration})")
        self.agent_proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace"
        )

        # Agent stdout'u ayrı thread'de oku (block olmasın)
        self._agent_reader_thread = threading.Thread(
            target=self._read_agent_output, daemon=True
        )
        self._agent_reader_thread.start()

        # Agent'ın başlaması için kısa bekleme
        time.sleep(2.0)

        # Agent hâlâ çalışıyor mu kontrol et
        if self.agent_proc.poll() is not None:
            return False
        return True

    def _read_agent_output(self):
        """Agent stdout'u okuyup terminale yazdır (non-blocking)."""
        try:
            for line in self.agent_proc.stdout:
                if line:
                    print(f"  [agent] {line.rstrip()}", flush=True)
        except:
            pass

    def _stop_agent(self):
        """Çalışan agent'ı durdur."""
        if self.agent_proc and self.agent_proc.poll() is None:
            self.agent_proc.terminate()
            try:
                self.agent_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.agent_proc.kill()
                self.agent_proc.wait(timeout=3)
            log("Agent durduruldu.")
        self.agent_proc = None

    def _send_response(self, conn, msg):
        """TCP üzerinden yanıt gönder."""
        try:
            conn.sendall((msg + "\n").encode("utf-8"))
        except Exception as e:
            log(f"Yanit gonderme hatasi: {e}")

    def _recv_command(self, conn, timeout=300):
        """TCP üzerinden komut al (satır bazlı)."""
        conn.settimeout(timeout)
        buffer = ""
        try:
            while True:
                data = conn.recv(4096)
                if not data:
                    return None
                buffer += data.decode("utf-8")
                if "\n" in buffer:
                    cmd = buffer.split("\n")[0].strip()
                    return cmd
        except socket.timeout:
            log("Komut bekleme zaman asimi!")
            return None
        except Exception as e:
            log(f"Komut alma hatasi: {e}")
            return None

    def run(self):
        """Ana TCP sunucu döngüsü."""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("0.0.0.0", self.control_port))
        server.listen(1)
        server.settimeout(5.0)  # accept timeout (Ctrl+C kontrolü için)

        log(f"=== UniCast Pi Orchestrator ===")
        log(f"TCP kontrol sunucusu port {self.control_port}'da dinliyor...")
        log(f"Windows'tan baglanti bekleniyor...")

        try:
            while self.running:
                # Bağlantı kabul et
                try:
                    conn, addr = server.accept()
                except socket.timeout:
                    continue

                log(f"Baglanti kabul edildi: {addr}")
                self._handle_connection(conn)
                conn.close()
                log(f"Baglanti kapatildi: {addr}")

                if not self.running:
                    break

        except KeyboardInterrupt:
            log("Kullanici tarafindan durduruldu.")
        finally:
            self._stop_agent()
            server.close()
            log("Sunucu kapatildi.")

    def _handle_connection(self, conn):
        """Tek bir TCP bağlantısı boyunca komutları işle."""
        while self.running:
            cmd = self._recv_command(conn, timeout=600)  # 10dk timeout (maraton için)
            if cmd is None:
                log("Baglanti koptu veya zaman asimi.")
                self._stop_agent()
                break

            log(f"Komut alindi: {cmd}")

            if cmd.startswith("PREPARE:"):
                # Format: PREPARE:<mode>:<iteration>
                parts = cmd.split(":")
                if len(parts) >= 3:
                    mode = parts[1]
                    iteration = parts[2]
                    log(f">>> [SENARYO] {mode} | Tur {iteration}")

                    success = self._spawn_agent(mode, int(iteration))
                    if success:
                        self._send_response(conn, "READY")
                        log("READY yaniti gonderildi. Yayin bekleniyor...")
                    else:
                        self._send_response(conn, "ERROR:Agent baslatilamadi")
                        log("HATA: Agent baslatilamadi!")
                else:
                    self._send_response(conn, "ERROR:Gecersiz PREPARE formati")

            elif cmd == "STOP":
                self._stop_agent()
                self._send_response(conn, "DONE")
                log("DONE yaniti gonderildi.")

            elif cmd == "FINISH":
                log("FINISH komutu alindi. Tum testler tamamlandi!")
                self._stop_agent()
                self._send_response(conn, "BYE")
                self.running = False
                break

            else:
                log(f"Bilinmeyen komut: {cmd}")
                self._send_response(conn, f"ERROR:Bilinmeyen komut: {cmd}")


def main():
    config = load_json(CONFIG_FILE)
    if not config:
        log("HATA: benchmark_config.json bulunamadi!")
        return

    orchestrator = PiOrchestrator(config)
    orchestrator.run()


if __name__ == "__main__":
    main()