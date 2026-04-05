import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import os

class ReportGenerator:
    def __init__(self, benchmark_csv="benchmark_log.csv", latency_csv="latency_log.csv"):
        self.benchmark_csv = benchmark_csv
        self.latency_csv = latency_csv
        self.output_file = "unicast_performance_report.html"

    def load_data(self):
        df_bench = pd.read_csv(self.benchmark_csv) if os.path.exists(self.benchmark_csv) else None
        df_lat = pd.read_csv(self.latency_csv) if os.path.exists(self.latency_csv) else None
        return df_bench, df_lat

    def generate_report(self):
        df_bench, df_lat = self.load_data()
        
        if df_bench is None:
            print("Error: Benchmark data not found.")
            return

        # Create subplots: 3 rows, 2 columns
        fig = make_subplots(
            rows=3, cols=2,
            subplot_titles=(
                "CPU & RAM Usage (%)", "Video FPS (5s Rolling Average)",
                "RTP Jitter (ms) - Video vs Audio", "Packet Loss (Cumulative)",
                "System Temperature (°C)", "Software Latency (RTT ms)"
            ),
            vertical_spacing=0.1,
            horizontal_spacing=0.1
        )

        # 1. CPU & RAM
        fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['CPU_Usage(%)'], name="CPU (%)", line=dict(color='red')), row=1, col=1)
        fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['RAM_Usage(%)'], name="RAM (%)", line=dict(color='blue')), row=1, col=1)

        # 2. FPS
        fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['FPS'], name="FPS", fill='tozeroy', line=dict(color='green')), row=1, col=2)
        fig.add_hline(y=30, line_dash="dash", line_color="black", annotation_text="Target (30 FPS)", row=1, col=2)

        # 3. Jitter (Dual) - Convert ns to ms for readability
        if 'Video_Jitter(ns)' in df_bench.columns:
            df_bench['Video_Jitter(ms)'] = df_bench['Video_Jitter(ns)'] / 1_000_000.0
            df_bench['Audio_Jitter(ms)'] = df_bench['Audio_Jitter(ns)'] / 1_000_000.0
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Video_Jitter(ms)'], name="Video Jitter (ms)", line=dict(color='purple')), row=2, col=1)
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Audio_Jitter(ms)'], name="Audio Jitter (ms)", line=dict(color='magenta', dash='dot')), row=2, col=1)
        else:
            # Legacy support
            df_bench['Jitter(ms)'] = df_bench['Jitter(ns)'] / 1_000_000.0
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Jitter(ms)'], name="Jitter (ms)", line=dict(color='purple')), row=2, col=1)

        # 4. Packet Loss (Dual)
        if 'Video_Loss' in df_bench.columns:
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Video_Loss'], name="Video Loss", line=dict(color='orange')), row=2, col=2)
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Audio_Loss'], name="Audio Loss", line=dict(color='brown', dash='dot')), row=2, col=2)
        else:
            # Legacy support
            fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Packet_Loss'], name="Loss", line=dict(color='orange')), row=2, col=2)

        # 5. Temperature
        fig.add_trace(go.Scatter(x=df_bench['Timestamp'], y=df_bench['Temp(C)'], name="Temp (°C)", line=dict(color='brown')), row=3, col=1)
        fig.add_hline(y=80, line_dash="dot", line_color="red", annotation_text="Throttling Limit", row=3, col=1)

        # 6. Latency (if available)
        if df_lat is not None:
            fig.add_trace(go.Scatter(x=df_lat['Timestamp'], y=df_lat['RTT_ms'], name="RTT (ms)", mode='lines+markers', line=dict(color='darkcyan')), row=3, col=2)
        else:
            fig.add_annotation(text="No Latency Data", xref="paper", yref="paper", x=0.8, y=0.1, showarrow=False)

        # Update layout for "Standard Academic" white background
        fig.update_layout(
            height=1200,
            width=1400,
            title_text="UniCast AV Streaming - Scientific Performance Analysis",
            template="plotly_white",
            showlegend=True,
            font=dict(family="Arial", size=12)
        )

        fig.write_html(self.output_file)
        print(f"Report generated successfully: {self.output_file}")
        
        # Print Summary Stats
        print("\n--- PERFORMANCE SUMMARY ---")
        print(f"Average FPS: {df_bench['FPS'].mean():.2f}")
        print(f"Peak CPU: {df_bench['CPU_Usage(%)'].max():.2f}%")
        
        if 'Video_Loss' in df_bench.columns:
            v_loss = df_bench['Video_Loss'].iloc[-1] - df_bench['Video_Loss'].iloc[0]
            a_loss = df_bench['Audio_Loss'].iloc[-1] - df_bench['Audio_Loss'].iloc[0]
            print(f"Video Packet Loss: {v_loss}")
            print(f"Audio Packet Loss: {a_loss}")
        
        if df_lat is not None:
            print(f"Average Software Latency: {df_lat['RTT_ms'].mean():.2f} ms")

if __name__ == "__main__":
    gen = ReportGenerator()
    gen.generate_report()
