import re
import csv
from collections import defaultdict
from datetime import datetime

SCENARIOS = [
    "1080p_slayt_sessiz", 
    "1080p_slayt_sesli", 
    "1080p_video_sessiz", 
    "1080p_video_sesli", 
    "720p_slayt_sessiz", 
    "720p_slayt_sesli", 
    "720p_video_sessiz", 
    "720p_video_sesli"
]

def parse_cikti_log(log_path):
    timestamp_to_scenario = {}
    with open(log_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern: [HH:MM:SS] === TUR X/5 - SENARYO: name (N/40) ===
    pattern = r'\[(\d{2}:\d{2}:\d{2})\]\s*===.*SENARYO:\s*([a-z0-9p_]+)'
    matches = re.finditer(pattern, content)
    
    for match in matches:
        ts_str = match.group(1)
        scenario = match.group(2)
        timestamp_to_scenario[ts_str] = scenario
    
    print(f"Parsed {len(timestamp_to_scenario)} timestamp-scenario mappings from log")
    return timestamp_to_scenario

def fix_csv(csv_path, log_path, output_path):
    timestamp_to_scenario = parse_cikti_log(log_path)
    
    # Read CSV
    rows = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    fixed_rows = []
    fixed_count = 0
    for row in rows:
        if len(row) >= 3:
            timestamp = row[0].split(',')[0]  # Extract timestamp from first field
            if timestamp in timestamp_to_scenario:
                # Replace scenario with correct one
                correct_scenario = timestamp_to_scenario[timestamp]
                row[1] = correct_scenario
                fixed_count += 1
            fixed_rows.append(row)
    
    print(f"Fixed {fixed_count} rows with matching timestamps")
    
    # Write fixed CSV
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerows(fixed_rows)
    
    print(f"Fixed CSV saved to {output_path}")

if __name__ == "__main__":
    csv_path = "src/test/latency_log.csv"
    log_path = "src/test/cikti.txt"
    output_path = "src/test/latency_log_fixed.csv"
    
    fix_csv(csv_path, log_path, output_path)
    print("Processing complete. Check latency_log_fixed.csv")
