"""
report_generator.py
======================
UniCast Scientific Report Generator

Usage:
  python report_generator.py 10   → Mean ± SD (single iteration, scientific)
  python report_generator.py 50   → Raw stream (5 consecutive iterations)
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from scipy import stats
import os
import sys

class ScientificReportGenerator:
    def __init__(self, benchmark_csv="../receiver/benchmark_log.csv", latency_csv=None):
        self.benchmark_csv = benchmark_csv
        # Latency log: automatic location detection
        if latency_csv:
            self.latency_csv = latency_csv
        elif os.path.exists("../sender/latency_log_partly_fixes.csv"):
            self.latency_csv = "../sender/latency_log_partly_fixes.csv"
        elif os.path.exists("../latency_log.csv"):
            self.latency_csv = "../latency_log.csv"
        elif os.path.exists("../receiver/latency_log.csv"):
            self.latency_csv = "../receiver/latency_log.csv"
        else:
            self.latency_csv = "../sender/latency_log_partly_fixes.csv"  # default
        self.output_file = "unicast_final_report.html"

    def load_data(self):
        df = pd.read_csv(self.benchmark_csv) if os.path.exists(self.benchmark_csv) else None
        df_lat = None
        if os.path.exists(self.latency_csv):
            try:
                # Raw read: Turkish locale decimal comma (3,96) mixes with CSV comma
                # So we parse line by line
                rows = []
                with open(self.latency_csv, 'r', encoding='utf-8-sig') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("Timestamp"):
                            continue
                        parts = line.split(",")
                        if len(parts) == 4:
                            # Normal: Timestamp,Mode,Iteration,RTT_ms (or TIMEOUT)
                            ts, mode, iteration, rtt = parts
                        elif len(parts) == 5:
                            # Turkish comma: Timestamp,Mode,Iteration,8,72 → 8.72
                            ts, mode, iteration, rtt_int, rtt_dec = parts
                            rtt = f"{rtt_int}.{rtt_dec}"
                        else:
                            continue
                        
                        if rtt.strip() == "TIMEOUT":
                            continue
                        try:
                            rtt_val = float(rtt)
                            rows.append({"Timestamp": ts, "Mode": mode, "Iteration": int(iteration), "RTT_ms": rtt_val})
                        except (ValueError, TypeError):
                            continue
                
                if rows:
                    df_lat = pd.DataFrame(rows)
                    print(f"Latency: {len(df_lat)} valid RTT measurements loaded.")
                else:
                    print("Latency: No valid RTT measurements found.")
            except Exception as e:
                print(f"Latency CSV read error: {e}")
                df_lat = None
        
        if df is not None:
            def parse_mode(mode):
                p = str(mode).split("_")
                if len(p) >= 3: return p[0], p[1], p[2]
                return "unknown", "unknown", "unknown"

            df["Resolution"], df["ContentType"], df["AudioStatus"] = zip(*df["Mode"].apply(parse_mode))
            df["Video_Jitter(ms)"] = df["Video_Jitter(ns)"] / 1_000_000.0
            if "Audio_Jitter(ns)" in df.columns:
                df["Audio_Jitter(ms)"] = df["Audio_Jitter(ns)"] / 1_000_000.0
            df = df[df["FPS"] > 0].copy()
        return df, df_lat

    def run_ttest(self, df, group_col, val1, val2, filter_cols):
        results = []
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "packets"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
        subgroups = df.groupby(filter_cols)
        for name, sub_df in subgroups:
            g1 = sub_df[sub_df[group_col] == val1]
            g2 = sub_df[sub_df[group_col] == val2]
            if len(g1) > 1 and len(g2) > 1:
                group_name = " ".join(name) if isinstance(name, tuple) else name
                res_dict = {"group": group_name}
                for col, unit in metrics:
                    t, p = stats.ttest_ind(g1[col], g2[col], equal_var=False)
                    res_dict[col] = {
                        "m1": round(g1[col].mean(), 3), "s1": round(g1[col].std(), 3),
                        "m2": round(g2[col].mean(), 2), "s2": round(g2[col].std(), 3),
                        "t": round(t, 3), "p": round(p, 5), "sig": "Yes (p<0.05)" if p < 0.05 else "No"
                    }
                results.append(res_dict)
        return results

    def _build_stats_table(self, title, label1, label2, results):
        if not results: return ""
        html = f"<h3>{title} ({label1.capitalize()} vs {label2.capitalize()})</h3>"
        html += """<table class='scientific-table'><thead><tr>
            <th>Sub Scenario</th><th>Metric</th><th>{l1} (Mean±SD)</th><th>{l2} (Mean±SD)</th><th>t</th><th>p</th><th>Diff?</th>
        </tr></thead><tbody>""".format(l1=label1, l2=label2)
        
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "packets"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
        for res in results:
            first = True
            for col, unit in metrics:
                r = res[col]
                sig_style = "color:green;font-weight:bold" if "Yes" in r['sig'] else "color:#e74c3c"
                html += "<tr>"
                if first:
                    html += f"<td rowspan='5' class='group-header'>{res['group']}</td>"
                    first = False
                html += f"<td>{col}</td><td>{r['m1']}±{r['s1']}</td><td>{r['m2']}±{r['s2']}</td><td>{r['t']}</td><td>{r['p']}</td><td style='{sig_style}'>{r['sig']}</td></tr>"
        html += "</tbody></table>"
        return html

    # ═════════════════════════════════════════════════════════════════════
    #  REPORT GENERATION
    # ═════════════════════════════════════════════════════════════════════

    def generate_report(self, view_mode=10):
        df, df_lat = self.load_data()
        if df is None: return

        # 1. ANALYSIS TABLES
        s1 = self._build_stats_table("1. Audio Effect", "Silent", "Audio", self.run_ttest(df, "AudioStatus", "sessiz", "sesli", ["Resolution", "ContentType"]))
        s2 = self._build_stats_table("2. Resolution Effect", "1080p", "720p", self.run_ttest(df, "Resolution", "1080p", "720p", ["ContentType", "AudioStatus"]))
        s3 = self._build_stats_table("3. Content Effect", "Slide", "Video", self.run_ttest(df, "ContentType", "slayt", "video", ["Resolution", "AudioStatus"]))

        # 2. CHARTS
        metrics = [
            ("FPS", "FPS Stream"), ("Video_Jitter(ms)", "Video Jitter (ms)"),
            ("CPU_Usage(%)", "CPU Usage (%)"), ("Throughput(kbps)", "Network Traffic (kbps)"),
            ("Video_Loss", "Packet Loss"), ("Audio_Jitter(ms)", "Audio Jitter (ms)"),
            ("Temp(C)", "Temperature (°C)"), ("RTT_ms", "RTT Latency (ms)")
        ]
        
        fig = make_subplots(rows=4, cols=2, vertical_spacing=0.08, subplot_titles=[m[1] for m in metrics])
        modes = sorted(df["Mode"].unique())
        colors = [
            "#2196F3", "#E91E63", "#4CAF50", "#FF9800",
            "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"
        ]

        if view_mode == 10:
            self._build_mean_sd_charts(fig, df, df_lat, metrics, modes, colors)
            mode_label = "10min Mean ± SD"
            desc = "Each line shows the mean of 5 iterations, the shaded area shows ±1 standard deviation."
        else:
            self._build_timeline_charts(fig, df, df_lat, metrics, modes, colors)
            mode_label = "50min Raw Stream"
            desc = "5 iterations are shown consecutively."

        final_html = self._wrap_html(s1 + s2 + s3, fig.to_html(full_html=False, include_plotlyjs="cdn"), mode_label, desc)
        
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(final_html)
        print(f"Report successfully generated: {self.output_file} ({mode_label})")

    # ─── MODE 10: Mean ± SD ───────────────────────────────────────────
    def _build_mean_sd_charts(self, fig, df, df_lat, metrics, modes, colors):
        TRACES_PER_MODE = 2  # SD fill + mean line
        total_traces = 0
        
        for i, (m_col, _) in enumerate(metrics):
            row, col = (i // 2) + 1, (i % 2) + 1
            
            for mi, mode in enumerate(modes):
                color = colors[mi % len(colors)]
                iter_data, max_len = self._collect_iter_data(df, df_lat, m_col, mode)
                
                if max_len > 0 and iter_data:
                    aligned = np.full((len(iter_data), max_len), np.nan)
                    for k, d in enumerate(iter_data):
                        aligned[k, :len(d)] = d
                    y_mean = np.nanmean(aligned, axis=0)
                    y_std = np.nanstd(aligned, axis=0)
                    y_upper = y_mean + y_std
                    y_lower = np.maximum(y_mean - y_std, 0)
                    secs = np.arange(max_len)
                    x_time = [f"{int(s//60)}:{int(s%60):02d}" for s in secs]
                    
                    rgba = self._hex_to_rgba(color, 0.15)
                    fig.add_trace(go.Scatter(
                        x=list(x_time) + list(reversed(x_time)),
                        y=list(y_upper) + list(reversed(y_lower)),
                        fill='toself', fillcolor=rgba, line=dict(width=0),
                        name=f"{mode} (±SD)", showlegend=False, visible=True, hoverinfo='skip'
                    ), row=row, col=col)
                    fig.add_trace(go.Scatter(
                        x=x_time, y=y_mean, mode='lines',
                        line=dict(color=color, width=2), name=mode, visible=True
                    ), row=row, col=col)
                else:
                    fig.add_trace(go.Scatter(x=[], y=[], showlegend=False, visible=True), row=row, col=col)
                    fig.add_trace(go.Scatter(x=[], y=[], showlegend=False, visible=True), row=row, col=col)
                total_traces += TRACES_PER_MODE

        self._add_dropdown(fig, modes, metrics, total_traces, TRACES_PER_MODE)

    # ─── MODE 50: Raw stream (5 consecutive iterations) ──────────────────────
    def _build_timeline_charts(self, fig, df, df_lat, metrics, modes, colors):
        TRACES_PER_MODE = 1
        total_traces = 0
        
        for i, (m_col, _) in enumerate(metrics):
            row, col = (i // 2) + 1, (i % 2) + 1
            
            for mi, mode in enumerate(modes):
                color = colors[mi % len(colors)]
                iter_data, _ = self._collect_iter_data(df, df_lat, m_col, mode)
                
                if iter_data and any(len(d) > 0 for d in iter_data):
                    all_y = []
                    all_x = []
                    offset = 0
                    for d in iter_data:
                        secs = np.arange(len(d)) + offset
                        x_labels = [f"{int(s//60)}:{int(s%60):02d}" for s in secs]
                        all_x.extend(x_labels)
                        all_y.extend(d.tolist())
                        offset += len(d)
                    
                    fig.add_trace(go.Scatter(
                        x=all_x, y=all_y, mode='lines',
                        line=dict(color=color, width=1.5), name=mode, visible=True
                    ), row=row, col=col)
                else:
                    fig.add_trace(go.Scatter(x=[], y=[], showlegend=False, visible=True), row=row, col=col)
                total_traces += TRACES_PER_MODE

        self._add_dropdown(fig, modes, metrics, total_traces, TRACES_PER_MODE)

    # ─── Helper functions ────────────────────────────────────────────
    def _collect_iter_data(self, df, df_lat, m_col, mode):
        """Collects iteration-based data for a mode×metric. Returns (iter_data_list, max_len)."""
        iter_data = []
        max_len = 0
        
        if m_col == "RTT_ms":
            if df_lat is not None:
                lat_mode = df_lat[df_lat["Mode"] == mode]
                if not lat_mode.empty:
                    for it in sorted(lat_mode["Iteration"].unique()):
                        vals = lat_mode[lat_mode["Iteration"] == it]["RTT_ms"].values
                        iter_data.append(vals)
                        if len(vals) > max_len:
                            max_len = len(vals)
        elif m_col in df.columns:
            sub_mode = df[df["Mode"] == mode]
            if not sub_mode.empty:
                for it in sorted(sub_mode["Iteration"].unique()):
                    vals = sub_mode[sub_mode["Iteration"] == it][m_col].values
                    iter_data.append(vals)
                    if len(vals) > max_len:
                        max_len = len(vals)
        
        return iter_data, max_len

    def _hex_to_rgba(self, hex_color, alpha):
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)
        return f"rgba({r},{g},{b},{alpha})"

    def _add_dropdown(self, fig, modes, metrics, total_traces, traces_per_mode):
        n_modes = len(modes)
        n_metrics = len(metrics)
        traces_per_metric = n_modes * traces_per_mode
        
        buttons = [dict(label="All Scenarios", method="update", args=[{"visible": [True] * total_traces}])]
        
        for mi, m in enumerate(modes):
            visibility = [False] * total_traces
            for j in range(n_metrics):
                base = j * traces_per_metric + mi * traces_per_mode
                for t in range(traces_per_mode):
                    if base + t < total_traces:
                        visibility[base + t] = True
            buttons.append(dict(label=m, method="update", args=[{"visible": visibility}]))

        fig.update_layout(
            updatemenus=[dict(active=0, buttons=buttons, x=0, y=1.08, xanchor="left", yanchor="top")],
            height=1600, width=1300, template="plotly_white",
            legend=dict(orientation="h", y=-0.05),
            margin=dict(t=150)
        )
        for i in range(1, n_metrics + 1):
            axis_name = f"xaxis{i}" if i > 1 else "xaxis"
            fig.update_layout(**{axis_name: dict(title="Time (min:sec)")})

    def _wrap_html(self, stats_tables, chart_html, mode_label="", desc=""):
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>UniCast Scientific Report</title>
  <style>
    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; background: #fff; color: #333; line-height: 1.6; }}
    .main-wrap {{ max-width: 1400px; margin: auto; }}
    h1 {{ color: #2c3e50; text-align: center; font-size: 32px; border-bottom: 4px solid #3498db; padding-bottom: 20px; }}
    h2 {{ color: #2980b9; margin-top: 50px; border-bottom: 2px solid #eee; }}
    h3 {{ background: #f8f9fa; color: #2c3e50; padding: 15px; border-left: 6px solid #3498db; margin-top: 30px; }}
    .scientific-table {{ width: 100%; border-collapse: collapse; margin-bottom: 40px; background: white; }}
    .scientific-table th {{ background: #2c3e50; color: white; padding: 12px; text-align: left; border: 1px solid #34495e; font-size: 14px; }}
    .scientific-table td {{ padding: 10px; border: 1px solid #ddd; font-size: 13px; font-family: 'Consolas', monospace; }}
    .group-header {{ background: #f1f2f6; font-weight: bold; text-align: center; vertical-align: middle; }}
    .sig-yes {{ color: #27ae60; font-weight: bold; }}
    .sig-no {{ color: #e74c3c; }}
    .chart-box {{ background: white; border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-top: 20px; }}
    .mode-badge {{ display: inline-block; background: #3498db; color: white; padding: 4px 14px; border-radius: 12px; font-size: 14px; margin-left: 10px; }}
    .sys-footer {{ margin-top: 60px; border-top: 3px solid #2c3e50; padding-top: 20px; }}
    .sys-footer h2 {{ color: #2c3e50; }}
    .sys-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; }}
    .sys-card {{ background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 18px; }}
    .sys-card h4 {{ margin: 0 0 12px 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; font-size: 15px; }}
    .sys-card table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
    .sys-card td {{ padding: 5px 8px; border-bottom: 1px solid #eee; }}
    .sys-card td:first-child {{ color: #7f8c8d; width: 40%; font-weight: 500; }}
    .sys-card td:last-child {{ font-family: 'Consolas', monospace; color: #2c3e50; }}
  </style>
</head>
<body>
  <div class="main-wrap">
    <h1>UniCast Performance Evaluation Report</h1>
    
    <div class="analysis-section">
      <h2>1. STATISTICAL ANALYSIS</h2>
      <p>The tables below show the scientific impact (T-Test) of each main variable (Audio, Resolution, Content) on system performance.</p>
      {stats_tables}
    </div>

    <div class="chart-box">
      <h2>2. TEMPORAL PERFORMANCE STREAM <span class="mode-badge">{mode_label}</span></h2>
      <p style="color:#7f8c8d;">* {desc} You can view details by selecting a scenario from the menu above.</p>
      {chart_html}
    </div>

    <div class="sys-footer">
      <h2>3. TEST ENVIRONMENT</h2>
      <div class="sys-grid">
        <div class="sys-card">
          <h4>🖥️ Sender (Windows)</h4>
          <table>
            <tr><td>OS</td><td>Windows 10 Pro (10.0.19045)</td></tr>
            <tr><td>System</td><td>FUJITSU ESPRIMO P756</td></tr>
            <tr><td>Processor</td><td>Intel Core i7-6700 @ 3.40 GHz</td></tr>
            <tr><td>Cores / Threads</td><td>4 Cores / 8 Threads</td></tr>
            <tr><td>RAM</td><td>8 GB DDR4</td></tr>
            <tr><td>GPU</td><td>Intel HD Graphics 530 (1 GB)</td></tr>
            <tr><td>Display Resolution</td><td>1366 × 768 @ 59 Hz</td></tr>
            <tr><td>BIOS Mode</td><td>UEFI</td></tr>
            <tr><td>Screen Capture</td><td>DX9 Screen Capture (dx9screencapsrc)</td></tr>
          </table>
        </div>
        <div class="sys-card">
          <h4>📡 Receiver (Raspberry Pi)</h4>
          <table>
            <tr><td>Model</td><td>Raspberry Pi 5</td></tr>
            <tr><td>Processor</td><td>Broadcom BCM2712 2.4GHz quad-core 64-bit Arm Cortex-A76</td></tr>
            <tr><td>RAM</td><td>LPDDR4X-4267 SDRAM (1GB)</td></tr>
            <tr><td>GPU</td><td>VideoCore VII</td></tr>
            <tr><td>OS</td><td>Raspberry Pi OS Lite Bookworm (Debian)</td></tr>
            <tr><td>Video Decoder</td><td>GStreamer (H.264 SW)</td></tr>
          </table>
        </div>
        <div class="sys-card">
          <h4>⚙️ Test Parameters</h4>
          <table>
            <tr><td>Scenario Count</td><td>8 (2 resolutions × 2 contents × 2 audio)</td></tr>
            <tr><td>Iterations</td><td>5 repeats / scenario</td></tr>
            <tr><td>Duration / Iteration</td><td>600 seconds (10 minutes)</td></tr>
            <tr><td>Total Test Time</td><td>~7 hours (40 runs)</td></tr>
            <tr><td>Cooldown Interval</td><td>30 seconds</td></tr>
            <tr><td>Synchronization</td><td>TCP Handshake (PREPARE/READY/STOP)</td></tr>
          </table>
        </div>
        <div class="sys-card">
          <h4>📊 Stream Configuration</h4>
          <table>
            <tr><td>Video Codec</td><td>H.264 (x264enc)</td></tr>
            <tr><td>Audio Codec</td><td>Opus (128 kbps)</td></tr>
            <tr><td>Slide Mode</td><td>15 FPS / 5000 kbps</td></tr>
            <tr><td>Video Mode</td><td>30 FPS / 4000 kbps</td></tr>
            <tr><td>Resolutions</td><td>1920×1080 / 1280×720</td></tr>
            <tr><td>Protocol</td><td>RTP over UDP</td></tr>
            <tr><td>RTT Measurement</td><td>UDP PING/PONG (1 sec interval)</td></tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</body>
</html>"""

if __name__ == "__main__":
    view = 10
    if len(sys.argv) > 1:
        try:
            view = int(sys.argv[1])
        except ValueError:
            pass
    if view not in (10, 50):
        print("Usage: python report_generator.py [10|50]")
        print("  10 = Mean +/- SD (scientific, default)")
        print("  50 = Raw stream (5 consecutive iterations)")
        sys.exit(1)
    gen = ScientificReportGenerator()
    gen.generate_report(view_mode=view)