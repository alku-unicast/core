# -*- coding: utf-8 -*-
import subprocess
import time
import sys
import os
import io
import fcntl
import json
from datetime import datetime

# Terminali UTF-8'e zorla
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

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

    # Eski GStreamer process'lerini oldur
    try:
        subprocess.run(["pkill", "-9", "-f", "gst-launch"], capture_output=True)
    except:
        pass

    # Portlari temizle
    try:
        ports = [str(config["video_port"]), str(config["audio_port"]), str(config["echo_port"])]
        subprocess.run(["sudo", "fuser", "-k"] + [p + "/udp" for p in ports], capture_output=True)
    except:
        pass

    # UDP buffer'larin bosalmasi icin bekle
    time.sleep(3)
    log("Port temizligi tamamlandi.")

    # Kernel Optimizasyonu (Sadece 1. tur ise)
    if phase_index == 0 and iteration == 1:
        try:
            subprocess.run(["sudo", "sysctl", "-w", "net.core.rmem_max=26214400"], capture_output=True)
        except:
            pass
        
        # Eski log dosyasini yedekle
        csv_path = "benchmark_log.csv"
        if os.path.exists(csv_path):
            backup = csv_path.replace(".csv", f"_backup_{int(time.time())}.csv")
            os.rename(csv_path, backup)
            log(f"Eski log yedeklendi: {backup}")

    # Agent Komutu hazirlama
    agent_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.py")
    cmd = [
        sys.executable, agent_script,
        "--mode",          mode,
        "--benchmark-csv", "benchmark_log.csv",
        "--iteration",     str(iteration),
        "--video-port",    str(config["video_port"]),
        "--audio-port",    str(config["audio_port"]),
        "--echo-port",     str(config["echo_port"])
    ]

    log(f"Agent Baslatiliyor ({config['duration_s']}s)...")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace"
    )

    # stdout'u non-blocking moda al
    fd = proc.stdout.fileno()
    fl = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    deadline = time.time() + config["duration_s"]
    try:
        while time.time() < deadline:
            try:
                line = proc.stdout.readline()
                if line:
                    print(f"  [agent] {line.rstrip()}", flush=True)
            except IOError:
                pass
            
            if proc.poll() is not None:
                log("  ! agent beklenmedik sekilde kapandi.")
                break
            time.sleep(0.1)
    except KeyboardInterrupt:
        log("Kullanici tarafindan durduruldu.")
        state["is_finished"] = True
        save_json(STATE_FILE, state)
        proc.kill()
        return

    # Kapatma
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

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