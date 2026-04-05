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
        self.fps_buffer = []  # To calculate 5-second rolling average
        
        # Initialize CSV with expanded headers for Audio/Video
        if not os.path.exists(self.log_path):
            df = pd.DataFrame(columns=[
                "Timestamp", "CPU_Usage(%)", "RAM_Usage(%)", "Swap_Usage(%)", 
                "Temp(C)", "FPS", 
                "Video_Jitter(ns)", "Video_Loss", 
                "Audio_Jitter(ns)", "Audio_Loss",
                "Bitrate(kbps)"
            ])
            df.to_csv(self.log_path, index=False)

    def get_temp(self):
        try:
            # Standard Raspberry Pi temperature interface
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
                temp = int(f.read()) / 1000.0
            return temp
        except:
            return 0.0

    def on_frame_decoded(self):
        """Call this every time a video frame is decoded/rendered."""
        self.frame_count += 1

    def collect_stats(self, v_jitter=0, v_loss=0, a_jitter=0, a_loss=0, bitrate_kbps=0):
        now = time.time()
        elapsed = now - self.last_fps_check
        
        # Calculate current FPS
        current_fps = self.frame_count / elapsed if elapsed > 0 else 0
        self.frame_count = 0
        self.last_fps_check = now
        
        # Rolling average buffer for 5 seconds (assuming 1s collection interval)
        self.fps_buffer.append(current_fps)
        if len(self.fps_buffer) > 5:
            self.fps_buffer.pop(0)
        
        avg_fps_5s = sum(self.fps_buffer) / len(self.fps_buffer)
        
        stats = {
            "Timestamp": datetime.now().strftime("%H:%M:%S"),
            "CPU_Usage(%)": psutil.cpu_percent(),
            "RAM_Usage(%)": psutil.virtual_memory().percent,
            "Swap_Usage(%)": psutil.swap_memory().percent,
            "Temp(C)": self.get_temp(),
            "FPS": round(avg_fps_5s, 2),
            "Video_Jitter(ns)": v_jitter,
            "Video_Loss": v_loss,
            "Audio_Jitter(ns)": a_jitter,
            "Audio_Loss": a_loss,
            "Bitrate(kbps)": round(bitrate_kbps, 2)
        }
        
        self.data.append(stats)
        # Append single row to CSV
        pd.DataFrame([stats]).to_csv(self.log_path, mode='a', header=False, index=False)
        return stats

    def get_summary(self):
        if not self.data:
            return "No data collected."
        
        df = pd.DataFrame(self.data)
        avg_fps = df["FPS"].mean()
        v_loss = df["Video_Loss"].max() - df["Video_Loss"].min() if len(df) > 1 else 0
        a_loss = df["Audio_Loss"].max() - df["Audio_Loss"].min() if len(df) > 1 else 0
        
        return {
            "Average_FPS": round(avg_fps, 2),
            "Video_Packet_Loss": v_loss,
            "Audio_Packet_Loss": a_loss,
            "Max_Temp": df["Temp(C)"].max(),
            "Avg_CPU": round(df["CPU_Usage(%)"].mean(), 2)
        }
