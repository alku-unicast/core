# UniCast QoE Platform Comparison Report

This report presents the statistical comparison of connection establishment latency (time until the first frame is rendered) between Windows and Linux sender environments.

## Descriptive Statistics

| Platform | Sample Size (N) | Mean Ready Time (s) | Std Dev (s) |
| :--- | :---: | :---: | :---: |
| Windows (win32) | 30 | 3.5497 s | 0.0462 s |
| Linux (linux) | 30 | 3.2334 s | 0.0478 s |

## Inferential Statistics (Welch's t-test)

- **t-statistic:** `26.0552`
- **p-value:** `1.1065e-33` (p < 0.001)
- **Interpretation:** The difference is statistically significant. The Linux sender establishes connections faster on average.

### Thesis-Ready LaTeX / Table format
```markdown
| Platform | N | Mean latency (s) | SD (s) | t-value | p-value | Significance |
|---|---|---|---|---|---|---|
| Windows | 30 | 3.550 | 0.046 | 26.055 | < 0.001 | Yes (p < 0.05) |
| Linux   | 30 | 3.233 | 0.048 | | | |
```
