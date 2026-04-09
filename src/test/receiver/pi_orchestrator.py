# -*- coding: utf-8 -*-
"""
pi_orchestrator.py - Raspberry Pi otomasyon betigi.
30 tur sessiz + 30 tur sesli test, her tur 5dk.
Kullanim: python3 pi_orchestrator.py
"""

import subprocess
import time
import sys
import os
import io

# Terminali UTF-8'e zorla
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from datetime import datetime

# ── Ayarlar ──────────────────────────────────────────────────────────────────
ITERATIONS    = 3
DURATION_S    = 180         # 3 dakika
REST_S        = 30          # Turlar arasi bekleme
BENCHMARK_CSV = "benchmark_log.csv"
AGENT_SCRIPT  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.py")
PYTHON        = sys.executable
# ─────────────────────────────────────────────────────────────────────────────


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run_iteration(mode: str, iteration: int):
    log(f">> [{mode.upper()}] Tur {iteration}/{ITERATIONS} basliyor...")

    cmd = [
        PYTHON, AGENT_SCRIPT,
        "--mode",          mode,
        "--benchmark-csv", BENCHMARK_CSV,
        "--iteration",     str(iteration),
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    deadline = time.time() + DURATION_S
    while time.time() < deadline:
        line = proc.stdout.readline()
        if line:
            print(f"  [agent] {line.rstrip()}", flush=True)
        if proc.poll() is not None:
            log("  ! agent beklenmedik sekilde kapandi.")
            break
        time.sleep(0.05)

    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    log(f"OK [{mode.upper()}] Tur {iteration} tamamlandi.")


def run_phase(mode: str):
    log(f"=== FAZ BASLIYOR: {mode.upper()} ({ITERATIONS} tur x {DURATION_S}s) ===")
    for i in range(1, ITERATIONS + 1):
        run_iteration(mode, i)
        if i < ITERATIONS:
            log(f"   {REST_S}s dinleniyor...")
            time.sleep(REST_S)
    log(f"=== FAZ BITTI: {mode.upper()} ===")


def main():
    log("UniCast Pi Orchestrator baslatildi.")
    log(f"Plan: {ITERATIONS} tur sessiz -> {ITERATIONS} tur sesli | Her tur {DURATION_S}s")
    log(f"Tahmini toplam sure: ~{int((ITERATIONS * 2 * (DURATION_S + REST_S)) / 60)} dakika")

    if os.path.exists(BENCHMARK_CSV):
        backup = BENCHMARK_CSV.replace(".csv", f"_backup_{int(time.time())}.csv")
        os.rename(BENCHMARK_CSV, backup)
        log(f"Eski CSV yedeklendi: {backup}")

    start_total = time.time()

    run_phase("silent")

    log("Sesli faza gecmeden once 60s bekleme (soguma)...")
    time.sleep(60)

    run_phase("audio")

    elapsed = int(time.time() - start_total)
    log(f"Tum testler tamamlandi! Sure: {elapsed // 60}dk {elapsed % 60}s")
    log(f"Veri dosyasi: {os.path.abspath(BENCHMARK_CSV)}")


if __name__ == "__main__":
    main()