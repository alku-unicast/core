# UniCast Final Report - Statistical Analysis Tables

These tables show the final statistical comparisons computed with the hybrid model:
- **Audio Effect:** Paired T-Test (`scipy.stats.ttest_rel`)
- **Resolution and Content Effects:** Welch's Independent T-Test (`scipy.stats.ttest_ind` with `equal_var=False`)
- **Outliers:** network outage window (00:23:00 to 01:26:30) excluded using robust datetime comparison.

## 1. Audio Effect (Silent vs Audio)

| Sub Scenario | Metric | Silent (Mean±SD) | Audio (Mean±SD) | Mean Diff | % Change (vs. Audio) | 95% CI (of Diff) | n1 | n2 | t | Raw p | Adj p (Holm) | Cohen's d | Sig? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1080p Slide | FPS | 14.902±0.048 | 14.847±0.146 | 0.055 | +0.37% | [-0.193, 0.303] | 4 | 4 | 0.707 | 0.5306 | 1.0000 | 0.508 | No |
| Video_Jitter(ms) | 0.382±0.042 | 0.528±0.029 | -0.146 | -27.70% | [-0.194, -0.098] | 4 | 4 | -9.679 | 0.0023 | 0.0445 | -4.051 | Yes (p_adj<0.05) |
| Video_Loss | 0.876±0.513 | 1.580±0.283 | -0.704 | -44.55% | [-1.424, 0.016] | 4 | 4 | -3.112 | 0.0528 | 0.5810 | -1.700 | No |
| CPU_Usage(%) | 11.529±0.225 | 12.641±0.379 | -1.112 | -8.80% | [-1.860, -0.365] | 4 | 4 | -4.737 | 0.0178 | 0.2497 | -3.565 | No |
| Throughput(kbps) | 4943.688±146.118 | 4996.676±52.482 | -52.988 | -1.06% | [-204.502, 98.525] | 4 | 4 | -1.113 | 0.3469 | 1.0000 | -0.483 | No |
| 1080p Video | FPS | 29.742±0.104 | 29.641±0.220 | 0.101 | +0.34% | [-0.360, 0.562] | 4 | 4 | 0.697 | 0.5360 | 1.0000 | 0.588 | No |
| Video_Jitter(ms) | 0.748±0.025 | 0.950±0.030 | -0.202 | -21.22% | [-0.287, -0.116] | 4 | 4 | -7.505 | 0.0049 | 0.0833 | -7.263 | No |
| Video_Loss | 1.336±0.552 | 1.660±0.683 | -0.324 | -19.52% | [-0.659, 0.010] | 4 | 4 | -3.083 | 0.0540 | 0.5810 | -0.522 | No |
| CPU_Usage(%) | 18.737±0.176 | 19.347±0.271 | -0.610 | -3.15% | [-0.981, -0.240] | 4 | 4 | -5.241 | 0.0135 | 0.2028 | -2.670 | No |
| Throughput(kbps) | 4025.323±16.224 | 3946.823±121.048 | 78.500 | +1.99% | [-108.613, 265.613] | 4 | 4 | 1.335 | 0.2741 | 1.0000 | 0.909 | No |
| 720p Slide | FPS | 14.890±0.091 | 14.929±0.011 | -0.039 | -0.26% | [-0.176, 0.098] | 4 | 4 | -0.910 | 0.4298 | 1.0000 | -0.600 | No |
| Video_Jitter(ms) | 0.376±0.032 | 0.502±0.031 | -0.126 | -25.11% | [-0.189, -0.063] | 4 | 4 | -6.343 | 0.0079 | 0.1268 | -3.978 | No |
| Video_Loss | 0.621±0.141 | 1.305±0.542 | -0.684 | -52.42% | [-1.330, -0.039] | 4 | 4 | -3.372 | 0.0433 | 0.5200 | -1.727 | No |
| CPU_Usage(%) | 11.408±0.200 | 12.187±0.229 | -0.779 | -6.39% | [-1.455, -0.102] | 4 | 4 | -3.663 | 0.0352 | 0.4573 | -3.627 | No |
| Throughput(kbps) | 5015.678±28.925 | 4898.694±241.915 | 116.984 | +2.39% | [-302.636, 536.604] | 4 | 4 | 0.887 | 0.4403 | 1.0000 | 0.679 | No |
| 720p Video | FPS | 29.685±0.255 | 29.749±0.206 | -0.063 | -0.21% | [-0.471, 0.345] | 5 | 5 | -0.430 | 0.6891 | 1.0000 | -0.273 | No |
| Video_Jitter(ms) | 0.687±0.011 | 0.916±0.027 | -0.229 | -25.02% | [-0.261, -0.198] | 5 | 5 | -20.387 | p < .001 | p < .001 | -11.034 | Yes (p_adj<0.05) |
| Video_Loss | 1.220±0.499 | 1.476±0.492 | -0.256 | -17.34% | [-0.546, 0.034] | 5 | 5 | -2.452 | 0.0703 | 0.6329 | -0.516 | No |
| CPU_Usage(%) | 15.565±0.202 | 16.579±0.339 | -1.014 | -6.11% | [-1.492, -0.536] | 5 | 5 | -5.886 | 0.0042 | 0.0750 | -3.633 | No |
| Throughput(kbps) | 4019.543±12.314 | 4018.841±19.527 | 0.701 | +0.02% | [-24.602, 26.004] | 5 | 5 | 0.077 | 0.9424 | 1.0000 | 0.043 | No |

