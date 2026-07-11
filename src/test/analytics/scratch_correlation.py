import pandas as pd
import numpy as np

# Load data
csv_path = r"../receiver/benchmark_log.csv"
df = pd.read_csv(csv_path)

# Calculate instantaneous video loss rates (since Video_Loss in CSV is cumulative)
df['Instant_Loss'] = df.groupby(['Mode', 'Iteration'])['Video_Loss'].diff().fillna(0).clip(lower=0)

# Calculate correlation for each mode/scenario
print("--- Pearson Correlation between FPS and Instant_Loss by Mode ---")
for mode in sorted(df['Mode'].unique()):
    sub = df[df['Mode'] == mode]
    # Remove NaN or infinite values
    sub = sub.dropna(subset=['FPS', 'Instant_Loss'])
    if len(sub) > 1:
        corr = sub['FPS'].corr(sub['Instant_Loss'])
        print(f"Mode: {mode:<30} | Correlation: {corr:.4f} | Samples: {len(sub)}")

# Calculate overall correlation
overall_corr = df['FPS'].corr(df['Instant_Loss'])
print(f"\nOverall Pearson Correlation across all data points: {overall_corr:.4f}")
