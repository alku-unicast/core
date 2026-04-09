import socket
import time
import pandas as pd
from datetime import datetime

class LatencyTester:
    def __init__(self, target_ip, port=5005, log_path="latency_log.csv"):
        self.target_ip = target_ip
        self.port = port
        self.log_path = log_path
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.settimeout(1.0) # 1 second timeout

    def measure_rtt(self):
        start_time = time.perf_counter()
        timestamp_str = f"PING:{start_time}"
        
        try:
            # Send
            self.sock.sendto(timestamp_str.encode(), (self.target_ip, self.port))
            
            # Receive
            data, addr = self.sock.recvfrom(1024)
            end_time = time.perf_counter()
            
            rtt_ms = (end_time - start_time) * 1000
            print(f"RTT to {self.target_ip}: {rtt_ms:.2f} ms")
            self.log_rtt(rtt_ms)
            return rtt_ms
            
        except socket.timeout:
            print(f"Timeout: {self.target_ip} is not responding.")
            return None

    def log_rtt(self, rtt_ms):
        data = {
            "Timestamp": datetime.now().strftime("%H:%M:%S"),
            "RTT_ms": rtt_ms
        }
        df = pd.DataFrame([data])
        df.to_csv(self.log_path, mode='a', header=not pd.io.common.file_exists(self.log_path), index=False)

    def run_benchmark(self, duration_s=None, interval_s=1):
        if duration_s:
            print(f"Starting Latency Benchmark for {duration_s} seconds...")
            end_time = time.time() + duration_s
        else:
            print("Starting Latency Benchmark (Press Ctrl+C to stop)...")
            end_time = float('inf')
        
        try:
            while time.time() < end_time:
                self.measure_rtt()
                time.sleep(interval_s)
        except KeyboardInterrupt:
            print("\nLatency Benchmark stopped by user.")

if __name__ == "__main__":
    # Example usage: Replace with actual Pi IP
    PI_IP = "10.50.21.183" 
    tester = LatencyTester(PI_IP)
    tester.run_benchmark() # Runs forever until Ctrl+C
