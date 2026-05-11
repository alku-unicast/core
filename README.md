<div align="right">
  <a href="README_TR.md">🇹🇷 Türkçe</a>
</div>

<div align="center">
  <img src="app/src/assets/UniCast.png" width="110" alt="UniCast Logo" />
  <h1>UniCast</h1>
  <p><strong>Low-latency wireless screen mirroring for education</strong></p>
  <p>
    <a href="https://github.com/alku-unicast/core/actions/workflows/build.yml">
      <img src="https://github.com/alku-unicast/core/actions/workflows/build.yml/badge.svg" alt="Build Status" />
    </a>
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue" alt="Platform" />
    <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
    <a href="https://github.com/alku-unicast/core/releases/latest">
      <img src="https://img.shields.io/github/v/release/alku-unicast/core" alt="Latest Release" />
    </a>
  </p>
  <img src="app/src/assets/System_Architecture_Simple_EN.png" width="680" alt="System Architecture" />
</div>

---

## About

UniCast is an open-source wireless screen mirroring system designed for classrooms. A teacher connects their laptop to a projector over **Wi-Fi or LAN** — no cables, no dongles, no driver installations.

- **Sender:** The UniCast desktop app (Windows / Linux / macOS) captures the screen and streams it over UDP
- **Receiver:** A Raspberry Pi 5 connected to the projector via HDMI decodes the stream in real time

UniCast is built with [Tauri](https://tauri.app/) (Rust backend + React frontend) and [GStreamer](https://gstreamer.freedesktop.org/) for the media pipeline.

---

## Features

| Feature | Details |
|---------|---------|
| **Low Latency** | < 150 ms end-to-end over LAN |
| **Cross-Platform** | Windows 10/11, Linux (X11/Wayland), macOS (Intel + Apple Silicon) |
| **Hardware Acceleration** | NVIDIA (NVENC), Intel (QSV), AMD (AMF), Apple (VideoToolbox), CPU fallback |
| **Audio Streaming** | Opus audio via UDP with volume control |
| **PIN Authentication** | Time-limited PIN shown on the projector screen |
| **Session Token Security** | All control commands require a signed session token |
| **Streaming Overlay Bar** | Floating always-on-top bar during stream (timer, network quality, stop) |
| **Room Discovery** | Firebase-backed room list with offline caching |
| **Favorites & Floor Filter** | Quick access to frequently used rooms |
| **Manual Connection** | Connect directly by IP if Firebase is unreachable |
| **Network Quality Monitor** | Real-time RTT indicator (excellent / good / degraded / poor) |

---

## Download

> GStreamer is bundled — **no separate installation required**.

| Platform | Download |
|----------|----------|
| Windows 10/11 (x64) | [📦 UniCast-Setup.exe](https://github.com/alku-unicast/core/releases/download/v0.1.0/UniCast_0.1.0_x64-setup.exe) |
| Linux (x86_64 AppImage) | [📦 UniCast.AppImage](https://github.com/alku-unicast/core/releases/download/v0.1.0/UniCast_0.1.0_amd64.AppImage) |
| macOS (ARM64 / Intel) | [📦 UniCast.dmg](https://github.com/alku-unicast/core/releases/download/v0.1.0/UniCast_0.1.0_aarch64.dmg) |

All releases: [github.com/alku-unicast/core/releases](https://github.com/alku-unicast/core/releases)

**Linux:** After download, mark as executable:
```bash
chmod +x UniCast.AppImage && ./UniCast.AppImage
```

**macOS:** If Gatekeeper blocks the app: right-click → Open → Open.

---

## System Requirements

### Sender (Teacher's Computer)

| | Minimum |
|--|---------|
| OS | Windows 10 (64-bit), Ubuntu 20.04+, macOS 12+ |
| RAM | 4 GB |
| GPU | Any — software encoder (x264) included as fallback |
| Network | Same LAN as the Raspberry Pi |

### Receiver (Raspberry Pi)

| | Requirement |
|--|------------|
| Model | Raspberry Pi 5 (recommended), Pi 4B (supported) |
| OS | Raspberry Pi OS (Bookworm or Bullseye) |
| Connection | Ethernet or Wi-Fi on the same network as sender |
| Display | HDMI to projector/screen |

---

## Quick Start

### 1 — Raspberry Pi Setup

Clone the repository and run the receiver agent on your Pi:

```bash
git clone https://github.com/alku-unicast/core.git
cd core
pip3 install firebase-admin
python3 src/receiver/agent.py
```

Place your Firebase service account key at `src/receiver/firebase-key.json` before running.  
→ See [Firebase Setup Guide](Guide/firebase_implementation_guide.md) for details.

When running, the Pi displays a PIN code on the projector screen.

### 2 — UniCast App (Sender)

1. [Download and install](#download) UniCast for your OS
2. Open UniCast — it fetches the room list from Firebase automatically
3. Select the room (projector), click **Connect**
4. Enter the PIN shown on the screen
5. Choose stream mode (fullscreen or window capture) and click **Start Streaming**

A floating streaming bar appears with stream controls. Click **Stop** to end the session.

---

## How It Works

```
Teacher's Laptop                      Raspberry Pi 5
───────────────                       ──────────────
UniCast App (Tauri)
  │
  │  Firebase (HTTPS)        ←→       agent.py
  │  Room discovery                   Updates room status & IP
  │
  │  UDP:5001  PIN:<pin>     ────→    Verify PIN
  │            OK:<token>   ←────    Session token issued
  │
  │  UDP:5000  RTP/H.264     ────→    Decode → HDMI → Projector
  │  UDP:5002  RTP/Opus      ────→    Audio output
  │
  │  UDP:5001  HEARTBEAT:<token> →   Keep-alive every 2s
  │  UDP:5005  PING/PONG     ←→      RTT measurement
  │
  │  UDP:5001  STOP:<token>  ────→   Graceful stream end
```

**Video pipeline:** GStreamer captures the screen (D3D11 on Windows, ximagesrc/pipewiresrc on Linux, avfvideosrc on macOS), encodes with hardware H.264, and sends as RTP over UDP.

---

## Documentation

| Document | Language |
|----------|----------|
| [GStreamer Guide](Guide/gstreamer_guide.md) | 🇬🇧 EN |
| [Firebase Setup Guide](Guide/firebase_implementation_guide.md) | EN |
| [Pi 5 Deployment Guide](Guide/pi5_guide.md) | 🇬🇧 EN |
| [System Architecture](Guide/system_architectue.md) | 🇬🇧 EN |
| [Development Plan](Guide/unicast_development_plan.md) | 🇬🇧 EN |

---

## Building from Source

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Rust 1.77+](https://rustup.rs/)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

GStreamer is fetched automatically by the CI/CD pipeline. For local development, follow the [GStreamer Guide](Guide/gstreamer_guide.md).

### Build

```bash
git clone https://github.com/alku-unicast/core.git
cd core/app
npm install
npm run tauri build
```

Build artifacts appear in `app/src-tauri/target/release/bundle/`.

### Development Mode

```bash
cd core/app
npm run tauri dev
```

---

## License

This project is licensed under the **MIT License**.  
See [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Developed at <strong>Alanya Alaaddin Keykubat University</strong> — Computer Engineering Department</sub>
  <br/>
  <br><br/>
  <img src="app/src/assets/alku-yatay-logo-rgb.png" width="200" alt="Alanya Alaaddün Keykubat University Logo" />
</div>
