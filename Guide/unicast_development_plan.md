# UniCast — Application Plan (Current Status)

**Version:** 3.0 | **Date:** May 2026

> This plan reflects the **actual current state** of the project. Each section is marked as either completed, in progress, or planned. Code examples directly match the current implementation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Critical Files](#2-architecture)
3. [UDP Protocol Reference](#3-udp-protocol)
4. [Tauri Event Reference](#4-tauri-events)
5. [Rust Command Reference](#5-rust-commands)
6. [Completed: Network Layer](#6-network-layer)
7. [Completed: Room Caching](#7-room-caching)
8. [Completed: Favorites](#8-favorites)
9. [Completed: UI Components](#9-ui-components)
10. [Completed: Linux & Windows Platform Fixes](#10-platform-fixes)
11. [Completed: GStreamer Error Handling](#11-error-handling)
12. [Completed: Streaming Bar (Separate Window)](#12-streaming-bar)
13. [Completed: Audio Features](#13-audio)
14. [Completed: RTT / Network Quality Monitoring](#14-rtt)
15. [Completed: Settings System](#15-settings)
16. [Completed: Session Token Security](#16-session-token)
17. [Completed: Fast Room Status Updates](#17-room-status-update)
18. [In Progress: Field Testing](#18-field-testing)
19. [Next Phase: macOS](#19-macos)

---

## 1. Project Overview

* **Project:** Low-latency wireless screen casting for educational environments
* **Goal:** <150ms latency, Eduroam/LAN compatible, cross-platform (Windows/Linux/macOS)
* **Pi IP (test environment):** `10.50.0.113`
* **Build:** GitHub Actions with 3-way matrix build (Windows / Linux / macOS ARM64)
* **Current status:** All core features completed. Session token security implemented. Field testing ongoing.

---

## 2. Architecture & Critical Files

### Technology Stack

| Layer          | Technology                                                                                   |
| -------------- | -------------------------------------------------------------------------------------------- |
| UI             | React 18, Tailwind v3, Zustand, react-router-dom                                             |
| Backend        | Rust (Tauri v2)                                                                              |
| Stream Engine  | GStreamer 1.0 (portable bundle)                                                              |
| Pi Agent       | Python 3 (asyncio, UDP server)                                                               |
| Database       | Firebase Realtime DB (room list)                                                             |
| Settings/Cache | Rust `write_settings`/`read_settings`, `write_rooms_cache`/`read_rooms_cache` → AppData JSON |

### Critical Files

```text
app/
├── src/
│   ├── screens/
│   │   ├── RoomDiscovery.tsx          ← Main screen (room list, favorites)
│   │   ├── ConnectionSetup.tsx        ← Connection flow (PIN, stream control)
│   │   └── StreamingBarApp.tsx        ← Separate Tauri window content
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx             ← Top bar (logo, settings button)
│   │   │   ├── StatusBanner.tsx       ← Network status warning banner
│   │   │   └── StatusSummary.tsx      ← Bottom bar (last update, room count)
│   │   ├── rooms/
│   │   │   ├── RoomCard.tsx           ← Individual room card
│   │   │   ├── RoomGrid.tsx           ← Room grid
│   │   │   ├── FloorTabs.tsx          ← Floor filter tabs
│   │   │   ├── FavoritesSection.tsx   ← Favorites section
│   │   │   ├── ManualConnect.tsx      ← IP input form
│   │   │   └── ManualConnectSection.tsx ← Manual connection wrapper
│   │   ├── connection/
│   │   │   ├── PINEntry.tsx           ← PIN input field
│   │   │   ├── ConnectionProgress.tsx ← Connection step indicator
│   │   │   ├── StreamModeSelector.tsx ← Fullscreen / window mode selector
│   │   │   └── AudioToggle.tsx        ← Audio enable/disable toggle
│   │   ├── modals/
│   │   │   └── LinuxWarningModal.tsx  ← Linux window mode warning
│   │   ├── settings/
│   │   │   └── SettingsModal.tsx      ← Settings modal
│   │   └── streaming-bar/
│   │       ├── NetworkQualityDot.tsx  ← RTT quality indicator
│   │       └── AudioPopup.tsx         ← Audio slider popup
│   ├── stores/
│   │   ├── connectionStore.ts         ← Connection state, stream control
│   │   ├── roomStore.ts               ← Room list, floor filtering
│   │   ├── networkStore.ts            ← ONLINE/LOCAL_ONLY/NO_NETWORK
│   │   ├── settingsStore.ts           ← Persistent user settings
│   │   └── systemStore.ts             ← Window list, monitor list, encoder
│   ├── services/
│   │   └── roomService.ts             ← Firebase polling, cache, refreshRoomsNow
│   └── types/
│       ├── room.ts                    ← Room, RoomStatus
│       ├── stream.ts                  ← StreamConfig, ConnectionPhase, StreamMode
│       └── settings.ts                ← Settings, DEFAULT_SETTINGS
│
├── src-tauri/src/
│   ├── commands/
│   │   ├── auth.rs                    ← verify_pin, wake_pi_hdmi
│   │   ├── stream.rs                  ← start_stream, stop_stream, set_stream_volume
│   │   ├── network.rs                 ← get_network_info, start_rtt_monitor
│   │   ├── firebase.rs                ← fetch_firebase_rooms
│   │   ├── cache.rs                   ← read_rooms_cache, write_rooms_cache
│   │   ├── settings.rs                ← read_settings, write_settings
│   │   ├── audio.rs                   ← mute_system_audio, list_audio_devices
│   │   ├── encoder.rs                 ← detect_encoder
│   │   ├── monitors.rs                ← list_monitors
│   │   ├── capture.rs                 ← list_windows (window capture)
│   │   └── windows.rs                 ← Tauri window management
│   └── gstreamer/
│       ├── path_setup.rs              ← CRITICAL: Smart Path + env setup
│       └── pipeline.rs                ← CRITICAL: Wayland/X11 detection, pipeline string
│
├── src/receiver/
│   └── agent.py                       ← Pi UDP server (PIN, HEARTBEAT, STOP, VOLUME)
```

---

## 3. UDP Protocol Reference

The Pi listens on UDP `0.0.0.0:5001`. All control commands are sent to this port.

### Before Authentication

| Command | Sender      | Format      | Pi Response                                  |
| ------- | ----------- | ----------- | -------------------------------------------- |
| WAKE    | Application | `WAKE`      | `READY` or `OK`                              |
| PIN     | Application | `PIN:<pin>` | `OK:<token>` or `FAIL:<remaining>` or `BUSY` |

### After Authentication (token required)

| Command   | Sender                     | Format                   | Description                        |
| --------- | -------------------------- | ------------------------ | ---------------------------------- |
| HEARTBEAT | Rust (automatic, every 2s) | `HEARTBEAT:<token>`      | Prevents Pi 5s timeout             |
| STOP      | Rust (when stream stops)   | `STOP:<token>`           | Stops stream and generates new PIN |
| VOLUME    | Rust (when audio changes)  | `VOLUME:<0-100>:<token>` | Adjusts Pi HDMI output volume      |

### Port 5005 (Ping/RTT)

| Command | Format | Pi Response |
| ------- | ------ | ----------- |
| PING    | `PING` | `PONG`      |

### Token Security Rules (Pi Side)

* Token: `secrets.token_hex(16)` → 32-character hex, 2^128 combinations
* IP binding: Token must match the IP that submitted the PIN (`session_ip`)
* HEARTBEAT/STOP/VOLUME commands without a valid token are rejected
* Token is cleared after `stop_streaming()` and grace period timeout

---

## 4. Tauri Event Reference

Rust → Frontend events (`app.emit(...)` broadcasts to all windows):

| Event            | Payload                              | Publisher  | Listener                         |
| ---------------- | ------------------------------------ | ---------- | -------------------------------- |
| `stream-started` | `{ pid: number }`                    | stream.rs  | ConnectionSetup, StreamingBarApp |
| `stream-stopped` | `{ reason: "user" \| "error" }`      | stream.rs  | ConnectionSetup, StreamingBarApp |
| `stream-health`  | `{ rttMs: number, quality: string }` | network.rs | ConnectionSetup, StreamingBarApp |

Frontend → Streaming Bar window (`bar.emit(...)`):

| Event              | Payload                                             | Description                     |
| ------------------ | --------------------------------------------------- | ------------------------------- |
| `stream-mode-info` | `{ mode, targetIp, audioEnabled, volume, isMuted }` | Sent to bar after stream starts |

---

## 5. Rust Command Reference

All commands are called via `invoke(...)`:

| Command                | File        | Signature                                                          | Description                                      |
| ---------------------- | ----------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `verify_pin`           | auth.rs     | `(targetIp: string, pin: string) → PinVerifyResult`                | Send PIN and receive session token               |
| `wake_pi_hdmi`         | auth.rs     | `(targetIp: string) → bool`                                        | HDMI power-on signal                             |
| `start_stream`         | stream.rs   | `(config: StreamConfig, sessionToken: string) → StartStreamResult` | Starts GStreamer pipeline                        |
| `stop_stream`          | stream.rs   | `() → bool`                                                        | Stops GStreamer, emits `stream-stopped`          |
| `set_stream_volume`    | stream.rs   | `(volume: float, mute: bool, targetIp: string\|null) → bool`       | Sends VOLUME UDP command to Pi                   |
| `switch_stream_mode`   | stream.rs   | `(mode: string, windowId: number\|null) → bool`                    | Stream mode switching (frontend restarts stream) |
| `get_network_info`     | network.rs  | `() → LocalNetworkInfo`                                            | Checks for local network interface               |
| `get_network_quality`  | network.rs  | `(targetIp: string) → NetworkQualityPayload`                       | One-shot RTT measurement                         |
| `fetch_firebase_rooms` | firebase.rs | `() → Record<string, RawRoom>`                                     | Fetches room list from Firebase                  |
| `read_rooms_cache`     | cache.rs    | `() → RoomsCache\|null`                                            | Reads disk cache                                 |
| `write_rooms_cache`    | cache.rs    | `(cache: RoomsCache) → void`                                       | Writes disk cache                                |
| `read_settings`        | settings.rs | `() → Settings`                                                    | Reads user settings                              |
| `write_settings`       | settings.rs | `(settings: Settings) → bool`                                      | Saves user settings                              |
| `mute_system_audio`    | audio.rs    | `(mute: bool) → void`                                              | Mute/unmute local speakers                       |
| `list_audio_devices`   | audio.rs    | `() → AudioDevice[]`                                               | Audio device list                                |
| `detect_encoder`       | encoder.rs  | `() → string\|null`                                                | Detects hardware encoder                         |
| `list_monitors`        | monitors.rs | `() → Monitor[]`                                                   | Monitor list                                     |
| `list_windows`         | capture.rs  | `() → WindowInfo[]`                                                | Open window list                                 |

---

## 6.Completed: Network Layer

### State Machine

```text
CHECKING → ONLINE        (Firebase successful)
CHECKING → LOCAL_ONLY    (local network available but Firebase unreachable)
CHECKING → NO_NETWORK    (no local network interface)
```

### Files

**`app/src/stores/networkStore.ts`**

```typescript
type NetworkState = "CHECKING" | "ONLINE" | "LOCAL_ONLY" | "NO_NETWORK";

interface NetworkStore {
  networkState: NetworkState;
  hasLocalInterface: boolean;
  localIp: string | null;
  checkLocalNetwork: () => Promise<void>;
  setNetworkState: (s: NetworkState) => void;
}
```

**`app/src-tauri/src/commands/network.rs`**

* `get_network_info()`: Detects local IP by binding a UDP socket to `8.8.8.8:80` (without sending packets)
* `start_rtt_monitor(app)`: Background loop, sends PING to Pi:5005 every 2s → emits `stream-health`
* `get_network_quality(targetIp)`: One-time RTT measurement

### Flow

1. `RoomDiscovery` mounts → `startRoomListener()` → `checkLocalNetwork()`
2. If Firebase fetch succeeds: `setNetworkState("ONLINE")`
3. If Firebase fails but local network exists: `setNetworkState("LOCAL_ONLY")`
4. If no local network exists: `setNetworkState("NO_NETWORK")`

---

## 7.Completed: Room Caching

### Strategy: Stale-While-Revalidate

```text
Application starts
    ↓
1. read_rooms_cache → UI appears instantly
    ↓
2. fetch_firebase_rooms runs in background
    ↓
3a. Success → write_rooms_cache → UI updates
3b. Failure → cached data preserved, NetworkState updated
```

### Files

**`app/src/services/roomService.ts`**

* `startRoomListener()`: Load cache → fetch Firebase → `setInterval(fetchRooms, 30000)`
* `activeFetchRooms`: Module-level reference for `refreshRoomsNow()`
* `refreshRoomsNow()`: Triggers immediate Firebase refresh externally

**`app/src-tauri/src/commands/cache.rs`**

* Cache path: `AppData/unicast/rooms_cache.json`
* Struct: `RoomsCache { rooms: Vec<CachedRoom>, lastUpdated: i64, version: u32 }`

**`app/src-tauri/src/commands/firebase.rs`**

* Anonymous Firebase auth token → cached for 50 minutes
* 3-second timeout → used for LOCAL_ONLY detection
* If Firebase returns `null`, returns `Ok(HashMap::new())`

---

## 8.Completed: Favorites

### Architectural Decision

Favorites are stored as `Settings.favorites: string[]` (room ID list) inside `settings.json`.
`@tauri-apps/plugin-store` is not used — JSON R/W is handled via Rust `read_settings`/`write_settings`.

### Files

**`app/src/types/settings.ts`**

```typescript
export interface Settings {
  version: number;
  favorites: string[];
  // ...other fields
}
```

**`app/src/stores/settingsStore.ts`**

* `toggleFavorite(roomId)`: Add/remove favorite → `saveToDisk()` → `write_settings`
* `loadFromDisk()`: Loads settings at startup
* `hideLinuxWindowWarning`: Suppresses Linux window mode warning

**`app/src/components/rooms/FavoritesSection.tsx`**

* Displays favorite rooms at the top
* Hidden if favorites list is empty

**`app/src/components/rooms/RoomCard.tsx`**

* Integrated favorite toggle button
* Status colors: `idle` (green), `streaming` (blue), `offline` (gray), `unconfigured` (yellow)

---

## 9.Completed: UI Components

### Component Map

| Component              | File                                  | Description                              |
| ---------------------- | ------------------------------------- | ---------------------------------------- |
| `TopBar`               | `layout/TopBar.tsx`                   | Logo, settings button                    |
| `StatusBanner`         | `layout/StatusBanner.tsx`             | LOCAL_ONLY / NO_NETWORK warning banner   |
| `StatusSummary`        | `layout/StatusSummary.tsx`            | Bottom bar: last update time, room count |
| `FloorTabs`            | `rooms/FloorTabs.tsx`                 | Floor filter tabs                        |
| `RoomGrid`             | `rooms/RoomGrid.tsx`                  | Filtered room grid                       |
| `RoomCard`             | `rooms/RoomCard.tsx`                  | Individual room card                     |
| `FavoritesSection`     | `rooms/FavoritesSection.tsx`          | Favorite rooms horizontal list           |
| `ManualConnect`        | `rooms/ManualConnect.tsx`             | IP input form                            |
| `ManualConnectSection` | `rooms/ManualConnectSection.tsx`      | Hidden during NO_NETWORK                 |
| `PINEntry`             | `connection/PINEntry.tsx`             | PIN input and error display              |
| `ConnectionProgress`   | `connection/ConnectionProgress.tsx`   | Connection step indicator                |
| `StreamModeSelector`   | `connection/StreamModeSelector.tsx`   | Fullscreen / window mode selector        |
| `AudioToggle`          | `connection/AudioToggle.tsx`          | Audio enable/disable toggle              |
| `LinuxWarningModal`    | `modals/LinuxWarningModal.tsx`        | Linux window mode warning                |
| `SettingsModal`        | `settings/SettingsModal.tsx`          | All user settings                        |
| `NetworkQualityDot`    | `streaming-bar/NetworkQualityDot.tsx` | RTT quality indicator                    |
| `AudioPopup`           | `streaming-bar/AudioPopup.tsx`        | Audio slider popup                       |

### RoomDiscovery Structure

```text
RoomDiscovery
├── TopBar
├── StatusBanner
├── FavoritesSection
├── FloorTabs
├── RoomGrid
├── ManualConnectSection
└── StatusSummary
    └── SettingsModal
```

### Room Status Logic

`roomService.ts::parseRoom()`:

* Invalid/missing `pi_ip` → `unconfigured`
* `last_seen` older than 2 minutes → `offline`
* `pi_status === "streaming"` → `streaming`
* `pi_status === "idle"` → `idle`

---

## 10.Completed: Platform Fixes

### Linux: Window Mode Warning Modal

**File:** `LinuxWarningModal.tsx`

* Opens when Linux + window mode is selected
* "Don't show again" → saved to disk
* Warning shown every time unless disabled

### Linux: BadMatch (X11 MIT-SHM) Fix

```rust
#[cfg(target_os = "linux")]
{
    cmd.env("_X11_NO_MITSHM", "1");
}
```

### Linux: Auto-Restart (GStreamer Crash Recovery)

* Linux + window mode only
* 3 retry attempts
* 3-second intervals
* Protection against restart loops

### Windows: CREATE_NO_WINDOW

```rust
#[cfg(target_os = "windows")]
{
    cmd.creation_flags(0x08000000);
}
```

Also applied to `taskkill`.

---

## 11.Completed: GStreamer Error Handling

### Two-Layer Error Detection

**Layer 1 — Instant crash (≤500ms)**

* `child.try_wait()`
* Hardware encoder failure → automatic `x264enc` fallback
* Frontend shows stream startup error

**Layer 2 — Delayed crash (>500ms)**

* Background watcher thread monitors process
* Crash → emits `stream-stopped`

### Frontend Behavior

* `reason === "error"` → reset stream state, show red error banner
* `reason === "user"` → reset and return to home screen

---

## 12.Completed: Streaming Bar (Separate Window)

### Architecture

Streaming bar is a separate Tauri `WebviewWindow`.

### Limitations

* Separate JS context
* Zustand stores initialize independently
* Session token unavailable from JS
* Rust global `SESSION_TOKEN` used instead

### Startup Flow

```typescript
const bar = await WebviewWindow.getByLabel("streaming-bar");
if (bar) {
    await bar.show();
    await bar.setFocus();

    setTimeout(() => {
        bar.emit("stream-mode-info", {
            mode,
            targetIp,
            audioEnabled,
            volume,
            isMuted
        });
    }, 500);
}
```

### Audio Control

`set_stream_volume()` reads the token directly from Rust global state.

---

## 13.Completed: Audio Features

### Features

| Feature                | Mechanism                            |
| ---------------------- | ------------------------------------ |
| Enable/disable audio   | `audioEnabled` in GStreamer pipeline |
| Mute/unmute            | `VOLUME:0:<token>`                   |
| Volume control         | `VOLUME:<val>:<token>`               |
| Mute local speakers    | `mute_system_audio()`                |
| Audio device selection | `list_audio_devices()`               |

### Per-Profile Audio

* Presentation profile default: audio disabled
* Video profile default: audio enabled

---

## 14.Completed: RTT / Network Quality Monitoring

### Rust Side

Background loop:

```rust
PING → PONG RTT measurement every 2 seconds
```

### Quality Thresholds

```rust
0..=4    => "excellent"
5..=19   => "good"
20..=49  => "degraded"
50+      => "poor"
```

### Frontend

* `stream-health` events update UI
* `NetworkQualityDot` shows RTT status visually

---

## 15.Completed: Settings System

### Structure

```typescript
export interface Settings {
  version: number;
  language: "tr" | "en";
  favorites: string[];

  profiles: {
    presentation: StreamProfile;
    video: StreamProfile;
  };

  audio: {
    deviceId: string | null;
    muteLocal: boolean;
  };

  encoder: {
    detected: string | null;
    lastScan: string | null;
  };

  appearance: {
    mainTheme: "light" | "dark";
    barTheme: "light" | "dark" | "translucent-dark";
    barOpacity: number;
  };

  streamingBar: {
    enabled: boolean;
  };

  hideLinuxWindowWarning: boolean;
}
```

### Persistence

* Path: `{AppData}/unicast/settings.json`
* Rust handles all disk I/O

### Encoder Detection

`detect_encoder()` checks:

```text
nvh264enc → vtenc_h264 → x264enc
```

---

## 16.Completed: Session Token Security

### Motivation

Even if students know the PIN, they cannot manipulate the stream externally via raw UDP commands.

### Token Lifecycle

```text
PIN success
    ↓
Pi generates token
    ↓
Rust parses token
    ↓
Frontend stores token
    ↓
start_stream passes token to Rust
    ↓
HEARTBEAT every 2s
    ↓
STOP clears token
```

### Pi Side

```python
token = secrets.token_hex(16)
self.session_token = token
self.session_ip = ip
```

### Rust Side

```rust
static SESSION_TOKEN: OnceLock<Arc<Mutex<Option<String>>>> = OnceLock::new();
```

### Frontend

```typescript
sessionToken: string | null;
```

---

## 17.Completed: Fast Room Status Updates

### Problem

After stream stop, Firebase polling delay caused stale `"streaming"` state for ~30 seconds.

### Solution

Two delayed refreshes:

```typescript
setTimeout(refreshRoomsNow, 3000);
setTimeout(refreshRoomsNow, 7000);
```

### Why Not From Streaming Bar?

Streaming bar runs in a separate JS context and does not share `activeFetchRooms`.

---

## 18.In Progress: Field Testing

### Completed Tests

| Platform | Status | Notes                           |
| -------- | ------ | ------------------------------- |
| Windows  | Completed      | Hardware encoder fallback works |
| Linux    | Completed      | AppImage streaming works        |
| macOS    | Planned     | Not tested yet                  |

### Known Conditions

* GTK accessibility warnings (`at-spi`) are harmless
* Room update delay reduced from 20–25s to ~3–7s

---

## 19.Next Phase: macOS

### Requirements

* [ ] macOS bundle field testing
* [ ] CoreAudio device testing
* [ ] GStreamer framework path validation
* [ ] Code signing & notarization

### macOS GStreamer Path Strategy

`path_setup.rs`:

1. Check official framework path
2. Fallback to deep search

### macOS Audio

Uses `osxaudiosrc`.

### Planned Signing Steps

1. Apple Developer account
2. Configure `signingIdentity`
3. Add GitHub secrets
4. Configure notarization
5. Enable `notarize: true`

### macOS CI/CD Checklist

* [x] Remote Fetch implemented
* [x] Cache with `actions/cache`
* [x] 3-way matrix build
* [ ] ARM64 field testing
* [ ] Gatekeeper testing

---

## Dependency Map

```text
RoomDiscovery
├── startRoomListener() [roomService]
│   ├── invoke("read_rooms_cache")
│   ├── invoke("fetch_firebase_rooms")
│   └── setInterval(30s)
├── checkLocalNetwork()
│   └── invoke("get_network_info")
└── Components

ConnectionSetup
├── submitPIN()
│   └── invoke("verify_pin")
├── startStream()
│   ├── invoke("start_stream")
│   ├── build_pipeline()
│   ├── get_gst_launch()
│   ├── SESSION_TOKEN global
│   └── HEARTBEAT every 2s
├── stopStream()
│   ├── invoke("stop_stream")
│   └── invoke("mute_system_audio", false)
└── stream-stopped handler

StreamingBarApp
├── invoke("set_stream_volume")
├── invoke("stop_stream")
├── stream-health event
└── stream-stopped event
```
