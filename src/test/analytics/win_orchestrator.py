import subprocess
import signal
import threading
import socket
import time
import os
import csv
import json
from datetime import datetime

# --- Yapilandirma Yukleme ---
CONFIG_FILE = "benchmark_config.json"
STATE_FILE  = "benchmark_state.json"

def load_json(path):
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

# --- RTT Olcumu ---

class LatencyCollector:
    def __init__(self, pi_ip, echo_port, csv_path, mode, iteration):
        self.pi_ip     = pi_ip
        self.echo_port = echo_port
        self.csv_path  = csv_path
        self.mode      = mode
        self.iteration = iteration
        self.running   = False
        self.sock      = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(1.0)

    def measure_once(self):
        t0 = time.perf_counter()
        try:
            self.sock.sendto(f"PING:{t0}".encode(), (self.pi_ip, self.echo_port))
            self.sock.recvfrom(1024)
            return (time.perf_counter() - t0) * 1000
        except socket.timeout:
            return None
        except ConnectionResetError:
            # Windows'ta port acik degilse bu hatayi firlatir
            return None

    def _append_csv(self, rtt_ms):
        row = {
            "Timestamp": datetime.now().strftime("%H:%M:%S"),
            "Mode":      self.mode,
            "Iteration": self.iteration,
            "RTT_ms":    round(rtt_ms, 3)
        }
        file_exists = os.path.exists(self.csv_path)
        with open(self.csv_path, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=row.keys())
            if not file_exists:
                writer.writeheader()
            writer.writerow(row)

    def run(self):
        self.running = True
        while self.running:
            rtt = self.measure_once()
            if rtt is not None:
                self._append_csv(rtt)
            time.sleep(1.0)
        self.sock.close()

    def stop(self):
        self.running = False


# --- GStreamer Komutlari ---

def build_gst_silent(pi_ip, video_port):
    return (
        f'gst-launch-1.0.exe -e '
        f'd3d11screencapturesrc ! queue max-size-buffers=2 ! videoconvert '
        f'! video/x-raw,format=I420,framerate=30/1 '
        # threads=4 eklendi, CPU videoyu daha hızlı işlesin
        f'! x264enc tune=zerolatency bitrate=4000 speed-preset=superfast key-int-max=30 threads=4 '
        f'! rtph264pay config-interval=1 pt=96 '
        # udpsink öncesi queue ve senkronizasyon iptalleri
        f'! queue ! udpsink host={pi_ip} port={video_port} sync=false async=false buffer-size=212992'
    )

def build_gst_audio(pi_ip, video_port, audio_port):
    return (
        f'gst-launch-1.0.exe -e '
        # --- VIDEO DALI ---
        f'd3d11screencapturesrc ! queue max-size-buffers=2 ! videoconvert '
        f'! video/x-raw,format=I420,framerate=30/1 '
        f'! x264enc tune=zerolatency bitrate=4000 speed-preset=superfast key-int-max=30 threads=4 '
        f'! rtph264pay config-interval=1 pt=96 '
        f'! queue ! udpsink host={pi_ip} port={video_port} sync=false async=false buffer-size=212992 '
        # --- SES DALI ---
        f'wasapisrc loopback=true ! queue ! audioconvert '
        f'! opusenc bitrate=128000 '
        f'! rtpopuspay pt=96 '
        f'! queue ! udpsink host={pi_ip} port={audio_port} sync=false async=false buffer-size=212992'
    )

# --- Process Yonetimi ---

def _force_kill_gst(proc):
    """GStreamer process'ini Windows'ta kesin olarak oldurur."""
    try:
        proc.kill()
        proc.wait(timeout=3)
    except Exception:
        pass
    # Fallback: taskkill ile process agacini tamamen oldur
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True, timeout=5
        )
    except Exception:
        pass

# --- Ana Mantik ---

def main():
    config = load_json(CONFIG_FILE)
    state  = load_json(STATE_FILE)

    if not config or not state:
        log("HATA: Config veya State dosyasi bulunamadi!")
        return

    if state.get("is_finished"):
        log("Test zaten tamamlanmis. Sifirlamak icin benchmark_state.json'i silin veya guncelleyin.")
        return

    phase_index = state["current_phase_index"]
    iteration   = state["current_iteration"]
    mode        = config["phases"][phase_index]
    
    log(f">>> [ONE-SHOT] {mode.upper()} Fazi | Tur {iteration}/{config['iterations']}")
    
    # Latency CSV baslat (Sadece 1. tur ise ve dosya yoksa)
    latency_csv = "latency_log.csv"
    if phase_index == 0 and iteration == 1 and os.path.exists(latency_csv):
        backup = f"latency_log_backup_{int(time.time())}.csv"
        os.rename(latency_csv, backup)
        log(f"Eski log yedeklendi: {backup}")

    # GStreamer Hazirla
    if mode == "silent":
        cmd = build_gst_silent(config["pi_ip"], config["video_port"])
    else:
        cmd = build_gst_audio(config["pi_ip"], config["video_port"], config["audio_port"])

    # Latency Olcumunu Baslat
    collector = LatencyCollector(
        pi_ip=config["pi_ip"], 
        echo_port=config["echo_port"],
        csv_path=latency_csv, 
        mode=mode, 
        iteration=iteration
    )
    rtt_thread = threading.Thread(target=collector.run, daemon=True)
    rtt_thread.start()

    # GStreamer Calistir
    log(f"GST Baslatiliyor ({config['duration_s']}s)...")
    # shell=True yerine dogrudan calistir: terminate()/kill() gercek process'e gitsin
    gst_proc = subprocess.Popen(
        cmd.split(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )

    try:
        time.sleep(config["duration_s"])
    except KeyboardInterrupt:
        log("Kullanici tarafindan durduruldu.")
        state["is_finished"] = True
        save_json(STATE_FILE, state)
        _force_kill_gst(gst_proc)
        return

    # Kapatma
    collector.stop()
    _force_kill_gst(gst_proc)

    log(f"OK >> {mode.upper()} Tur {iteration} tamamlandi.")

    # Durumu Guncelle
    iteration += 1
    if iteration > config["iterations"]:
        iteration = 1
        phase_index += 1
    
    if phase_index >= len(config["phases"]):
        state["is_finished"] = True
        log("TEBRIKLER: Tum testler tamamlandi!")
    else:
        state["current_phase_index"] = phase_index
        state["current_iteration"]   = iteration

    save_json(STATE_FILE, state)

if __name__ == "__main__":
    main()