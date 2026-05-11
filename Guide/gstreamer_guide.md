# GStreamer Installation and Usage Guide

This document is intended for **developers** who want to run GStreamer commands manually for testing or debugging.

> **End users of the UniCast app do not need to install GStreamer.** The application bundles GStreamer automatically for all supported platforms:
> - **Windows**: GStreamer MSVC binaries are bundled inside the installer.
> - **Linux**: GStreamer is bundled inside the AppImage (`APPIMAGE_BUNDLE_GSTREAMER=1`).
> - **macOS**: GStreamer.framework is bundled with the app package.

---

## 1. Developer Installation

Our system architecture is divided into two roles: **Sender** and **Receiver**. Follow the steps below for your device's role.

### Sender Computer (Developer Setup)

#### Windows

Download the **MSVC 64-bit Complete** installer from the official GStreamer website:
`https://gstreamer.freedesktop.org/download/`

During installation, select the **Complete** option so all plugins are included.

Then add the GStreamer `bin` directory to your Windows environment variables:

```
C:\gstreamer\1.0\msvc_x86_64\bin
```

> **Note:** The UniCast application does not use the system GStreamer installation. It uses its own bundled copy. This step is only needed to run `gst-launch-1.0` commands manually from the terminal.

#### Linux (Debian / Ubuntu)

```bash
sudo apt update
sudo apt install -y \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  gstreamer1.0-pipewire
```

> The UniCast AppImage bundles its own GStreamer. The packages above are only needed for manual terminal testing.

#### macOS

For manual testing, install the official GStreamer framework (not Homebrew):

Download the **macOS universal installer** from:
`https://gstreamer.freedesktop.org/download/`

Install it to the default location: `/Library/Frameworks/GStreamer.framework/`

Then add to your shell profile:

```bash
export PATH="/Library/Frameworks/GStreamer.framework/Versions/Current/bin:$PATH"
```

> `brew install gstreamer` installs a different build that may not include all required plugins (e.g. `vtenc_h264`, `avfvideosrc`). Use the official installer for best compatibility.

---

### Receiver Device Setup

#### Raspberry Pi 5 (and other Pi OS / Linux-based receivers)

The Pi receiver runs `src/receiver/agent.py`, which manages GStreamer pipelines automatically. Install the required packages:

```bash
sudo apt update
sudo apt install -y \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-libav \
  python3-pip

pip3 install firebase-admin
```

Then run the agent:

```bash
python3 src/receiver/agent.py
```

The agent listens on UDP port 5001 for control commands and launches a GStreamer receive pipeline automatically when a stream starts.

---

## 2. Manual Pipeline Commands (Testing Only)

These commands are useful when you want to test the video path without running the full UniCast application.

Replace `<PI_IP_ADDRESS>` with your Raspberry Pi's local IP address.

> **Order:** Always start the **Receiver** first, then the **Sender**.

---

### Scenario 1: Windows Sender → Raspberry Pi 5 Receiver

#### Step 1 — Raspberry Pi 5 (Receiver)

```bash
gst-launch-1.0 -v udpsrc port=5000 \
  caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=200 \
  ! rtph264depay \
  ! avdec_h264 \
  ! autovideosink sync=false
```

#### Step 2 — Windows (Sender)

```
gst-launch-1.0.exe ^
  d3d11screencapturesrc monitor-index=0 ^
  ! queue ^
  ! d3d11download ^
  ! videoconvert ^
  ! videoscale ^
  ! "video/x-raw,format=NV12,width=1920,height=1080,framerate=30/1" ^
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=15 intra-refresh=true ^
  ! rtph264pay config-interval=1 pt=96 ^
  ! queue ^
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

> `d3d11download` is required on Windows to transfer the captured frame from GPU memory to CPU memory before encoding. Without it the pipeline will fail with a caps negotiation error.

---

### Scenario 2: Linux Sender → Raspberry Pi 5 Receiver

#### Step 1 — Raspberry Pi 5 (Receiver)

Same as Scenario 1, Step 1.

#### Step 2 — Linux (Sender)

```bash
gst-launch-1.0 \
  ximagesrc display-name=:0 use-damage=0 \
  ! videoconvert \
  ! videoscale \
  ! "video/x-raw,format=I420,width=1920,height=1080,framerate=30/1" \
  ! x264enc tune=zerolatency bitrate=3000 speed-preset=superfast key-int-max=15 intra-refresh=true \
  ! rtph264pay config-interval=1 pt=96 \
  ! queue \
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

> On Wayland, replace `ximagesrc` with `pipewiresrc` and set `WAYLAND_DISPLAY` accordingly. The UniCast application handles this automatically.

---

### Scenario 3: Raspberry Pi 3B+ (Low-Power Receiver)

The Pi 3B+ cannot decode 1080p@30fps in software. Use these reduced settings:

#### Pi 3B+ Receiver

```bash
DISPLAY=:0 gst-launch-1.0 udpsrc port=5000 \
  caps="application/x-rtp, media=video, encoding-name=H264, payload=96" \
  ! rtpjitterbuffer latency=100 \
  ! rtph264depay \
  ! h264parse \
  ! avdec_h264 \
  ! videoconvert \
  ! kmssink sync=false
```

#### Windows Sender → Pi 3B+

```
gst-launch-1.0.exe ^
  d3d11screencapturesrc monitor-index=0 ^
  ! queue ^
  ! d3d11download ^
  ! videoconvert ^
  ! videoscale ^
  ! "video/x-raw,format=NV12,width=1280,height=720,framerate=15/1" ^
  ! x264enc tune=zerolatency bitrate=2000 speed-preset=ultrafast key-int-max=30 intra-refresh=true ^
  ! rtph264pay config-interval=1 pt=96 ^
  ! queue ^
  ! udpsink host=<PI_IP_ADDRESS> port=5000
```

---

## 3. Test Results

### Raspberry Pi 5 (Primary Target)

| Metric | Result |
|--------|--------|
| Latency | < 150 ms |
| Resolution | Up to 1080p@30fps |
| Stability | Stable |
| Hardware acceleration | Not required on receiver side |

### Raspberry Pi 3B+ (Low-Power)

| Metric | Result |
|--------|--------|
| Resolution | 720p |
| FPS | 15 |
| Stability | Functional but not fully optimized |
| Sink used | `kmssink` (no desktop environment needed) |

---

## 4. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `No such element: d3d11screencapturesrc` | GStreamer incomplete install | Use MSVC Complete installer |
| `caps negotiation failed` on Windows | Missing `d3d11download` | Add `! d3d11download !` before `videoconvert` |
| `Could not open display` on Linux | No X11 session | Set `DISPLAY=:0` or use `pipewiresrc` on Wayland |
| `autovideosink` fails on Pi headless | No display attached | Use `kmssink` or `fpsdisplaysink` |
| High latency (>300ms) | `rtpjitterbuffer latency` too high | Reduce to `latency=50` or `latency=100` |
| Black screen on Pi | Decoder buffer underrun | Increase sender bitrate or reduce resolution |
