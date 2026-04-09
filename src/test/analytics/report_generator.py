"""
report_generator.py
===================
benchmark_log.csv + latency_log.csv → unicast_performance_report.html

Yeni özellikler:
- Sessiz vs Sesli gruplar için Student t-testi (scipy)
- Ortalama ± standart sapma grafikleri
- Jitter için 30ms threshold çizgisi
- Throughput grafiği
- İstatistiksel özet tablosu
"""

import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from scipy import stats
import os

JITTER_THRESHOLD_MS = 30.0   # Hocadan: jitter bu değerin altında olmalı


class ReportGenerator:
    def __init__(self, benchmark_csv="benchmark_log.csv", latency_csv="latency_log.csv"):
        self.benchmark_csv = benchmark_csv
        self.latency_csv   = latency_csv
        self.output_file   = "unicast_performance_report.html"

    # ── Veri Yükleme ──────────────────────────────────────────────────────────

    def load_data(self):
        df_bench = pd.read_csv(self.benchmark_csv) if os.path.exists(self.benchmark_csv) else None
        df_lat   = pd.read_csv(self.latency_csv)   if os.path.exists(self.latency_csv)   else None

        if df_bench is not None:
            # ns → ms dönüşümü
            df_bench["Video_Jitter(ms)"] = df_bench["Video_Jitter(ns)"] / 1_000_000.0
            df_bench["Audio_Jitter(ms)"] = df_bench.get("Audio_Jitter(ns)", pd.Series(0)) / 1_000_000.0

        return df_bench, df_lat

    # ── T-Testi ───────────────────────────────────────────────────────────────

    def run_ttests(self, df: pd.DataFrame) -> dict:
        """
        Sessiz vs Sesli gruplar arasında bağımsız iki örneklem t-testi.
        Metrik başına: t istatistiği, p değeri, anlamlılık (α=0.05)
        """
        silent = df[df["Mode"] == "silent"]
        audio  = df[df["Mode"] == "audio"]

        metrics = {
            "FPS":                  ("FPS",               "FPS"),
            "Video Jitter (ms)":    ("Video_Jitter(ms)",  "ms"),
            "Video Packet Loss":    ("Video_Loss",         "paket"),
            "CPU Usage":            ("CPU_Usage(%)",       "%"),
            "Throughput":           ("Throughput(kbps)",   "kbps"),
        }

        results = {}
        for label, (col, unit) in metrics.items():
            if col not in df.columns:
                continue
            g1 = silent[col].dropna()
            g2 = audio[col].dropna()
            if len(g1) < 2 or len(g2) < 2:
                continue
            t_stat, p_val = stats.ttest_ind(g1, g2, equal_var=False)  # Welch t-test
            results[label] = {
                "unit":        unit,
                "silent_mean": round(g1.mean(), 3),
                "silent_std":  round(g1.std(), 3),
                "audio_mean":  round(g2.mean(), 3),
                "audio_std":   round(g2.std(), 3),
                "t_stat":      round(t_stat, 4),
                "p_value":     round(p_val, 6),
                "significant": "✅ Evet (p<0.05)" if p_val < 0.05 else "❌ Hayır (p≥0.05)"
            }
        return results

    # ── Grafik Oluşturma ──────────────────────────────────────────────────────

    def generate_report(self):
        df_bench, df_lat = self.load_data()

        if df_bench is None:
            print("Hata: benchmark_log.csv bulunamadı.")
            return

        ttest_results = self.run_ttests(df_bench)

        silent_df = df_bench[df_bench["Mode"] == "silent"]
        audio_df  = df_bench[df_bench["Mode"] == "audio"]

        # Her tur için tek bir ortalama satır üret (zaman serisi yerine tur bazlı özet)
        def per_iter_mean(df, col):
            return df.groupby("Iteration")[col].mean().reset_index()

        # ── Subplotlar ────────────────────────────────────────────────────────
        fig = make_subplots(
            rows=4, cols=2,
            subplot_titles=(
                "FPS – Tur Ortalamaları (Sessiz vs Sesli)",
                "Video Jitter (ms) – Tur Ortalamaları",
                "CPU Kullanımı (%) – Tur Ortalamaları",
                "Throughput (kbps) – Tur Ortalamaları",
                "Video Paket Kaybı – Kümülatif",
                "Audio Jitter (ms) – Tur Ortalamaları",
                "Sıcaklık (°C) – Tüm Ölçümler",
                "RTT Gecikmesi (ms) – Tüm Ölçümler"
            ),
            vertical_spacing=0.10,
            horizontal_spacing=0.08
        )

        SILENT_COLOR = "royalblue"
        AUDIO_COLOR  = "tomato"

        def add_iter_traces(col, row, col_idx, unit="", show_30ms=False):
            for mode_df, color, name in [
                (silent_df, SILENT_COLOR, "Sessiz"),
                (audio_df,  AUDIO_COLOR,  "Sesli"),
            ]:
                if col not in mode_df.columns:
                    return
                grp = per_iter_mean(mode_df, col)
                std = mode_df.groupby("Iteration")[col].std().values

                fig.add_trace(go.Scatter(
                    x=grp["Iteration"], y=grp[col],
                    mode="lines+markers",
                    name=name,
                    line=dict(color=color),
                    error_y=dict(type="data", array=std, visible=True),
                    legendgroup=name,
                    showlegend=(row == 1 and col_idx == 1)
                ), row=row, col=col_idx)

            if show_30ms:
                fig.add_hline(
                    y=JITTER_THRESHOLD_MS,
                    line_dash="dot", line_color="red",
                    annotation_text=f"Eşik: {JITTER_THRESHOLD_MS} ms",
                    row=row, col=col_idx
                )

        # FPS (row1, col1) — hedef 30 fps çizgisi
        add_iter_traces("FPS", 1, 1)
        fig.add_hline(y=30, line_dash="dash", line_color="black",
                      annotation_text="Hedef 30 FPS", row=1, col=1)

        # Video Jitter (row1, col2) — 30ms threshold
        add_iter_traces("Video_Jitter(ms)", 1, 2, show_30ms=True)

        # CPU (row2, col1)
        add_iter_traces("CPU_Usage(%)", 2, 1)

        # Throughput (row2, col2)
        add_iter_traces("Throughput(kbps)", 2, 2)

        # Video Packet Loss (row3, col1)
        add_iter_traces("Video_Loss", 3, 1)

        # Audio Jitter (row3, col2) — 30ms threshold
        add_iter_traces("Audio_Jitter(ms)", 3, 2, show_30ms=True)

        # Sıcaklık – ham zaman serisi (row4, col1)
        for mode_df, color, name in [(silent_df, SILENT_COLOR, "Sessiz"), (audio_df, AUDIO_COLOR, "Sesli")]:
            if "Temp(C)" in mode_df.columns:
                fig.add_trace(go.Scatter(
                    x=mode_df.index, y=mode_df["Temp(C)"],
                    mode="lines", name=name, line=dict(color=color),
                    legendgroup=name, showlegend=False
                ), row=4, col=1)
        fig.add_hline(y=80, line_dash="dot", line_color="red",
                      annotation_text="Throttle sınırı (80°C)", row=4, col=1)

        # RTT (row4, col2)
        if df_lat is not None:
            for mode_label, color in [("silent", SILENT_COLOR), ("audio", AUDIO_COLOR)]:
                sub = df_lat[df_lat["Mode"] == mode_label] if "Mode" in df_lat.columns else df_lat
                fig.add_trace(go.Scatter(
                    x=sub.index, y=sub["RTT_ms"],
                    mode="lines", name=f"RTT – {mode_label}",
                    line=dict(color=color),
                    legendgroup=mode_label, showlegend=False
                ), row=4, col=2)
            fig.add_hline(y=JITTER_THRESHOLD_MS, line_dash="dot", line_color="red",
                          annotation_text="30 ms eşik", row=4, col=2)
        else:
            fig.add_annotation(text="Latency verisi yok", xref="paper", yref="paper",
                               x=0.85, y=0.05, showarrow=False)

        # ── Layout ────────────────────────────────────────────────────────────
        fig.update_layout(
            height=1600, width=1400,
            title_text="UniCast AV Streaming – Bilimsel Performans Analizi",
            template="plotly_white",
            font=dict(family="Arial", size=12),
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )

        # ── T-Testi HTML Tablosu ───────────────────────────────────────────────
        ttest_html = self._build_ttest_table(ttest_results)

        # ── HTML Birleştir ────────────────────────────────────────────────────
        chart_html = fig.to_html(full_html=False, include_plotlyjs="cdn")

        # Veri eksikliği durumunda (örneğin test yarım kaldıysa) NaN hatasını engelle
        n_silent_raw = df_bench[df_bench["Mode"] == "silent"]["Iteration"].max() if "Mode" in df_bench.columns else np.nan
        n_audio_raw  = df_bench[df_bench["Mode"] == "audio"]["Iteration"].max()  if "Mode" in df_bench.columns else np.nan

        n_silent = int(n_silent_raw) if pd.notnull(n_silent_raw) else 0
        n_audio  = int(n_audio_raw)  if pd.notnull(n_audio_raw)  else 0
        dur_min  = round(len(df_bench[df_bench["Iteration"] == 1]) / 60) if "Iteration" in df_bench.columns and not df_bench.empty else 0

        full_html = f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>UniCast Performans Raporu</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 40px; background: #fafafa; color: #222; }}
    h1 {{ color: #2c3e50; }}
    h2 {{ color: #34495e; border-bottom: 2px solid #bdc3c7; padding-bottom: 6px; }}
    table {{ border-collapse: collapse; width: 100%; margin-bottom: 30px; }}
    th {{ background: #2c3e50; color: white; padding: 10px 14px; text-align: left; }}
    td {{ padding: 8px 14px; border-bottom: 1px solid #ddd; }}
    tr:nth-child(even) {{ background: #f2f2f2; }}
    .sig-yes {{ color: green; font-weight: bold; }}
    .sig-no  {{ color: #c0392b; }}
    .summary-box {{ background: #eaf4fb; border-left: 5px solid #3498db;
                    padding: 14px 18px; margin-bottom: 24px; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>UniCast AV Streaming – Bilimsel Performans Raporu</h1>
  <div class="summary-box">
    <b>Yöntem:</b> Her mod (sessiz / sesli) icin {n_silent} tur x {dur_min} dakika test yapilmistir.
    Turlar arasi 30 saniye dinlenme verilmistir. Istatistiksel karsilastirma icin
    Welch bagimsiz iki orneklem t-testi kullanilmistir (a = 0.05).
  </div>

  <h2>İstatistiksel Karşılaştırma (Student T-Testi)</h2>
  {ttest_html}

  <h2>Performans Grafikleri</h2>
  {chart_html}
</body>
</html>"""

        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(full_html)

        print(f"\nRapor oluşturuldu: {self.output_file}")
        self._print_summary(ttest_results)

    # ── Yardımcı Metodlar ─────────────────────────────────────────────────────

    def _build_ttest_table(self, results: dict) -> str:
        rows = ""
        for metric, r in results.items():
            sig_class = "sig-yes" if "Evet" in r["significant"] else "sig-no"
            rows += f"""
            <tr>
              <td><b>{metric}</b> ({r['unit']})</td>
              <td>{r['silent_mean']} ± {r['silent_std']}</td>
              <td>{r['audio_mean']} ± {r['audio_std']}</td>
              <td>{r['t_stat']}</td>
              <td>{r['p_value']}</td>
              <td class="{sig_class}">{r['significant']}</td>
            </tr>"""

        return f"""
        <table>
          <thead>
            <tr>
              <th>Metrik</th>
              <th>Sessiz (Ort ± SD)</th>
              <th>Sesli (Ort ± SD)</th>
              <th>t istatistiği</th>
              <th>p değeri</th>
              <th>Anlamlı Fark? (α=0.05)</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>"""

    def _print_summary(self, results: dict):
        print("\n--- ISTATISTIKSEL OZET ---")
        for metric, r in results.items():
            print(f"  {metric}:")
            print(f"    Sessiz: {r['silent_mean']} +/- {r['silent_std']} {r['unit']}")
            print(f"    Sesli:  {r['audio_mean']} +/- {r['audio_std']} {r['unit']}")
            sig_text = r['significant'].replace("✅ ", "").replace("❌ ", "")
            print(f"    t={r['t_stat']}, p={r['p_value']} -> {sig_text}")


if __name__ == "__main__":
    gen = ReportGenerator()
    gen.generate_report()