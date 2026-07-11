import pandas as pd
import numpy as np
from scipy import stats

# 1. Load raw data
df_raw = pd.read_csv("benchmark_log.csv")

def parse_mode(mode):
    p = str(mode).split("_")
    if len(p) >= 3: return p[0], p[1], p[2]
    return "unknown", "unknown", "unknown"

df_raw["Resolution"], df_raw["ContentType"], df_raw["AudioStatus"] = zip(*df_raw["Mode"].apply(parse_mode))
df_raw["Video_Jitter(ms)"] = df_raw["Video_Jitter(ns)"] / 1_000_000.0

# 2. Check time difference spacing
df_raw["ParsedTime"] = pd.to_datetime(df_raw["Timestamp"], format="%H:%M:%S", errors="coerce")
time_diffs = df_raw.groupby(["Mode", "Iteration"])["ParsedTime"].diff().dt.total_seconds().dropna()
print("Time diffs between consecutive rows (value counts):")
print(time_diffs.value_counts().head())

# 3. Calculate 1080p Slide with Audio Video_Loss math specifically
# Mode: 1080p_slayt_sesli
mode_target = "1080p_slayt_sesli"

# Raw cumulative Video_Loss across all iterations
sub_all = df_raw[df_raw["Mode"] == mode_target]
print(f"\n[{mode_target}] Raw Cumulative Stats (All 5 Iterations, with FPS > 0):")
sub_all_fps = sub_all[sub_all["FPS"] > 0]
print(f"  Count (n): {len(sub_all_fps)}")
print(f"  Mean of cumulative: {sub_all_fps['Video_Loss'].mean():.4f}")
print(f"  SD of cumulative: {sub_all_fps['Video_Loss'].std():.4f}")

# Filter Iteration 3 and convert to diff
df_filtered = df_raw.copy()
df_filtered = df_filtered.sort_values(by=["Mode", "Iteration", "Timestamp"])
df_filtered["Video_Loss_Diff"] = df_filtered.groupby(["Mode", "Iteration"])["Video_Loss"].diff().fillna(0).clip(lower=0)

# Filtered data (excl. Iteration 3)
sub_filtered = df_filtered[(df_filtered["Mode"] == mode_target) & (df_filtered["Iteration"] != 3)]
sub_filtered_fps = sub_filtered[sub_filtered["FPS"] > 0]
print(f"\n[{mode_target}] Corrected Diff Stats (Excluding Iteration 3, FPS > 0):")
print(f"  Count (n): {len(sub_filtered_fps)}")
print(f"  Mean of diff: {sub_filtered_fps['Video_Loss_Diff'].mean():.4f}")
print(f"  SD of diff: {sub_filtered_fps['Video_Loss_Diff'].std():.4f}")

# 4. Verify Jitter before and after
sub_all_jitter = sub_all_fps["Video_Jitter(ms)"]
sub_filtered_jitter = sub_filtered_fps["Video_Jitter(ms)"]
print(f"\n[{mode_target}] Video Jitter Comparison:")
print(f"  Before (All 5 iterations) Mean: {sub_all_jitter.mean():.4f} +/- {sub_all_jitter.std():.4f}")
print(f"  After (Excl. Iteration 3) Mean: {sub_filtered_jitter.mean():.4f} +/- {sub_filtered_jitter.std():.4f}")
