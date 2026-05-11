# UniCast — Performance Testing Guide

This directory contains the autonomous benchmark infrastructure used to measure UniCast network latency (RTT) and video transmission stability.

---

## Directory Structure

```text
src/test/
├── sender/
│   ├── run_benchmarks.ps1          ← Windows master: coordinates the Pi, starts GStreamer pipelines
│   ├── fix_latency_scenarios.py    ← CSV cleanup script (fixes Turkish decimal commas)
│   └── latency_log_partly_fixes.csv ← Example partially fixed latency dataset
├── receiver/
│   ├── pi_orchestrator.py          ← Pi slave: TCP server, starts GStreamer receiver based on commands
│   ├── run_benchmarks.sh           ← Starts the orchestrator on the Pi
│   └── benchmark_log.csv           ← RTT data collected on the Pi (updated after each round)
└── analytics/
    ├── report_generator.py         ← Generates scientific HTML reports from CSV datasets
    └── unicast_final_report.html   ← Example report generated from a previous benchmark
```

---

## How the System Works

The benchmark system uses a **Master-Slave** architecture:

```text
Windows (Master)                     Raspberry Pi (Slave)
─────────────────                    ────────────────────
run_benchmarks.ps1
    │
    │  TCP:5010  PREPARE:<scenario>
    ├─────────────────────────────→  pi_orchestrator.py
    │                                    └─ Starts GStreamer receiver
    │  TCP:5010  READY
    ←─────────────────────────────┤
    │
    ├─ Starts GStreamer sender
    ├─ Measures UDP RTT (port 5005)
    ├─ Writes latency results to CSV
    │
    │  TCP:5010  STOP
    ├─────────────────────────────→  Stops GStreamer receiver
    │  TCP:5010  DONE
    ←─────────────────────────────┤
    │
    └─ Next scenario...
```

After each scenario is completed, the Windows side writes RTT measurements into `latency_log.csv`.
The Pi side writes its own statistics into `benchmark_log.csv`.

---

## Prerequisites

### Windows (Sender)

* PowerShell 7+ (included with Windows 10/11)
* GStreamer installed and available in PATH: `gst-launch-1.0.exe` must be accessible

  * Alternatively, `gst-launch-1.0.exe` can be placed in the same directory as `run_benchmarks.ps1`

### Raspberry Pi (Receiver)

```bash
sudo apt install -y python3 gstreamer1.0-tools gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly
```

---

## Running the Benchmarks

### Step 1 — Start the Orchestrator on the Pi

Navigate to the test directory on the Pi and start the orchestrator:

```bash
cd src/test/receiver
bash run_benchmarks.sh
```

Output:

```text
=== UniCast Pi Benchmark Orchestrator ===
Starting in TCP Server mode...
Press Ctrl+C to stop
[12:00:00] TCP server started, listening on port 5010...
```

### Step 2 — Start the Benchmark on Windows

Open `run_benchmarks.ps1` and edit the Pi IP address:

```powershell
$PI_IP = "10.50.21.183"   # Replace with the actual Pi IP address
```

Then run it in PowerShell:

```powershell
cd src\test\sender
.\run_benchmarks.ps1
```

Output:

```text
=== UniCast Autonomous Benchmark System (TCP Handshake) ===
Detected Source: d3d11screencapturesrc
Pi IP: 10.50.21.183 | Control Port: 5010
Total: 8 scenarios x 2 iterations = 16 rounds

[12:00:05] === ROUND 1/2 - SCENARIO: 1080p_slides_silent (1/16) ===
...
```

---

## Test Scenarios

By default, the benchmark runs **8 scenarios × 2 iterations = 16 rounds**:

| Scenario              | Resolution | FPS | Audio |
| --------------------- | ---------- | --- | ----- |
| `1080p_slides_silent` | 1920×1080  | 15  | No    |
| `1080p_slides_audio`  | 1920×1080  | 15  | Yes   |
| `1080p_video_silent`  | 1920×1080  | 30  | No    |
| `1080p_video_audio`   | 1920×1080  | 30  | Yes   |
| `720p_slides_silent`  | 1280×720   | 15  | No    |
| `720p_slides_audio`   | 1280×720   | 15  | Yes   |
| `720p_video_silent`   | 1280×720   | 30  | No    |
| `720p_video_audio`    | 1280×720   | 30  | Yes   |

Each round streams for `$DURATION` seconds (default: `70s`).
Between rounds, the system waits `$REST_TIME` seconds (default: `5s`).

For **long-duration marathon testing**, modify the parameters inside `run_benchmarks.ps1`:

```powershell
$ITERATIONS = 5     # Number of repetitions
$DURATION = 600     # 10 minutes
$REST_TIME = 30     # 30s cooldown between rounds
```

---

## Output Files

### `latency_log.csv` (generated on Windows)

```text
Timestamp,Mode,Iteration,RTT_ms
12:00:35,1080p_slides_silent,1,4.2
12:00:37,1080p_slides_silent,1,3.8
...
```

Each record represents a one-way RTT measurement collected through UDP port 5005.

### `benchmark_log.csv` (generated on the Pi)

Contains packet loss and timing statistics from the Pi’s perspective.

> **Note:** After a benchmark finishes, the previous `latency_log.csv` file is automatically backed up as `latency_log_YYYYMMDD_HHMMSS.csv`.

---

## Generating Reports

After the benchmark is completed, generate an HTML report using `analytics/report_generator.py`:

```bash
cd src/test/analytics

# Install dependencies (first time only)
pip install pandas numpy plotly scipy

# Generate the report (default: reads benchmark_log.csv + latency_log.csv)
python report_generator.py
```

Open the generated `unicast_final_report.html` file in a browser to inspect the results.
The report includes:

* Scenario-based RTT averages ± standard deviation
* Latency distribution graphs (histogram + box plot)
* Statistical comparisons between scenarios
* Raw timeline graphs (RTT over time)

---

## Troubleshooting

| Problem                                 | Cause                                             | Solution                                                                                   |
| --------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `ERROR: Could not connect to Pi`        | Pi orchestrator is not running or IP is incorrect | Verify that `run_benchmarks.sh` is running on the Pi and check whether `$PI_IP` is correct |
| `gst-launch-1.0 not found`              | GStreamer is not in PATH                          | Place `gst-launch-1.0.exe` inside the `sender/` directory or add it to PATH                |
| `READY response not received (timeout)` | GStreamer receiver failed to start on the Pi      | Verify that `gstreamer1.0-plugins-ugly` is installed on the Pi (`x264enc` requires it)     |
| Report throws `KeyError`                | CSV column names do not match                     | Fix the CSV using `fix_latency_scenarios.py`, then run the report again                    |
| RTT values are extremely high           | Network congestion or oversized GStreamer buffers | Reduce `$DURATION` or test a single scenario                                               |
