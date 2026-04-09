import subprocess
import threading
import socket
import time
import os
import csv
from datetime import datetime

# ── Ayarlar ──────────────────────────────────────────────────────────────────
PI_IP       = "10.50.21.183"
VIDEO_PORT  = 5000
AUDIO_PORT  = 5002
ECHO_PORT   = 5005

ITERATIONS  = 3
DURATION_S  = 180
REST_S      = 30
LATENCY_CSV = "latency_log.csv"

# gst-launch-1.0.exe tam yolu (PATH'te varsa sadece "gst-launch-1.0.exe" yeter)
GST         = "gst-launch-1.0.exe"
# ─────────────────────────────────────────────────────────────────────────────


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ── RTT Olcumu ───────────────────────────────────────────────────────────────

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


# ── GStreamer Komutlari ───────────────────────────────────────────────────────

def build_gst_silent(pi_ip):
    return (
        f'{GST} -e '
        f'd3d11screencapturesrc ! videoconvert '
        f'! video/x-raw,format=I420,framerate=30/1 '
        f'! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 '
        f'! rtph264pay config-interval=1 pt=96 '
        f'! udpsink host={pi_ip} port={VIDEO_PORT}'
    )


def build_gst_audio(pi_ip):
    return (
        f'{GST} -e '
        f'd3d11screencapturesrc ! videoconvert '
        f'! video/x-raw,format=I420,framerate=30/1 '
        f'! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=30 '
        f'! rtph264pay config-interval=1 pt=96 '
        f'! udpsink host={pi_ip} port={VIDEO_PORT} '
        f'wasapisrc loopback=true '
        f'! audioconvert '
        f'! opusenc '
        f'! rtpopuspay pt=96 '
        f'! udpsink host={pi_ip} port={AUDIO_PORT}'
    )


# ── Tur Mantigi ──────────────────────────────────────────────────────────────

def run_iteration(mode, iteration):
    log(f">> [{mode.upper()}] Tur {iteration}/{ITERATIONS} basliyor...")

    gst_cmd = build_gst_silent(PI_IP) if mode == "silent" else build_gst_audio(PI_IP)

    collector = LatencyCollector(
        pi_ip=PI_IP, echo_port=ECHO_PORT,
        csv_path=LATENCY_CSV, mode=mode, iteration=iteration
    )
    rtt_thread = threading.Thread(target=collector.run, daemon=True)
    rtt_thread.start()

    gst_cmd_str = gst_cmd
    log(f"GST komutu: {gst_cmd_str[:80]}...")
    gst_proc = subprocess.Popen(gst_cmd_str, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    time.sleep(DURATION_S)

    collector.stop()
    gst_proc.terminate()
    try:
        gst_proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        gst_proc.kill()

    log(f"OK [{mode.upper()}] Tur {iteration} tamamlandi.")


def run_phase(mode):
    log(f"=== FAZ: {mode.upper()} ({ITERATIONS} tur x {DURATION_S}s) ===")
    for i in range(1, ITERATIONS + 1):
        run_iteration(mode, i)
        if i < ITERATIONS:
            log(f"   {REST_S}s bekleniyor...")
            time.sleep(REST_S)
    log(f"=== FAZ BITTI: {mode.upper()} ===")


def main():
    log("UniCast Windows Orchestrator baslatildi.")
    log(f"Hedef Pi: {PI_IP} | {ITERATIONS} tur x {DURATION_S}s (sessiz + sesli)")
    log(f"Tahmini toplam sure: ~{int((ITERATIONS * 2 * (DURATION_S + REST_S)) / 60)} dakika")

    if os.path.exists(LATENCY_CSV):
        backup = LATENCY_CSV.replace(".csv", f"_backup_{int(time.time())}.csv")
        os.rename(LATENCY_CSV, backup)
        log(f"Eski CSV yedeklendi: {backup}")

    start = time.time()

    run_phase("silent")

    log("Sesli faza gecmeden once 60s bekleme...")
    time.sleep(60)

    run_phase("audio")

    elapsed = int(time.time() - start)
    log(f"Tamamlandi! Sure: {elapsed // 60}dk {elapsed % 60}s")
    log(f"Latency dosyasi: {os.path.abspath(LATENCY_CSV)}")
    log("Pi'den benchmark_log.csv'yi al, ayni klasore koy, report_generator.py'yi calistir.")


if __name__ == "__main__":
    main()