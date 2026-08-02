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
from statsmodels.stats.multitest import multipletests
import os
import sys

class ScientificReportGenerator:
    def __init__(self, benchmark_csv="../receiver/benchmark_log.csv", latency_csv=None):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        if os.path.isabs(benchmark_csv):
            self.benchmark_csv = benchmark_csv
        else:
            self.benchmark_csv = os.path.abspath(os.path.join(script_dir, benchmark_csv))
            
        if latency_csv:
            if os.path.isabs(latency_csv):
                self.latency_csv = latency_csv
            else:
                self.latency_csv = os.path.abspath(os.path.join(script_dir, latency_csv))
        else:
            p1 = os.path.abspath(os.path.join(script_dir, "../sender/latency_log_partly_fixes.csv"))
            p2 = os.path.abspath(os.path.join(script_dir, "../latency_log.csv"))
            p3 = os.path.abspath(os.path.join(script_dir, "../receiver/latency_log.csv"))
            p4 = os.path.abspath(os.path.join(script_dir, "../sender/latency_log.csv"))
            if os.path.exists(p1):
                self.latency_csv = p1
            elif os.path.exists(p2):
                self.latency_csv = p2
            elif os.path.exists(p3):
                self.latency_csv = p3
            elif os.path.exists(p4):
                self.latency_csv = p4
            else:
                self.latency_csv = p1
                
        self.output_file = os.path.abspath(os.path.join(script_dir, "unicast_final_report.html"))
        self.regression_checked_count = 0
        self.regression_errors = []
        self.assumption_checks = []

    def format_p(self, p):
        if np.isnan(p): return "N/A"
        if p < 0.001: return "p < .001"
        return f"{p:.4f}"

    def make_datetime_aware(self, df_col):
        times = pd.to_timedelta(df_col)
        diffs = times.diff()
        wrap_indices = diffs < pd.to_timedelta("-12h")
        days = wrap_indices.cumsum()
        continuous_time = times + pd.to_timedelta(days, unit='D')
        baseline = pd.to_datetime("2026-07-06")
        return baseline + continuous_time

    def load_data(self):
        if not os.path.exists(self.benchmark_csv):
            print(f"Error: Benchmark CSV not found at '{self.benchmark_csv}'.")
            return None, None
        df = pd.read_csv(self.benchmark_csv)
        
        df_lat = None
        if not os.path.exists(self.latency_csv):
            print(f"Warning: Latency CSV not found at '{self.latency_csv}'. Skipping latency stream.")
        else:
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
            # 1. Convert to continuous datetime FIRST (on raw chronological CSV order)
            df["Datetime"] = self.make_datetime_aware(df["Timestamp"])
            
            # 2. Exclude verified network outage window using real datetime objects
            outage_start = pd.to_datetime("2026-07-07 00:23:00")
            outage_end = pd.to_datetime("2026-07-07 01:26:30")
            df = df[~((df["Datetime"] >= outage_start) & (df["Datetime"] <= outage_end))].copy()

            # 3. Sort by Mode, Iteration, and Datetime, then diff cumulative loss
            df = df.sort_values(by=["Mode", "Iteration", "Datetime"])
            df["Video_Loss"] = df.groupby(["Mode", "Iteration"])["Video_Loss"].diff().fillna(0).clip(lower=0)

            def parse_mode(mode):
                p = str(mode).split("_")
                if len(p) >= 3: return p[0], p[1], p[2]
                return "unknown", "unknown", "unknown"

            df["Resolution"], df["ContentType"], df["AudioStatus"] = zip(*df["Mode"].apply(parse_mode))
            df["Video_Jitter(ms)"] = df["Video_Jitter(ns)"] / 1_000_000.0
            if "Audio_Jitter(ns)" in df.columns:
                df["Audio_Jitter(ms)"] = df["Audio_Jitter(ns)"] / 1_000_000.0
            df = df[df["FPS"] > 0].copy()

        if df_lat is not None:
            # Convert to continuous datetime first on raw chronological order
            df_lat["Datetime"] = self.make_datetime_aware(df_lat["Timestamp"])
            outage_start = pd.to_datetime("2026-07-07 00:23:00")
            outage_end = pd.to_datetime("2026-07-07 01:26:30")
            df_lat = df_lat[~((df_lat["Datetime"] >= outage_start) & (df_lat["Datetime"] <= outage_end))].copy()

        return df, df_lat

    def load_previous_results(self):
        if not os.path.exists(self.output_file):
            print("Info: No previous report found for regression check.")
            return None
        try:
            import bs4
            with open(self.output_file, "r", encoding="utf-8") as f:
                html = f.read()
            soup = bs4.BeautifulSoup(html, "html.parser")
            tables = soup.find_all("table", class_="scientific-table")
            
            previous = {}
            for table_idx, table in enumerate(tables):
                # If it's the appendix table, skip it
                if "Appendix" in str(table.previous_element) or "appendix" in str(table.get("class", [])):
                    continue
                header_row = table.find("tr")
                if not header_row:
                    continue
                rows = table.find_all("tr")[1:]  # skip header
                current_group = None
                for row in rows:
                    tds = [td.text.strip() for td in row.find_all("td")]
                    if not tds:
                        continue
                    # Check if first cell is group header
                    has_group = row.find("td", class_="group-header") or row.find("td").has_attr("rowspan")
                    if has_group:
                        current_group = tds[0]
                        cells = tds[1:]
                    else:
                        cells = tds
                        
                    if len(cells) == 9:
                        # Old format: [metric, m1_s1, m2_s2, n1, n2, t, p, d, sig]
                        metric = cells[0]
                        m1_str, s1_str = cells[1].split("±")
                        m2_str, s2_str = cells[2].split("±")
                        n1 = int(cells[3])
                        n2 = int(cells[4])
                        t = float(cells[5])
                        p_str = cells[6]
                        d = float(cells[7])
                    elif len(cells) == 13:
                        # New format: [metric, m1_s1, m2_s2, mean_diff, pct_change, ci, n1, n2, t, p_raw, p_adj, d, sig]
                        metric = cells[0]
                        m1_str, s1_str = cells[1].split("±")
                        m2_str, s2_str = cells[2].split("±")
                        n1 = int(cells[6])
                        n2 = int(cells[7])
                        t = float(cells[8])
                        p_str = cells[9]
                        d = float(cells[11])
                    else:
                        continue
                        
                    if "p < .001" in p_str or "<" in p_str:
                        p = 0.0
                    else:
                        try:
                            p = float(p_str)
                        except ValueError:
                            p = 0.0
                            
                    key = (table_idx, current_group, metric)
                    previous[key] = {
                        "m1": float(m1_str),
                        "s1": float(s1_str),
                        "m2": float(m2_str),
                        "s2": float(s2_str),
                        "n1": n1,
                        "n2": n2,
                        "t": t,
                        "p": p,
                        "d": d
                    }
            print(f"Regression Test: Loaded {len(previous)} previous metrics for verification.")
            return previous
        except Exception as e:
            print(f"Warning: Failed to load previous results for regression check: {e}")
            return None

    def run_ttest(self, df, group_col, val1, val2, filter_cols, paired=False, table_idx=0, previous_results=None):
        def translate_group_name(group_name):
            translations = {
                "1080p slayt": "1080p Slide",
                "1080p video": "1080p Video",
                "720p slayt": "720p Slide",
                "720p video": "720p Video",
                
                "slayt sesli": "Slide with Audio",
                "slayt sessiz": "Slide without Audio",
                "video sesli": "Video with Audio",
                "video sessiz": "Video without Audio",
                
                "1080p sesli": "1080p with Audio",
                "1080p sessiz": "1080p without Audio",
                "720p sesli": "720p with Audio",
                "720p sessiz": "720p without Audio"
            }
            return translations.get(group_name, group_name)

        results = []
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "packets/s"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
        subgroups = df.groupby(filter_cols)
        for name, sub_df in subgroups:
            g1 = sub_df[sub_df[group_col] == val1]
            g2 = sub_df[sub_df[group_col] == val2]
            if len(g1) > 1 and len(g2) > 1:
                group_name = " ".join(name) if isinstance(name, tuple) else name
                group_name = translate_group_name(group_name)
                res_dict = {"group": group_name}
                for col, unit in metrics:
                    # Aggregate at the iteration level to avoid pseudoreplication
                    g1_agg = g1.groupby("Iteration")[col].mean()
                    g2_agg = g2.groupby("Iteration")[col].mean()
                    
                    # Align iterations
                    common_idx = g1_agg.index.intersection(g2_agg.index)
                    n1 = len(g1_agg)
                    n2 = len(g2_agg)
                    
                    m1, m2 = g1_agg.mean() if not g1_agg.empty else 0.0, g2_agg.mean() if not g2_agg.empty else 0.0
                    s1_std, s2_std = g1_agg.std() if len(g1_agg) > 1 else 0.0, g2_agg.std() if len(g2_agg) > 1 else 0.0
                    s1, s2 = g1_agg.var(ddof=1) if len(g1_agg) > 1 else 0.0, g2_agg.var(ddof=1) if len(g2_agg) > 1 else 0.0
                    
                    # Cohen's d (Effect Size) calculation
                    if n1 > 1 and n2 > 1:
                        pooled_sd = np.sqrt(((n1 - 1) * s1 + (n2 - 1) * s2) / (n1 + n2 - 2))
                        d_val = (m1 - m2) / pooled_sd if pooled_sd > 0 else 0.0
                    else:
                        d_val = 0.0
                    
                    if paired:
                        if len(common_idx) > 1:
                            t, p = stats.ttest_rel(g1_agg.loc[common_idx], g2_agg.loc[common_idx])
                        else:
                            t, p = np.nan, np.nan
                    else:
                        if n1 > 1 and n2 > 1:
                            t, p = stats.ttest_ind(g1_agg, g2_agg, equal_var=False)
                        else:
                            t, p = np.nan, np.nan
                    
                    # Mean Difference & Pct Change
                    mean_diff = m1 - m2
                    pct_change = (mean_diff / m2 * 100.0) if abs(m2) > 1e-9 else 0.0
                    
                    # 95% Confidence Interval
                    if paired:
                        n = len(common_idx)
                        if n > 1:
                            diffs = g1_agg.loc[common_idx] - g2_agg.loc[common_idx]
                            se = diffs.std(ddof=1) / np.sqrt(n)
                            ci_half = stats.t.ppf(0.975, n - 1) * se
                            ci_low = mean_diff - ci_half
                            ci_high = mean_diff + ci_half
                        else:
                            ci_low, ci_high = np.nan, np.nan
                    else:
                        if n1 > 1 and n2 > 1:
                            se = np.sqrt(s1/n1 + s2/n2)
                            num_df = (s1/n1 + s2/n2)**2
                            den_df = (s1/n1)**2 / (n1 - 1) + (s2/n2)**2 / (n2 - 1)
                            df_welch = num_df / den_df if den_df > 0 else 1.0
                            ci_half = stats.t.ppf(0.975, df_welch) * se
                            ci_low = mean_diff - ci_half
                            ci_high = mean_diff + ci_half
                        else:
                            ci_low, ci_high = np.nan, np.nan
                            
                    # Assumption checks (Shapiro-Wilk + Levene)
                    try:
                        if len(g1_agg) >= 3 and g1_agg.std() > 1e-9:
                            _, p_shapi1 = stats.shapiro(g1_agg)
                        else:
                            p_shapi1 = np.nan
                    except Exception:
                        p_shapi1 = np.nan
                        
                    try:
                        if len(g2_agg) >= 3 and g2_agg.std() > 1e-9:
                            _, p_shapi2 = stats.shapiro(g2_agg)
                        else:
                            p_shapi2 = np.nan
                    except Exception:
                        p_shapi2 = np.nan
                        
                    try:
                        if len(g1_agg) >= 2 and len(g2_agg) >= 2 and (g1_agg.std() > 1e-9 or g2_agg.std() > 1e-9):
                            _, p_levene = stats.levene(g1_agg, g2_agg)
                        else:
                            p_levene = np.nan
                    except Exception:
                        p_levene = np.nan
                        
                    self.assumption_checks.append({
                        "table": table_idx,
                        "group": group_name,
                        "metric": col,
                        "p_shapi1": p_shapi1,
                        "p_shapi2": p_shapi2,
                        "p_levene": p_levene
                    })
                    
                    # Sign consistency checks
                    if not (np.isnan(t) or np.isnan(d_val)):
                        if abs(mean_diff) > 1e-5 and abs(t) > 1e-5 and abs(d_val) > 1e-5:
                            signs = [np.sign(mean_diff), np.sign(pct_change), np.sign(t), np.sign(d_val)]
                            if len(set(signs)) > 1:
                                raise ValueError(
                                    f"Sign consistency mismatch for table {table_idx}, group: '{group_name}', metric: '{col}'. "
                                    f"Values: Mean Diff={mean_diff:.4f}, % Change={pct_change:.2f}%, "
                                    f"t-value={t:.4f}, Cohen's d={d_val:.4f}."
                                )
                                
                    res_dict[col] = {
                        "m1": m1,
                        "s1": s1_std,
                        "m2": m2,
                        "s2": s2_std,
                        "n1": n1,
                        "n2": n2,
                        "t": t,
                        "p": p,
                        "d": d_val,
                        "mean_diff": mean_diff,
                        "pct_change": pct_change,
                        "ci_low": ci_low,
                        "ci_high": ci_high
                    }
                    
                    # Regression check
                    if previous_results:
                        key = (table_idx, group_name, col)
                        if key in previous_results:
                            old = previous_results[key]
                            def check_val(name, val_new, val_old):
                                self.regression_checked_count += 1
                                if np.isnan(val_new) and np.isnan(val_old):
                                    return
                                if name in ("n1", "n2"):
                                    if int(val_new) != int(val_old):
                                        msg = f"Table {table_idx}, Group '{group_name}', Metric '{col}', Field '{name}': New={val_new}, Old={val_old}"
                                        self.regression_errors.append(msg)
                                elif name == "p":
                                    if self.format_p(val_new) != self.format_p(val_old):
                                        if not (val_new < 0.001 and val_old < 0.001):
                                            if abs(val_new - val_old) > 1.5e-3:
                                                msg = f"Table {table_idx}, Group '{group_name}', Metric '{col}', Field '{name}': New={val_new:.5f}, Old={val_old:.5f}"
                                                self.regression_errors.append(msg)
                                else:
                                    if abs(val_new - val_old) > 1.5e-3:
                                        msg = f"Table {table_idx}, Group '{group_name}', Metric '{col}', Field '{name}': New={val_new:.5f}, Old={val_old:.5f}"
                                        self.regression_errors.append(msg)
                                    
                            check_val("m1", res_dict[col]["m1"], old["m1"])
                            check_val("s1", res_dict[col]["s1"], old["s1"])
                            check_val("m2", res_dict[col]["m2"], old["m2"])
                            check_val("s2", res_dict[col]["s2"], old["s2"])
                            check_val("n1", res_dict[col]["n1"], old["n1"])
                            check_val("n2", res_dict[col]["n2"], old["n2"])
                            check_val("t", res_dict[col]["t"] if not np.isnan(res_dict[col]["t"]) else 0.0, old["t"])
                            check_val("p", res_dict[col]["p"] if not np.isnan(res_dict[col]["p"]) else 1.0, old["p"])
                            check_val("d", res_dict[col]["d"], old["d"])
                            
                results.append(res_dict)
                
        # Holm-Bonferroni correction per table (Dynamic family size)
        pvals = []
        for res in results:
            for col, _ in metrics:
                p = res[col]["p"]
                pvals.append(p if not np.isnan(p) else 1.0)
                
        if pvals:
            _, p_adj, _, _ = multipletests(pvals, method='holm')
            idx = 0
            for res in results:
                for col, _ in metrics:
                    adj_p = p_adj[idx]
                    res[col]["p_adj"] = adj_p
                    res[col]["sig"] = "Yes (p_adj<0.05)" if adj_p < 0.05 else "No"
                    idx += 1
                    
        return results

    def _build_stats_table(self, title, label1, label2, results, table_idx=0):
        if not results: return ""
        
        pct_header = f"% Change (vs. {label2.capitalize()})"
        html = f"<h3>{title} ({label1.capitalize()} vs {label2.capitalize()})</h3>"
        html += f"""<table class='scientific-table'><thead><tr>
            <th>Sub Scenario</th>
            <th>Metric</th>
            <th>{label1} (Mean±SD)</th>
            <th>{label2} (Mean±SD)</th>
            <th>Mean Diff</th>
            <th>{pct_header}</th>
            <th>95% CI (of Diff)</th>
            <th>n1</th>
            <th>n2</th>
            <th>t</th>
            <th>Raw p</th>
            <th>Adj p (Holm)</th>
            <th>Cohen's d</th>
            <th>Sig?</th>
        </tr></thead><tbody>"""
        
        metrics = [("FPS", "FPS"), ("Video_Jitter(ms)", "ms"), ("Video_Loss", "packets/s"), ("CPU_Usage(%)", "%"), ("Throughput(kbps)", "kbps")]
        
        for res in results:
            first = True
            for col, unit in metrics:
                r = res[col]
                sig_style = "color:green;font-weight:bold" if "Yes" in r['sig'] else "color:#e74c3c"
                
                mean_diff_str = f"{r['mean_diff']:.3f}"
                prefix = "+" if r['pct_change'] > 0 else ""
                pct_str = f"{prefix}{r['pct_change']:.2f}%" if not np.isnan(r['pct_change']) else "N/A"
                
                if np.isnan(r['ci_low']) or np.isnan(r['ci_high']):
                    ci_str = "N/A"
                else:
                    ci_str = f"[{r['ci_low']:.3f}, {r['ci_high']:.3f}]"
                    
                t_str = f"{r['t']:.3f}" if not np.isnan(r['t']) else "N/A"
                raw_p_str = self.format_p(r['p'])
                adj_p_str = self.format_p(r['p_adj'])
                d_str = f"{r['d']:.3f}"
                
                html += "<tr>"
                if first:
                    html += f"<td rowspan='5' class='group-header'>{res['group']}</td>"
                    first = False
                html += f"""<td>{col}</td>
                    <td>{r['m1']:.3f}±{r['s1']:.3f}</td>
                    <td>{r['m2']:.3f}±{r['s2']:.3f}</td>
                    <td>{mean_diff_str}</td>
                    <td>{pct_str}</td>
                    <td>{ci_str}</td>
                    <td>{r['n1']}</td>
                    <td>{r['n2']}</td>
                    <td>{t_str}</td>
                    <td>{raw_p_str}</td>
                    <td>{adj_p_str}</td>
                    <td>{d_str}</td>
                    <td style='{sig_style}'>{r['sig']}</td>
                </tr>"""
                
        valid_p_count = len(results) * len(metrics)
        caption_text = (
            f"<div class='table-caption' style='font-size:12px;color:#7f8c8d;margin-top:-30px;margin-bottom:35px;line-height:1.4;'>"
            f"<strong>Note:</strong> Multi-comparison correction was applied using the Holm-Bonferroni method "
            f"per table as a separate family of comparisons (dynamic family-wise N = {valid_p_count} tests). "
            f"Percentage change is calculated relative to the baseline ({label2.capitalize()}), i.e., "
            f"({label1.capitalize()} - {label2.capitalize()}) / {label2.capitalize()} * 100."
            f"</div>"
        )
        
        html += "</tbody></table>" + caption_text
        return html

    # ═════════════════════════════════════════════════════════════════════
    #  REPORT GENERATION
    # ═════════════════════════════════════════════════════════════════════

    def generate_report(self, view_mode=10):
        # Initialize trackers
        self.regression_checked_count = 0
        self.regression_errors = []
        self.assumption_checks = []

        df, df_lat = self.load_data()
        if df is None: return

        # Load previous results for regression checking
        previous_results = self.load_previous_results()

        # Dynamically set output filename based on view_mode
        script_dir = os.path.dirname(os.path.abspath(__file__))
        if view_mode == 50:
            self.output_file = os.path.abspath(os.path.join(script_dir, "unicast_timeline_report.html"))
        else:
            self.output_file = os.path.abspath(os.path.join(script_dir, "unicast_final_report.html"))

        # 1. ANALYSIS TABLES
        s1 = self._build_stats_table("1. Audio Effect", "Silent", "Audio", self.run_ttest(df, "AudioStatus", "sessiz", "sesli", ["Resolution", "ContentType"], paired=True, table_idx=0, previous_results=previous_results), table_idx=0)
        s2 = self._build_stats_table("2. Resolution Effect", "1080p", "720p", self.run_ttest(df, "Resolution", "1080p", "720p", ["ContentType", "AudioStatus"], paired=False, table_idx=1, previous_results=previous_results), table_idx=1)
        s3 = self._build_stats_table("3. Content Effect", "Slide", "Video", self.run_ttest(df, "ContentType", "slayt", "video", ["Resolution", "AudioStatus"], paired=False, table_idx=2, previous_results=previous_results), table_idx=2)

        # Append assumptions appendix table
        appendix_table = self._build_appendix_table()
        stats_tables = s1 + s2 + s3 + appendix_table

        # 2. CHARTS
        metrics = [
            ("FPS", "FPS Stream"), ("Video_Jitter(ms)", "Video Jitter (ms)"),
            ("CPU_Usage(%)", "CPU Usage (%)"), ("Throughput(kbps)", "Network Traffic (kbps)"),
            ("Video_Loss", "Video Packet Loss (packets/s)"), ("Audio_Jitter(ms)", "Audio Jitter (ms)"),
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

        final_html = self._wrap_html(stats_tables, fig.to_html(full_html=False, include_plotlyjs="cdn"), mode_label, desc)
        
        with open(self.output_file, "w", encoding="utf-8") as f:
            f.write(final_html)
        print(f"Report successfully generated: {self.output_file} ({mode_label})")

        # Verify regression results
        if previous_results:
            if len(self.regression_errors) > 0:
                print(f"\n[REGRESSION ERROR] Mismatch found in {len(self.regression_errors)} stats compared to previous report:")
                for err in self.regression_errors:
                    print(f"  - {err}")
                raise ValueError("Regression verification failed! One or more baseline statistics changed.")
            else:
                print(f"\n[REGRESSION SUCCESS] Verified {self.regression_checked_count} baseline values. 0 discrepancies found!")

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
                    import warnings
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore", category=RuntimeWarning)
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
                    for it in range(1, 6):
                        if it in lat_mode["Iteration"].values:
                            vals = lat_mode[lat_mode["Iteration"] == it]["RTT_ms"].values
                            iter_data.append(vals)
                            if len(vals) > max_len:
                                max_len = len(vals)
                        else:
                            iter_data.append(np.full(600, np.nan))
                            if 600 > max_len:
                                max_len = 600
        elif m_col in df.columns:
            sub_mode = df[df["Mode"] == mode]
            if not sub_mode.empty:
                for it in range(1, 6):
                    if it in sub_mode["Iteration"].values:
                        vals = sub_mode[sub_mode["Iteration"] == it][m_col].values
                        iter_data.append(vals)
                        if len(vals) > max_len:
                            max_len = len(vals)
                    else:
                        iter_data.append(np.full(600, np.nan))
                        if 600 > max_len:
                            max_len = 600
        
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

    def _build_appendix_table(self):
        if not self.assumption_checks:
            return ""
            
        table_names = {
            0: "1. Audio Effect (Silent vs Audio)",
            1: "2. Resolution Effect (1080p vs 720p)",
            2: "3. Content Effect (Slide vs Video)"
        }
        
        html = "<h2>Appendix: Statistical Assumptions Checks</h2>"
        html += "<div class='appendix-note'><strong>Methodological Note on Low Sample Size Limitation:</strong> Given the small run-level sample sizes (n=4–5 per condition), formal normality tests (Shapiro–Wilk) and homogeneity of variance tests (Levene) have limited statistical power and were used only as a supplementary check rather than a definitive decision criterion. Welch's t-test was preferred throughout for independent tests as it does not assume equal variances and is highly robust to minor departures from normality.</div>"
        
        html += """<table class='scientific-table appendix-table'>
        <thead>
            <tr>
                <th>Factor Table</th>
                <th>Sub Scenario</th>
                <th>Metric</th>
                <th>Shapiro-Wilk G1 (p)</th>
                <th>Normality G1?</th>
                <th>Shapiro-Wilk G2 (p)</th>
                <th>Normality G2?</th>
                <th>Levene Test (p)</th>
                <th>Equal Variances?</th>
            </tr>
        </thead>
        <tbody>"""
        
        for check in self.assumption_checks:
            t_name = table_names.get(check["table"], f"Table {check['table']}")
            
            p1 = check["p_shapi1"]
            p2 = check["p_shapi2"]
            pl = check["p_levene"]
            
            p1_str = f"{p1:.4f}" if not np.isnan(p1) else "N/A"
            p2_str = f"{p2:.4f}" if not np.isnan(p2) else "N/A"
            pl_str = f"{pl:.4f}" if not np.isnan(pl) else "N/A"
            
            norm1 = "Passed" if (not np.isnan(p1) and p1 > 0.05) else ("Failed" if not np.isnan(p1) else "N/A")
            norm2 = "Passed" if (not np.isnan(p2) and p2 > 0.05) else ("Failed" if not np.isnan(p2) else "N/A")
            equal_var = "Passed" if (not np.isnan(pl) and pl > 0.05) else ("Failed" if not np.isnan(pl) else "N/A")
            
            style_norm1 = "color:green;font-weight:bold" if norm1 == "Passed" else ("color:#e74c3c" if norm1 == "Failed" else "color:gray")
            style_norm2 = "color:green;font-weight:bold" if norm2 == "Passed" else ("color:#e74c3c" if norm2 == "Failed" else "color:gray")
            style_equal = "color:green;font-weight:bold" if equal_var == "Passed" else ("color:#e74c3c" if equal_var == "Failed" else "color:gray")
            
            html += f"""<tr>
                <td class='group-header'>{t_name}</td>
                <td>{check['group']}</td>
                <td>{check['metric']}</td>
                <td>{p1_str}</td>
                <td style='{style_norm1}'>{norm1}</td>
                <td>{p2_str}</td>
                <td style='{style_norm2}'>{norm2}</td>
                <td>{pl_str}</td>
                <td style='{style_equal}'>{equal_var}</td>
            </tr>"""
            
        html += "</tbody></table>"
        return html

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
    .appendix-note {{ background: #fdf2e2; border-left: 6px solid #f39c12; padding: 15px; margin-bottom: 20px; font-size: 13.5px; border-radius: 4px; color: #7f8c8d; }}
    .appendix-table th {{ background: #d35400; border: 1px solid #a04000; }}
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
    import sys
    import json
    if len(sys.argv) > 1 and sys.argv[1] == "backup":
        gen = ScientificReportGenerator()
        df, df_lat = gen.load_data()
        s1 = gen.run_ttest(df, "AudioStatus", "sessiz", "sesli", ["Resolution", "ContentType"], paired=True)
        s2 = gen.run_ttest(df, "Resolution", "1080p", "720p", ["ContentType", "AudioStatus"], paired=False)
        s3 = gen.run_ttest(df, "ContentType", "slayt", "video", ["Resolution", "AudioStatus"], paired=False)
        backup_data = {
            "Audio": s1,
            "Resolution": s2,
            "Content": s3
        }
        with open("stats_backup.json", "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=4)
        print("Stats backup successfully saved to stats_backup.json")
        sys.exit(0)

    view = 10
    if len(sys.argv) > 1:
        try:
            view = int(sys.argv[1])
        except ValueError:
            pass
    if view not in (10, 50):
        print("Usage: python report_generator.py [10|50|backup]")
        sys.exit(1)
    gen = ScientificReportGenerator()
    gen.generate_report(view_mode=view)