## 2. Resolution Effect (1080p vs 720p)

| Sub Scenario | Metric | 1080p (Mean±SD) | 720p (Mean±SD) | Mean Diff | % Change (vs. 720p) | 95% CI (of Diff) | n1 | n2 | t | Raw p | Adj p (Holm) | Cohen's d | Sig? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Slide with Audio | FPS | 14.847±0.146 | 14.929±0.011 | -0.082 | -0.55% | [-0.313, 0.149] | 4 | 4 | -1.123 | 0.3423 | 1.0000 | -0.794 | No |
| Video_Jitter(ms) | 0.528±0.029 | 0.502±0.031 | 0.027 | +5.30% | [-0.025, 0.078] | 4 | 4 | 1.258 | 0.2553 | 1.0000 | 0.890 | No |
| Video_Loss | 1.580±0.283 | 1.305±0.542 | 0.275 | +21.06% | [-0.537, 1.087] | 4 | 4 | 0.899 | 0.4140 | 1.0000 | 0.636 | No |
| CPU_Usage(%) | 12.641±0.379 | 12.187±0.229 | 0.455 | +3.73% | [-0.117, 1.027] | 4 | 4 | 2.053 | 0.0961 | 1.0000 | 1.452 | No |
| Throughput(kbps) | 4996.676±52.482 | 4898.694±241.915 | 97.982 | +2.00% | [-277.456, 473.419] | 4 | 4 | 0.792 | 0.4818 | 1.0000 | 0.560 | No |
| Slide without Audio | FPS | 14.902±0.048 | 14.890±0.091 | 0.012 | +0.08% | [-0.125, 0.149] | 4 | 4 | 0.234 | 0.8248 | 1.0000 | 0.166 | No |
| Video_Jitter(ms) | 0.382±0.042 | 0.376±0.032 | 0.006 | +1.66% | [-0.060, 0.072] | 4 | 4 | 0.235 | 0.8223 | 1.0000 | 0.166 | No |
| Video_Loss | 0.876±0.513 | 0.621±0.141 | 0.255 | +41.07% | [-0.532, 1.042] | 4 | 4 | 0.959 | 0.3998 | 1.0000 | 0.678 | No |
| CPU_Usage(%) | 11.529±0.225 | 11.408±0.200 | 0.121 | +1.06% | [-0.249, 0.491] | 4 | 4 | 0.804 | 0.4526 | 1.0000 | 0.568 | No |
| Throughput(kbps) | 4943.688±146.118 | 5015.678±28.925 | -71.990 | -1.44% | [-299.569, 155.588] | 4 | 4 | -0.967 | 0.4003 | 1.0000 | -0.683 | No |
| Video with Audio | FPS | 29.641±0.220 | 29.749±0.206 | -0.108 | -0.36% | [-0.454, 0.238] | 4 | 5 | -0.752 | 0.4789 | 1.0000 | -0.509 | No |
| Video_Jitter(ms) | 0.950±0.030 | 0.916±0.027 | 0.034 | +3.66% | [-0.014, 0.081] | 4 | 5 | 1.726 | 0.1340 | 1.0000 | 1.175 | No |
| Video_Loss | 1.660±0.683 | 1.476±0.492 | 0.184 | +12.43% | [-0.842, 1.209] | 4 | 5 | 0.452 | 0.6694 | 1.0000 | 0.315 | No |
| CPU_Usage(%) | 19.347±0.271 | 16.579±0.339 | 2.768 | +16.70% | [2.287, 3.249] | 4 | 5 | 13.610 | p < .001 | p < .001 | 8.879 | Yes (p_adj<0.05) |
| Throughput(kbps) | 3946.823±121.048 | 4018.841±19.527 | -72.018 | -1.79% | [-262.290, 118.253] | 4 | 5 | -1.178 | 0.3208 | 1.0000 | -0.893 | No |
| Video without Audio | FPS | 29.742±0.104 | 29.685±0.255 | 0.056 | +0.19% | [-0.257, 0.370] | 4 | 5 | 0.450 | 0.6696 | 1.0000 | 0.276 | No |
| Video_Jitter(ms) | 0.748±0.025 | 0.687±0.011 | 0.061 | +8.92% | [0.024, 0.098] | 4 | 5 | 4.575 | 0.0101 | 0.1811 | 3.336 | No |
| Video_Loss | 1.336±0.552 | 1.220±0.499 | 0.115 | +9.46% | [-0.747, 0.977] | 4 | 5 | 0.325 | 0.7559 | 1.0000 | 0.221 | No |
| CPU_Usage(%) | 18.737±0.176 | 15.565±0.202 | 3.172 | +20.38% | [2.873, 3.471] | 4 | 5 | 25.172 | p < .001 | p < .001 | 16.596 | Yes (p_adj<0.05) |
| Throughput(kbps) | 4025.323±16.224 | 4019.543±12.314 | 5.780 | +0.14% | [-18.723, 30.283] | 4 | 5 | 0.590 | 0.5788 | 1.0000 | 0.409 | No |

