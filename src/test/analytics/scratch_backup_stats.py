import json
import os
from report_generator import ScientificReportGenerator

# Initialize generator
generator = ScientificReportGenerator(
    benchmark_csv="../receiver/benchmark_log.csv",
    latency_csv="../sender/latency_log_partly_fixes.csv"
)

# Load data
df, df_lat = generator.load_data()

# Calculate raw results
s1 = generator.run_ttest(df, "AudioStatus", "sessiz", "sesli", ["Resolution", "ContentType"], paired=True)
s2 = generator.run_ttest(df, "Resolution", "1080p", "720p", ["ContentType", "AudioStatus"], paired=False)
s3 = generator.run_ttest(df, "ContentType", "slayt", "video", ["Resolution", "AudioStatus"], paired=False)

# Save backup
backup_data = {
    "Audio": s1,
    "Resolution": s2,
    "Content": s3
}

backup_path = "stats_backup.json"
with open(backup_path, "w", encoding="utf-8") as f:
    json.dump(backup_data, f, indent=4)

print(f"Stats backup successfully saved to {backup_path}")
