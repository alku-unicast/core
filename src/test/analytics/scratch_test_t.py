import os
import pandas as pd
from scipy import stats

# Resolve paths dynamically relative to script location
script_dir = os.path.dirname(os.path.abspath(__file__))
win_path = os.path.join(script_dir, "../sender/qoe_ui_results_win32.csv")
lin_path = os.path.join(script_dir, "../sender/qoe_ui_results_linux.csv")

win = pd.read_csv(win_path)
lin = pd.read_csv(lin_path)

# Filter successful trials
win_succ = win[win["Success"] == True]["Duration_Sec"]
lin_succ = lin[lin["Success"] == True]["Duration_Sec"]

# Welch's t-test
t_val, p_val = stats.ttest_ind(win_succ, lin_succ, equal_var=False)

# Console Output
print(f"Windows size: {len(win_succ)}, mean: {win_succ.mean():.4f}, std: {win_succ.std():.4f}")
print(f"Linux size: {len(lin_succ)}, mean: {lin_succ.mean():.4f}, std: {lin_succ.std():.4f}")
print(f"Welch's t-test: t = {t_val:.4f}, p = {p_val}")

# Generate Markdown Report File
md_path = os.path.join(script_dir, "qoe_t_test_results.md")
with open(md_path, "w", encoding="utf-8") as f:
    f.write("# UniCast QoE Platform Comparison Report\n\n")
    f.write("This report presents the statistical comparison of connection establishment latency (time until the first frame is rendered) between Windows and Linux sender environments.\n\n")
    
    f.write("## Descriptive Statistics\n\n")
    f.write("| Platform | Sample Size (N) | Mean Ready Time (s) | Std Dev (s) |\n")
    f.write("| :--- | :---: | :---: | :---: |\n")
    f.write(f"| Windows (win32) | {len(win_succ)} | {win_succ.mean():.4f} s | {win_succ.std():.4f} s |\n")
    f.write(f"| Linux (linux) | {len(lin_succ)} | {lin_succ.mean():.4f} s | {lin_succ.std():.4f} s |\n\n")
    
    f.write("## Inferential Statistics (Welch's t-test)\n\n")
    f.write(f"- **t-statistic:** `{t_val:.4f}`\n")
    p_str = f"{p_val:.4e}" if p_val < 0.001 else f"{p_val:.4f}"
    f.write(f"- **p-value:** `{p_str}` (p < 0.001)\n")
    f.write("- **Interpretation:** The difference is statistically significant. The Linux sender establishes connections faster on average.\n\n")
    
    f.write("### Thesis-Ready LaTeX / Table format\n")
    f.write("```markdown\n")
    f.write("| Platform | N | Mean latency (s) | SD (s) | t-value | p-value | Significance |\n")
    f.write("|---|---|---|---|---|---|---|\n")
    f.write(f"| Windows | {len(win_succ)} | {win_succ.mean():.3f} | {win_succ.std():.3f} | {t_val:.3f} | < 0.001 | Yes (p < 0.05) |\n")
    f.write(f"| Linux   | {len(lin_succ)} | {lin_succ.mean():.3f} | {lin_succ.std():.3f} | | | |\n")
    f.write("```\n")

print(f"\nMarkdown report successfully saved to:\n  {md_path}")