## 3. Content Effect (Slide vs Video)

| Sub Scenario | Metric | Slide (Mean±SD) | Video (Mean±SD) | Mean Diff | % Change (vs. Video) | 95% CI (of Diff) | n1 | n2 | t | Raw p | Adj p (Holm) | Cohen's d | Sig? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1080p with Audio | FPS | 14.847±0.146 | 29.641±0.220 | -14.793 | -49.91% | [-15.128, -14.459] | 4 | 4 | -112.246 | p < .001 | p < .001 | -79.370 | Yes (p_adj<0.05) |
| Video_Jitter(ms) | 0.528±0.029 | 0.950±0.030 | -0.422 | -44.39% | [-0.473, -0.370] | 4 | 4 | -20.119 | p < .001 | p < .001 | -14.227 | Yes (p_adj<0.05) |
| Video_Loss | 1.580±0.283 | 1.660±0.683 | -0.080 | -4.82% | [-1.106, 0.946] | 4 | 4 | -0.216 | 0.8393 | 1.0000 | -0.153 | No |
| CPU_Usage(%) | 12.641±0.379 | 19.347±0.271 | -6.706 | -34.66% | [-7.291, -6.120] | 4 | 4 | -28.758 | p < .001 | p < .001 | -20.335 | Yes (p_adj<0.05) |
| Throughput(kbps) | 4996.676±52.482 | 3946.823±121.048 | 1049.853 | +26.60% | [868.265, 1231.441] | 4 | 4 | 15.915 | p < .001 | p < .001 | 11.253 | Yes (p_adj<0.05) |
| 1080p without Audio | FPS | 14.902±0.048 | 29.742±0.104 | -14.839 | -49.89% | [-14.995, -14.684] | 4 | 4 | -259.793 | p < .001 | p < .001 | -183.702 | Yes (p_adj<0.05) |
| Video_Jitter(ms) | 0.382±0.042 | 0.748±0.025 | -0.366 | -48.96% | [-0.430, -0.303] | 4 | 4 | -14.983 | p < .001 | p < .001 | -10.595 | Yes (p_adj<0.05) |
| Video_Loss | 0.876±0.513 | 1.336±0.552 | -0.460 | -34.42% | [-1.383, 0.464] | 4 | 4 | -1.220 | 0.2684 | 0.8053 | -0.863 | No |
| CPU_Usage(%) | 11.529±0.225 | 18.737±0.176 | -7.208 | -38.47% | [-7.563, -6.853] | 4 | 4 | -50.442 | p < .001 | p < .001 | -35.668 | Yes (p_adj<0.05) |
| Throughput(kbps) | 4943.688±146.118 | 4025.323±16.224 | 918.365 | +22.81% | [687.581, 1149.148] | 4 | 4 | 12.493 | p < .001 | 0.0059 | 8.834 | Yes (p_adj<0.05) |
| 720p with Audio | FPS | 14.929±0.011 | 29.749±0.206 | -14.819 | -49.81% | [-15.074, -14.564] | 4 | 5 | -160.690 | p < .001 | p < .001 | -95.134 | Yes (p_adj<0.05) |
| Video_Jitter(ms) | 0.502±0.031 | 0.916±0.027 | -0.415 | -45.25% | [-0.463, -0.367] | 4 | 5 | -21.095 | p < .001 | p < .001 | -14.395 | Yes (p_adj<0.05) |
| Video_Loss | 1.305±0.542 | 1.476±0.492 | -0.171 | -11.60% | [-1.018, 0.676] | 4 | 5 | -0.491 | 0.6406 | 1.0000 | -0.333 | No |
| CPU_Usage(%) | 12.187±0.229 | 16.579±0.339 | -4.392 | -26.49% | [-4.843, -3.941] | 4 | 5 | -23.127 | p < .001 | p < .001 | -14.796 | Yes (p_adj<0.05) |
| Throughput(kbps) | 4898.694±241.915 | 4018.841±19.527 | 879.853 | +21.89% | [496.154, 1263.552] | 4 | 5 | 7.255 | 0.0052 | 0.0261 | 5.532 | Yes (p_adj<0.05) |
| 720p without Audio | FPS | 14.890±0.091 | 29.685±0.255 | -14.795 | -49.84% | [-15.107, -14.483] | 4 | 5 | -120.433 | p < .001 | p < .001 | -73.309 | Yes (p_adj<0.05) |
| Video_Jitter(ms) | 0.376±0.032 | 0.687±0.011 | -0.311 | -45.31% | [-0.361, -0.262] | 4 | 5 | -18.359 | p < .001 | p < .001 | -13.614 | Yes (p_adj<0.05) |
| Video_Loss | 0.621±0.141 | 1.220±0.499 | -0.599 | -49.11% | [-1.210, 0.011] | 4 | 5 | -2.558 | 0.0530 | 0.2118 | -1.542 | No |
| CPU_Usage(%) | 11.408±0.200 | 15.565±0.202 | -4.157 | -26.71% | [-4.479, -3.835] | 4 | 5 | -30.874 | p < .001 | p < .001 | -20.685 | Yes (p_adj<0.05) |
| Throughput(kbps) | 5015.678±28.925 | 4019.543±12.314 | 996.135 | +24.78% | [952.602, 1039.669] | 4 | 5 | 64.368 | p < .001 | p < .001 | 47.210 | Yes (p_adj<0.05) |

