"""
pi_orchestrator.py
==================
Raspberry Pi tarafı otomasyon betiği.
- 30 tur sessiz (video only) test
- 30 sn mola
- 30 tur sesli (audio + video) test
Her tur 5 dakika (300 saniye) çalışır, 30 saniye dinlenir.

Kullanım:
    python pi_orchestrator.py
"""

import subprocess
import time
import sys
import os
import csv
from datetime import datetime

# ── Ayarlar ───────────────────────────────────────────────────────────────────
ITERATIONS       = 30          # Her mod için tur sayısı
DURATION_S       = 300         # Her turun süresi (saniye) – 5 dakika
REST_S           = 30          # Turlar arası dinlenme süresi (saniye)
BENCHMARK_CSV    = "benchmark_log.csv"
AGENT_SCRIPT     = os.path.join(os.path.dirname(__file__), "agent.py")
PYTHON           = sys.executable
# ──────────────────────────────────────────────────────────────────────────────


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run_iteration(mode: str, iteration: int):
    """agent.py'yi subprocess olarak başlatır, DURATION_S sonra öldürür."""
    log(f"▶  [{mode.upper()}] Tur {iteration}/{ITERATIONS} başlıyor...")

    cmd = [
        PYTHON, AGENT_SCRIPT,
        "--mode", mode,
        "--benchmark-csv", BENCHMARK_CSV,
        "--iteration",     str(iteration),
    ]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    deadline = time.time() + DURATION_S
    while time.time() < deadline:
        line = proc.stdout.readline()
        if line:
            print(f"  [agent] {line.rstrip()}", flush=True)
        if proc.poll() is not None:
            log("  ! agent beklenmedik şekilde kapandı.")
            break
        time.sleep(0.05)

    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

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
    log("UniCast Pi Orchestrator başlatıldı.")
    log(f"Plan: {ITERATIONS} tur sessiz -> {ITERATIONS} tur sesli | Her tur {DURATION_S}s")
    log(f"Tahmini toplam süre: ~{int((ITERATIONS * 2 * (DURATION_S + REST_S)) / 60)} dakika\n")

    # Eski CSV'yi temizle (taze başla)
    if os.path.exists(BENCHMARK_CSV):
        backup = BENCHMARK_CSV.replace(".csv", f"_backup_{int(time.time())}.csv")
        os.rename(BENCHMARK_CSV, backup)
        log(f"Eski CSV yedeklendi: {backup}")

    start_total = time.time()

    run_phase("silent")

    log("SESLİ faza geçmeden önce 60s ek bekleme (cihaz soğuması)...")
    time.sleep(60)

    run_phase("audio")

    elapsed = int(time.time() - start_total)
    log(f"Tüm testler tamamlandı! Toplam süre: {elapsed // 60}dk {elapsed % 60}s")
    log(f"Veri dosyası: {os.path.abspath(BENCHMARK_CSV)}")
    log("Bu dosyayı bilgisayarına kopyalayıp report_generator.py'yi çalıştırabilirsin.")


if __name__ == "__main__":
    main()