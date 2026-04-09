"""
win_orchestrator.py
===================
Windows PC tarafı otomasyon betiği.
- Pi'ye önce 30 tur sessiz yayın gönderir + eş zamanlı RTT ölçer
- Sonra 30 tur sesli yayın gönderir + RTT ölçer

Kullanım:
    python win_orchestrator.py

Gereksinimler:
    - gst-launch-1.0 PATH'te olmalı (GStreamer Windows kurulumu)
    - pip install pandas
"""

import subprocess
import threading
import socket
import time
import sys
import os
import csv
import pandas as pd
from datetime import datetime

# ── Ayarlar ───────────────────────────────────────────────────────────────────
PI_IP         = "10.50.21.183"
VIDEO_PORT    = 5000
AUDIO_PORT    = 5002
ECHO_PORT     = 5005          # RTT echo servisi portu (agent.py karşılıyor)

ITERATIONS    = 30            # Her mod için tur sayısı
DURATION_S    = 300           # Her turun süresi (saniye) – 5 dakika
REST_S        = 30            # Turlar arası dinlenme
LATENCY_CSV   = "latency_log.csv"

# GStreamer: video kaynağını ayarla
# Eğer webcam veya dosya kullanıyorsan burayı değiştir
# Örnek: dosya → "filesrc location=test.mp4 ! decodebin"
# Örnek: test pattern → "videotestsrc"
VIDEO_SOURCE  = "videotestsrc"   # varsayılan: test pattern
AUDIO_SOURCE  = "audiotestsrc"   # varsayılan: test tone
# ──────────────────────────────────────────────────────────────────────────────


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# ── RTT Ölçümü ────────────────────────────────────────────────────────────────

class LatencyCollector:
    def __init__(self, pi_ip: str, echo_port: int, csv_path: str, mode: str, iteration: int):
        self.pi_ip     = pi_ip
        self.echo_port = echo_port
        self.csv_path  = csv_path
        self.mode      = mode
        self.iteration = iteration
        self.running   = False
        self.sock      = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(1.0)

    def measure_once(self) -> float | None:
        t0 = time.perf_counter()
        try:
            self.sock.sendto(f"PING:{t0}".encode(), (self.pi_ip, self.echo_port))
            self.sock.recvfrom(1024)
            rtt = (time.perf_counter() - t0) * 1000
            return rtt
        except socket.timeout:
            return None

    def _append_csv(self, rtt_ms: float):
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


# ── GStreamer Komutları ────────────────────────────────────────────────────────

def build_gst_silent(pi_ip: str) -> list[str]:
    """Video-only (sessiz) yayın komutu."""
    return [
        "gst-launch-1.0", "-e",
        VIDEO_SOURCE,
        "!", "video/x-raw,framerate=30/1,width=1920,height=1080",
        "!", "videoconvert",
        "!", "x264enc", "tune=zerolatency", "bitrate=4000", "speed-preset=ultrafast",
        "!", "rtph264pay", "config-interval=1", "pt=96",
        "!", f"udpsink host={pi_ip} port={VIDEO_PORT}"
    ]


def build_gst_audio(pi_ip: str) -> list[str]:
    """Video + Audio yayın komutu."""
    return [
        "gst-launch-1.0", "-e",
        # Video branch
        VIDEO_SOURCE,
        "!", "video/x-raw,framerate=30/1,width=1920,height=1080",
        "!", "videoconvert",
        "!", "x264enc", "tune=zerolatency", "bitrate=4000", "speed-preset=ultrafast",
        "!", "rtph264pay", "config-interval=1", "pt=96",
        "!", f"udpsink host={pi_ip} port={VIDEO_PORT}",
        # Audio branch
        AUDIO_SOURCE,
        "!", "audioconvert",
        "!", "opusenc",
        "!", "rtpopuspay", "pt=96",
        "!", f"udpsink host={pi_ip} port={AUDIO_PORT}"
    ]


# ── Tur Mantığı ───────────────────────────────────────────────────────────────

def run_iteration(mode: str, iteration: int):
    log(f"▶  [{mode.upper()}] Tur {iteration}/{ITERATIONS} başlıyor...")

    if mode == "silent":
        gst_cmd = build_gst_silent(PI_IP)
    else:
        gst_cmd = build_gst_audio(PI_IP)

    # RTT toplayıcıyı ayrı thread'de başlat
    collector = LatencyCollector(
        pi_ip=PI_IP, echo_port=ECHO_PORT,
        csv_path=LATENCY_CSV, mode=mode, iteration=iteration
    )
    rtt_thread = threading.Thread(target=collector.run, daemon=True)
    rtt_thread.start()

    # GStreamer yayını başlat
    gst_proc = subprocess.Popen(
        gst_cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT
    )

    # DURATION_S kadar bekle
    time.sleep(DURATION_S)

    # Temizle
    collector.stop()
    gst_proc.terminate()
    try:
        gst_proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        gst_proc.kill()

    log(f"✓  [{mode.upper()}] Tur {iteration} tamamlandı.")


def run_phase(mode: str):
    log(f"═══ FAZ BAŞLIYOR: {mode.upper()} ({ITERATIONS} tur × {DURATION_S}s) ═══")
    for i in range(1, ITERATIONS + 1):
        run_iteration(mode, i)
        if i < ITERATIONS:
            log(f"   {REST_S}s dinleniyor...")
            time.sleep(REST_S)
    log(f"═══ FAZ BİTTİ: {mode.upper()} ═══\n")


def main():
    log("UniCast Windows Orchestrator başlatıldı.")
    log(f"Hedef Pi: {PI_IP}  |  {ITERATIONS} tur × {DURATION_S}s (sessiz + sesli)")
    log(f"Tahmini toplam süre: ~{int((ITERATIONS * 2 * (DURATION_S + REST_S)) / 60)} dakika\n")

    # Eski latency CSV'yi temizle
    if os.path.exists(LATENCY_CSV):
        backup = LATENCY_CSV.replace(".csv", f"_backup_{int(time.time())}.csv")
        os.rename(LATENCY_CSV, backup)
        log(f"Eski latency CSV yedeklendi: {backup}")

    start_total = time.time()

    run_phase("silent")

    log("SESLİ faza geçmeden önce 60s ek bekleme...")
    time.sleep(60)

    run_phase("audio")

    elapsed = int(time.time() - start_total)
    log(f"Tüm testler tamamlandı! Toplam süre: {elapsed // 60}dk {elapsed % 60}s")
    log(f"Latency dosyası: {os.path.abspath(LATENCY_CSV)}")
    log("Pi'den benchmark_log.csv'yi al, aynı klasöre koy, report_generator.py'yi çalıştır.")


if __name__ == "__main__":
    main()
