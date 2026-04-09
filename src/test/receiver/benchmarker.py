import os
import time
import psutil
import pandas as pd
from datetime import datetime

class Benchmarker:
    def __init__(self, log_path="benchmark_log.csv"):
        self.log_path = log_path
        self.data = []
        self.start_time = time.time()
        self.frame_count = 0
        self.last_fps_check = time.time()
        self.fps_buffer = []

        # Throughput tracking
        self.bytes_received = 0
        self.last_throughput_check = time.time()

        # Test metadata (set by orchestrator)
        self.mode = "unknown"       # "silent" or "audio"
        self.iteration = 0          # 1-30

        # Initialize CSV
        if not os.path.exists(self.log_path):
            df = pd.DataFrame(columns=[
                "Timestamp", "Mode", "Iteration",
                "CPU_Usage(%)", "RAM_Usage(%)", "Swap_Usage(%)",
                "Temp(C)", "FPS",
                "Video_Jitter(ns)", "Video_Loss",
                "Audio_Jitter(ns)", "Audio_Loss",
                "Throughput(kbps)"
            ])
            df.to_csv(self.log_path, index=False)

    def set_test_metadata(self, mode: str, iteration: int):
        """Called by orchestrator before each test run."""
        self.mode = mode
        self.iteration = iteration

    def get_temp(self):
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                return int(f.read()) / 1000.0
        except:
            return 0.0

    def on_frame_decoded(self):
        self.frame_count += 1

    def on_bytes_received(self, byte_count: int):
        """Call this with the number of bytes received from the UDP socket."""
        self.bytes_received += byte_count

    def collect_stats(self, v_jitter=0, v_loss=0, a_jitter=0, a_loss=0):
        now = time.time()

        # FPS calculation
        elapsed_fps = now - self.last_fps_check
        current_fps = self.frame_count / elapsed_fps if elapsed_fps > 0 else 0
        self.frame_count = 0
        self.last_fps_check = now

        self.fps_buffer.append(current_fps)
        if len(self.fps_buffer) > 5:
            self.fps_buffer.pop(0)
        avg_fps_5s = sum(self.fps_buffer) / len(self.fps_buffer)

        # Throughput calculation (kbps)
        elapsed_tp = now - self.last_throughput_check
        throughput_kbps = (self.bytes_received * 8 / 1000.0) / elapsed_tp if elapsed_tp > 0 else 0
        self.bytes_received = 0
        self.last_throughput_check = now

        stats = {
            "Timestamp": datetime.now().strftime("%H:%M:%S"),
            "Mode": self.mode,
            "Iteration": self.iteration,
            "CPU_Usage(%)": psutil.cpu_percent(),
            "RAM_Usage(%)": psutil.virtual_memory().percent,
            "Swap_Usage(%)": psutil.swap_memory().percent,
            "Temp(C)": self.get_temp(),
            "FPS": round(avg_fps_5s, 2),
            "Video_Jitter(ns)": v_jitter,
            "Video_Loss": v_loss,
            "Audio_Jitter(ns)": a_jitter,
            "Audio_Loss": a_loss,
            "Throughput(kbps)": round(throughput_kbps, 2)
        }

        self.data.append(stats)
        pd.DataFrame([stats]).to_csv(self.log_path, mode='a', header=False, index=False)
        return stats

    def get_summary(self):
        if not self.data:
            return {"error": "No data collected."}

        df = pd.DataFrame(self.data)
        v_loss = df["Video_Loss"].max() - df["Video_Loss"].min() if len(df) > 1 else 0
        a_loss = df["Audio_Loss"].max() - df["Audio_Loss"].min() if len(df) > 1 else 0

        return {
            "Mode": self.mode,
            "Iteration": self.iteration,
            "Average_FPS": round(df["FPS"].mean(), 2),
            "Std_FPS": round(df["FPS"].std(), 2),
            "Video_Packet_Loss": int(v_loss),
            "Audio_Packet_Loss": int(a_loss),
            "Max_Temp(C)": df["Temp(C)"].max(),
            "Avg_CPU(%)": round(df["CPU_Usage(%)"].mean(), 2),
            "Avg_Throughput(kbps)": round(df["Throughput(kbps)"].mean(), 2),
            "Avg_Video_Jitter(ns)": round(df["Video_Jitter(ns)"].mean(), 2),
            "Avg_Audio_Jitter(ns)": round(df["Audio_Jitter(ns)"].mean(), 2),
        }