"""
report_generator_v5.py
======================
Final Scientific Revision: Multi-Scenario Selectors and High Fidelity Line Charts
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from scipy import stats
import os
import datetime

class ScientificReportGenerator:
    def __init__(self, benchmark_csv="../receiver/benchmark_log.csv", latency_csv=None):
        self.benchmark_csv = benchmark_csv
        # Latency log: otomatik konum tespiti
        if latency_csv:
            self.latency_csv = latency_csv
        elif os.path.exists("../latency_log.csv"):
            self.latency_csv = "../latency_log.csv"
        elif os.path.exists("../receiver/latency_log.csv"):
            self.latency_csv = "../receiver/latency_log.csv"
        else:
            self.latency_csv = "../latency_log.csv"  # varsayılan
        self.output_file = "unicast_final_report.html"

    def load_data(self):
        df = pd.read_csv(self.benchmark_csv) if os.path.exists(self.benchmark_csv) else None
        df_lat = None
        if os.path.exists(self.latency_csv):
            try:
                # Raw okuma: Türkçe locale ondalık virgülü (3,96) CSV virgülüyle karışıyor
                # Bu yüzden satır satır parse ediyoruz
                rows = []
                with open(self.latency_csv, 'r', encoding='utf-8-sig') as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("Timestamp"):
                            continue
                        parts = line.split(",")
                        if len(parts) == 4:
                            # Normal: Timestamp,Mode,Iteration,RTT_ms (veya TIMEOUT)
                            ts, mode, iteration, rtt = parts
                        elif len(parts) == 5:
                            # Türkçe virgül: Timestamp,Mode,Iteration,8,72 → 8.72
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
                    print(f"Latency: {len(df_lat)} gecerli RTT olcumu yuklendi.")
                else:
                    print("Latency: Gecerli RTT olcumu bulunamadi.")
            except Exception as e:
                print(f"Latency CSV okuma hatasi: {e}")
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
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "paket"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
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
                        "t": round(t, 3), "p": round(p, 5), "sig": "Evet (p<0.05)" if p < 0.05 else "Hayir"
                    }
                results.append(res_dict)
        return results

    def _build_stats_table(self, title, label1, label2, results):
        if not results: return ""
        html = f"<h3>{title} ({label1.capitalize()} vs {label2.capitalize()})</h3>"
        html += """<table class='scientific-table'><thead><tr>
            <th>Alt Senaryo</th><th>Metrik</th><th>{l1} (Ort±SD)</th><th>{l2} (Ort±SD)</th><th>t</th><th>p</th><th>Fark?</th>
        </tr></thead><tbody>""".format(l1=label1, l2=label2)
        
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "paket"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
        for res in results:
            first = True
            for col, unit in metrics:
                r = res[col]
                sig_style = "color:green;font-weight:bold" if "Evet" in r['sig'] else "color:#e74c3c"
                html += "<tr>"
                if first:
                    html += f"<td rowspan='5' class='group-header'>{res['group']}</td>"
                    first = False
                html += f"<td>{col}</td><td>{r['m1']}±{r['s1']}</td><td>{r['m2']}±{r['s2']}</td><td>{r['t']}</td><td>{r['p']}</td><td style='{sig_style}'>{r['sig']}</td></tr>"
        html += "</tbody></table>"
        return html

    def generate_report(self):
        df, df_lat = self.load_data()
        if df is None: return

        # 1. ANALIZ TABLOLARI
        s1 = self._build_stats_table("1. Ses Etkisi", "sessiz", "sesli", self.run_ttest(df, "AudioStatus", "sessiz", "sesli", ["Resolution", "ContentType"]))
        s2 = self._build_stats_table("2. Çözünürlük Etkisi", "1080p", "720p", self.run_ttest(df, "Resolution", "1080p", "720p", ["ContentType", "AudioStatus"]))
        s3 = self._build_stats_table("3. İçerik Etkisi", "slayt", "video", self.run_ttest(df, "ContentType", "slayt", "video", ["Resolution", "AudioStatus"]))

        # 2. GRAFIKLER — Ortalama ± SD (tüm iterasyonlar üzerinden)
        metrics = [
            ("FPS", "FPS Akışı"), ("Video_Jitter(ms)", "Video Jitter (ms)"),
            ("CPU_Usage(%)", "CPU Kullanımı (%)"), ("Throughput(kbps)", "Net Trafiği (kbps)"),
            ("Video_Loss", "Paket Kaybı"), ("Audio_Jitter(ms)", "Audio Jitter (ms)"),
            ("Temp(C)", "Sıcaklık (°C)"), ("RTT_ms", "RTT Gecikmesi (ms)")
        ]
        
        fig = make_subplots(rows=4, cols=2, vertical_spacing=0.08, subplot_titles=[m[1] for m in metrics])
        
        modes = sorted(df["Mode"].unique())
        colors = [
            "#2196F3", "#E91E63", "#4CAF50", "#FF9800",
            "#9C27B0", "#00BCD4", "#FF5722", "#607D8B"
        ]
        
        # Her mod için her metrikte 2 trace: mean çizgi + SD gölge
        TRACES_PER_MODE = 2  # mean + fill
        total_traces = 0
        
        for i, (m_col, m_title) in enumerate(metrics):
            row = (i // 2) + 1
            col = (i % 2) + 1
            
            for mi, mode in enumerate(modes):
                color = colors[mi % len(colors)]
                x_time = None
                y_mean = None
                y_upper = None
                y_lower = None
                
                if m_col == "RTT_ms":
                    # RTT: latency_log'dan, iterasyon bazlı ortalama
                    if df_lat is not None:
                        lat_mode = df_lat[df_lat["Mode"] == mode]
                        if not lat_mode.empty:
                            iters = lat_mode["Iteration"].unique()
                            if len(iters) > 0:
                                # Her iterasyonu aynı zaman eksenine hizala
                                iter_data = []
                                min_len = None
                                for it in sorted(iters):
                                    vals = lat_mode[lat_mode["Iteration"] == it]["RTT_ms"].values
                                    iter_data.append(vals)
                                    if min_len is None or len(vals) < min_len:
                                        min_len = len(vals)
                                
                                if min_len and min_len > 0:
                                    # Tüm iterasyonları aynı uzunluğa kes
                                    aligned = np.array([d[:min_len] for d in iter_data])
                                    y_mean = aligned.mean(axis=0)
                                    y_std = aligned.std(axis=0)
                                    y_upper = y_mean + y_std
                                    y_lower = np.maximum(y_mean - y_std, 0)
                                    secs = np.arange(min_len)
                                    x_time = [f"{int(s//60)}:{int(s%60):02d}" for s in secs]
                
                elif m_col in df.columns:
                    sub_mode = df[df["Mode"] == mode]
                    if not sub_mode.empty:
                        iters = sub_mode["Iteration"].unique()
                        iter_data = []
                        min_len = None
                        for it in sorted(iters):
                            vals = sub_mode[sub_mode["Iteration"] == it][m_col].values
                            iter_data.append(vals)
                            if min_len is None or len(vals) < min_len:
                                min_len = len(vals)
                        
                        if min_len and min_len > 0:
                            aligned = np.array([d[:min_len] for d in iter_data])
                            y_mean = aligned.mean(axis=0)
                            y_std = aligned.std(axis=0)
                            y_upper = y_mean + y_std
                            y_lower = np.maximum(y_mean - y_std, 0)
                            secs = np.arange(min_len) * 5  # ~5sn aralıklı ölçüm
                            x_time = [f"{int(s//60)}:{int(s%60):02d}" for s in secs]
                
                # Trace ekle (her zaman 2 trace: mean + fill)
                if x_time is not None and y_mean is not None:
                    # 1) SD gölge (fill)
                    fig.add_trace(go.Scatter(
                        x=list(x_time) + list(reversed(x_time)),
                        y=list(y_upper) + list(reversed(y_lower)),
                        fill='toself', fillcolor=color.replace(")", ",0.15)").replace("rgb", "rgba") if "rgb" in color else f"rgba({int(color[1:3],16)},{int(color[3:5],16)},{int(color[5:7],16)},0.15)",
                        line=dict(width=0),
                        name=f"{mode} (±SD)",
                        showlegend=False,
                        visible=True,
                        hoverinfo='skip'
                    ), row=row, col=col)
                    
                    # 2) Ortalama çizgi
                    fig.add_trace(go.Scatter(
                        x=x_time, y=y_mean,
                        mode='lines',
                        line=dict(color=color, width=2),
                        name=mode,
                        visible=True
                    ), row=row, col=col)
                else:
                    # Boş trace'ler (visibility indeksleri için)
                    fig.add_trace(go.Scatter(x=[], y=[], showlegend=False, visible=True), row=row, col=col)
                    fig.add_trace(go.Scatter(x=[], y=[], showlegend=False, visible=True), row=row, col=col)
                
                total_traces += TRACES_PER_MODE

        # SEÇİCİ MENÜ (Dropdown)
        n_modes = len(modes)
        n_metrics = len(metrics)
        traces_per_metric = n_modes * TRACES_PER_MODE  # Her metrikte toplam trace
        
        buttons = []
        buttons.append(dict(
            label="Tüm Senaryolar", method="update",
            args=[{"visible": [True] * total_traces}]
        ))
        
        for mi, m in enumerate(modes):
            visibility = [False] * total_traces
            for j in range(n_metrics):
                # Her metrikte bu mod'un 2 trace'i (fill + line)
                base = j * traces_per_metric + mi * TRACES_PER_MODE
                visibility[base] = True      # SD fill
                visibility[base + 1] = True  # Mean line
            buttons.append(dict(label=m, method="update", args=[{"visible": visibility}]))

        fig.update_layout(
            updatemenus=[dict(active=0, buttons=buttons, x=0, y=1.08, xanchor="left", yanchor="top")],
            height=1600, width=1300, template="plotly_white",
            legend=dict(orientation="h", y=-0.05),
            margin=dict(t=150)
        )
        
        # X ekseni etiketleri
        for i in range(1, n_metrics + 1):
            axis_name = f"xaxis{i}" if i > 1 else "xaxis"
            fig.update_layout(**{axis_name: dict(title="Süre (dk:sn)")})

        final_html = self._wrap_html(s1 + s2 + s3, fig.to_html(full_html=False, include_plotlyjs="cdn"))
        
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(final_html)
        print(f"Rapor basariyla olusturuldu: {self.output_file}")

    def _wrap_html(self, stats_tables, chart_html):
        return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>UniCast Bilimsel Rapor</title>
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
  </style>
</head>
<body>
  <div class="main-wrap">
    <h1>UniCast Performans Değerlendirme Raporu</h1>
    
    <div class="analysis-section">
      <h2>1. İSTATİSTİKSEL ANALİZLER</h2>
      <p>Aşağıdaki tablolar her bir ana değişkenin (Ses, Çözünürlük, İçerik) sistem performansı üzerindeki etkisini bilimsel olarak (T-Testi) göstermektedir.</p>
      {stats_tables}
    </div>

    <div class="chart-box">
      <h2>2. ZAMANSAL PERFORMANS AKIŞI</h2>
      <p style="color:#7f8c8d;">* Yukarıdaki menüden bir senaryo seçerek 10 dakikalık (600s) akışı detaylı inceleyebilirsiniz. "Tüm Senaryolar" seçeneği ile kıyaslama yapabilirsiniz.</p>
      {chart_html}
    </div>
  </div>
</body>
</html>"""

if __name__ == "__main__":
    gen = ScientificReportGenerator()
    gen.generate_report()