## Table 4

| Factor Table | Sub Scenario | Metric | Shapiro-Wilk G1 (p) | Normality G1? | Shapiro-Wilk G2 (p) | Normality G2? | Levene Test (p) | Equal Variances? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Audio Effect (Silent vs Audio) | 1080p Slide | FPS | 0.4324 | Passed | 0.0094 | Failed | 0.5070 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Slide | Video_Jitter(ms) | 0.8406 | Passed | 0.0169 | Failed | 0.4456 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Slide | Video_Loss | 0.8514 | Passed | 0.7228 | Passed | 0.3163 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Slide | CPU_Usage(%) | 0.3345 | Passed | 0.3260 | Passed | 0.5346 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Slide | Throughput(kbps) | 0.0338 | Failed | 0.0384 | Failed | 0.4534 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Video | FPS | 0.0478 | Failed | 0.1961 | Passed | 0.4080 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Video | Video_Jitter(ms) | 0.9237 | Passed | 0.0491 | Failed | 0.2440 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Video | Video_Loss | 0.0590 | Passed | 0.0475 | Failed | 0.8664 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Video | CPU_Usage(%) | 0.5990 | Passed | 0.6714 | Passed | 0.7916 | Passed |
| 1. Audio Effect (Silent vs Audio) | 1080p Video | Throughput(kbps) | 0.3364 | Passed | 0.0152 | Failed | 0.3610 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Slide | FPS | 0.0260 | Failed | 0.5607 | Passed | 0.3089 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Slide | Video_Jitter(ms) | 0.4849 | Passed | 0.0773 | Passed | 0.7117 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Slide | Video_Loss | 0.1598 | Passed | 0.1731 | Passed | 0.1955 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Slide | CPU_Usage(%) | 0.4972 | Passed | 0.1142 | Passed | 0.8288 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Slide | Throughput(kbps) | 0.8066 | Passed | 0.0054 | Failed | 0.3997 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Video | FPS | 0.0252 | Failed | 0.0007 | Failed | 0.7261 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Video | Video_Jitter(ms) | 0.6487 | Passed | 0.3515 | Passed | 0.4535 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Video | Video_Loss | 0.0584 | Passed | 0.0376 | Failed | 0.9853 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Video | CPU_Usage(%) | 0.9136 | Passed | 0.5989 | Passed | 0.3119 | Passed |
| 1. Audio Effect (Silent vs Audio) | 720p Video | Throughput(kbps) | 0.7446 | Passed | 0.0265 | Failed | 0.8261 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide with Audio | FPS | 0.0094 | Failed | 0.5607 | Passed | 0.3473 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide with Audio | Video_Jitter(ms) | 0.0169 | Failed | 0.0773 | Passed | 0.4501 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide with Audio | Video_Loss | 0.7228 | Passed | 0.1731 | Passed | 0.3863 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide with Audio | CPU_Usage(%) | 0.3260 | Passed | 0.1142 | Passed | 0.5936 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide with Audio | Throughput(kbps) | 0.0384 | Failed | 0.0054 | Failed | 0.4352 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide without Audio | FPS | 0.4324 | Passed | 0.0260 | Failed | 0.5903 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide without Audio | Video_Jitter(ms) | 0.8406 | Passed | 0.4849 | Passed | 0.6360 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide without Audio | Video_Loss | 0.8514 | Passed | 0.1598 | Passed | 0.1220 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide without Audio | CPU_Usage(%) | 0.3345 | Passed | 0.4972 | Passed | 0.9303 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Slide without Audio | Throughput(kbps) | 0.0338 | Failed | 0.8066 | Passed | 0.3805 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video with Audio | FPS | 0.1961 | Passed | 0.0007 | Failed | 0.7128 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video with Audio | Video_Jitter(ms) | 0.0491 | Failed | 0.3515 | Passed | 0.3639 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video with Audio | Video_Loss | 0.0475 | Failed | 0.0376 | Failed | 0.8159 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video with Audio | CPU_Usage(%) | 0.6714 | Passed | 0.5989 | Passed | 0.5338 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video with Audio | Throughput(kbps) | 0.0152 | Failed | 0.0265 | Failed | 0.3118 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video without Audio | FPS | 0.0478 | Failed | 0.0252 | Failed | 0.5061 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video without Audio | Video_Jitter(ms) | 0.9237 | Passed | 0.6487 | Passed | 0.0936 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video without Audio | Video_Loss | 0.0590 | Passed | 0.0584 | Passed | 0.9683 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video without Audio | CPU_Usage(%) | 0.5990 | Passed | 0.9136 | Passed | 0.9864 | Passed |
| 2. Resolution Effect (1080p vs 720p) | Video without Audio | Throughput(kbps) | 0.3364 | Passed | 0.7446 | Passed | 0.9215 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p with Audio | FPS | 0.0094 | Failed | 0.1961 | Passed | 0.5483 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p with Audio | Video_Jitter(ms) | 0.0169 | Failed | 0.0491 | Failed | 0.4639 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p with Audio | Video_Loss | 0.7228 | Passed | 0.0475 | Failed | 0.5414 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p with Audio | CPU_Usage(%) | 0.3260 | Passed | 0.6714 | Passed | 0.6557 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p with Audio | Throughput(kbps) | 0.0384 | Failed | 0.0152 | Failed | 0.5732 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p without Audio | FPS | 0.4324 | Passed | 0.0478 | Failed | 0.4885 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p without Audio | Video_Jitter(ms) | 0.8406 | Passed | 0.9237 | Passed | 0.4316 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p without Audio | Video_Loss | 0.8514 | Passed | 0.0590 | Passed | 0.8496 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p without Audio | CPU_Usage(%) | 0.3345 | Passed | 0.5990 | Passed | 0.9983 | Passed |
| 3. Content Effect (Slide vs Video) | 1080p without Audio | Throughput(kbps) | 0.0338 | Failed | 0.3364 | Passed | 0.2940 | Passed |
| 3. Content Effect (Slide vs Video) | 720p with Audio | FPS | 0.5607 | Passed | 0.0007 | Failed | 0.3999 | Passed |
| 3. Content Effect (Slide vs Video) | 720p with Audio | Video_Jitter(ms) | 0.0773 | Passed | 0.3515 | Passed | 0.3493 | Passed |
| 3. Content Effect (Slide vs Video) | 720p with Audio | Video_Loss | 0.1731 | Passed | 0.0376 | Failed | 0.7831 | Passed |
| 3. Content Effect (Slide vs Video) | 720p with Audio | CPU_Usage(%) | 0.1142 | Passed | 0.5989 | Passed | 0.4563 | Passed |
| 3. Content Effect (Slide vs Video) | 720p with Audio | Throughput(kbps) | 0.0054 | Failed | 0.0265 | Failed | 0.2890 | Passed |
| 3. Content Effect (Slide vs Video) | 720p without Audio | FPS | 0.0260 | Failed | 0.0252 | Failed | 0.4555 | Passed |
| 3. Content Effect (Slide vs Video) | 720p without Audio | Video_Jitter(ms) | 0.4849 | Passed | 0.6487 | Passed | 0.2124 | Passed |
| 3. Content Effect (Slide vs Video) | 720p without Audio | Video_Loss | 0.1598 | Passed | 0.0584 | Passed | 0.3416 | Passed |
| 3. Content Effect (Slide vs Video) | 720p without Audio | CPU_Usage(%) | 0.4972 | Passed | 0.9136 | Passed | 0.9264 | Passed |
| 3. Content Effect (Slide vs Video) | 720p without Audio | Throughput(kbps) | 0.8066 | Passed | 0.7446 | Passed | 0.0584 | Passed |

