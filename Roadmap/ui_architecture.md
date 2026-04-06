# UniCast — Sender UI Architecture Design (Final — Approved 2026-04-06)

## Project Context

UniCast is a low-latency wireless screen mirroring system for educational environments. The **Sender Application** runs on the teacher's PC (Windows/macOS/Linux) and provides a UI for:
- Discovering available classrooms (via Firebase)
- Configuring stream parameters (resolution, encoder, audio)
- Authenticating with Pi receivers (PIN over UDP)
- Controlling live streams (start/stop/mute)

The core GStreamer streaming engine already works. This document designs the **complete frontend architecture** that wraps around it.

---

## 1. Technology Stack (Decisions Finalized)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Desktop Shell** | Tauri v2 | ~3-5MB binary, native WebView, Rust backend, multi-window support |
| **Frontend Framework** | React 18 + TypeScript | Component-based, large ecosystem |
| **Styling** | **Tailwind CSS v3** | More stable across WebView2 (Win) / WebKit (macOS/Linux). v4 uses newer CSS features with inconsistent WebView support. **JS config is well-documented and ecosystem-proven.** |
| **State Management** | Zustand | Minimal boilerplate, TypeScript-native, no provider wrapping |
| **Routing** | React Router v6 | Standard SPA routing within Tauri WebView |
| **i18n** | i18next + react-i18next | Mature, lazy-loading locale files, interpolation support |
| **Firebase Client** | **Firebase JS SDK v10 (Frontend)** | Anonymous Auth + Realtime DB listener. Security analysis in Section 6. |
| **Icons** | Lucide React | Lightweight, tree-shakeable, consistent style |
| **Animations** | Framer Motion | Declarative, layout animations, exit animations |

> [!NOTE]
> **Tailwind v3 chosen** over v4 for maximum cross-platform WebView compatibility. Tauri uses OS-native WebViews (WebView2 on Windows, WebKit on macOS/Linux) — v3's broader CSS compatibility is safer.

---

## 2. Application Window Architecture

UniCast uses **two distinct Tauri windows**:

```
┌─────────────────────────────────────────────┐
│           MAIN WINDOW (resizable)           │
│  ┌───────────────────────────────────────┐  │
│  │  Screen 1: Room Discovery             │  │
│  │  Screen 2: Connection & Config        │  │
│  │  (managed by React Router)            │  │
│  └───────────────────────────────────────┘  │
│  Default: 960×640, min: 800×550             │
└─────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│   STREAMING BAR (always-on-top, OPTIONAL)  │
│   Fixed: 380×56, not resizable             │
│   Draggable, semi-transparent              │
│   EXCLUDED from screen capture             │
│   Shows: timer, stream mode, mute, stop    │
│   + optional network quality indicator     │
│   Own theme (independent of main window)   │
└────────────────────────────────────────────┘
```

### Window Lifecycle
1. App starts → **Main Window** opens at Screen 1
2. User connects to a room → Main Window navigates to Screen 2
3. Stream starts →
   - **Main Window minimizes to system tray** (stays accessible)
   - If `settings.streaming_bar_enabled == true` → **Streaming Bar spawns** (always-on-top)
   - If disabled → user controls stream via tray icon or by reopening main app
4. Stream stops → **Streaming Bar closes** (if shown), **Main Window re-shows** at Screen 1

### Streaming Bar is Optional
- **Default**: Enabled (toggle in Settings)
- **When disabled**: User can always reopen the main window from system tray to stop/configure
- **System tray icon** provides: Stop Stream, Mute/Unmute, Open Main Window, Quit

### Screen Capture Exclusion (Critical)
The streaming bar must **NOT** be captured when the user shares their full screen.

**Solution: `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`**
- Windows 10 2004+ (Build 19041+) supports this Win32 API flag
- When set on a window, all screen capture APIs (including `d3d11screencapturesrc`) skip that window
- Rust implementation in `main.rs`:
```rust
// Called after streaming bar window is created
#[cfg(target_os = "windows")]
fn exclude_window_from_capture(hwnd: HWND) {
    unsafe {
        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE); // 0x00000011
    }
}
```
- **macOS**: `window.setSharingType(.none)` (via NSWindow API) achieves the same
- **Linux**: X11 doesn't have a direct equivalent, but the bar can be set as a different `_NET_WM_WINDOW_TYPE` to hint compositors

> [!NOTE]
> This is a well-supported API on Windows 10+. Same mechanism used by Zoom, Teams, OBS to hide their overlays from screen capture.

---

## 3. Screen Flow & Component Hierarchy

### 3.1. Screen 1 — Room Discovery (Home)

The primary landing screen. Teachers see available classrooms grouped by floor.

```
Screen1_RoomDiscovery
├── TopBar
│   ├── AppLogo + AppTitle ("UniCast")
│   ├── LanguageToggle (TR/EN flag button)
│   └── SettingsGearButton → opens SettingsModal
│
├── FavoritesSection (collapsible)
│   ├── SectionHeader ("⭐ Favorites" + collapse chevron)
│   └── HorizontalScrollContainer
│       └── RoomCard[] (compact variant)
│
├── FloorTabs
│   ├── Tab("All") ← default active
│   ├── Tab("Ground Floor")
│   ├── Tab("1st Floor")
│   ├── Tab("2nd Floor")
│   └── ... (dynamic from Firebase data)
│
├── RoomGrid
│   └── RoomCard[] (full variant)
│       ├── RoomLabel ("101", "003/005")
│       ├── StatusIndicator (green=idle, gray=offline, orange=streaming)
│       ├── FavoriteStarToggle
│       └── ConnectButton (disabled if offline/streaming)
│
├── StatusSummary (footer-like)
│   ├── "X rooms online" counter
│   └── LastSyncTimestamp
│
└── SettingsModal (overlay, conditional)
    ├── StreamingConfig
    │   ├── ResolutionSelect (1080p / 720p / 480p)
    │   ├── FPSSelect (30 / 20 / 15)
    │   ├── BitrateSlider (1000 - 8000 kbps, default 3000)
    │   ├── EncoderDisplay (detected GPU encoder name + type label)
    │   ├── RescanEncoderButton
    │   └── EncoderExplanation (tooltip: "Your GPU encoder for H.264. Rescan if you change your GPU.")
    ├── AudioConfig
    │   ├── AudioDeviceSelect (dropdown of system audio outputs)
    │   ├── MuteLocalToggle (mute laptop speakers during stream)
    │   └── AudioExplanation (see Section 7)
    ├── NetworkConfig
    │   └── DelayBufferInput (ms, default 74)
    ├── StreamingBarConfig
    │   ├── EnableStreamingBarToggle (default: ON)
    │   ├── BarThemeSelect (separate from main theme)
    │   └── BarOpacitySlider (50% - 100%, default 90%)
    ├── AppearanceConfig
    │   ├── MainThemeSelect ("Light (University)" / "Dark")
    │   └── BarThemeSelect ("Light" / "Dark" / "Translucent Dark")
    └── AboutSection
        ├── AppVersion
        └── LicenseInfo
```

#### Data Flow — Room Discovery
```
Firebase Realtime DB ──(onValue listener)──→ Zustand roomStore
                                               │
                              ┌────────────────┤
                              ▼                ▼
                        FloorTabs          RoomGrid
                    (extract unique     (filter by active
                     floor values)       floor tab)
```

#### Data Flow — Favorites
```
settings.json (local) ──(Tauri IPC read)──→ Zustand settingsStore
       ▲                                          │
       │                                          ▼
       └──(Tauri IPC write on toggle)──── FavoritesSection
```

---

### 3.2. Screen 2 — Connection & Configuration

Appears after clicking "Connect" on a RoomCard. In the background, a Tauri command notifies the Pi to wake up HDMI.

```
Screen2_Connection
├── BackButton (← returns to Screen 1)
│
├── RoomInfoHeader
│   ├── RoomLabel (large, e.g., "Room 101")
│   ├── StatusBadge ("Connecting..." / "Ready")
│   └── PiIPAddress (small, muted text)
│
├── StreamModeSelector
│   ├── RadioGroup
│   │   ├── Radio("Fullscreen") ← default
│   │   └── Radio("Window Capture")
│   │
│   ├── [if Fullscreen selected]
│   │   └── MonitorSelect (if multi-monitor detected)
│   │
│   └── [if Window selected]
│       └── WindowDropdown
│           ├── WindowOption (icon + "PowerPoint - Presentation.pptx")
│           ├── WindowOption (icon + "Google Chrome - UniCast Docs")
│           └── RefreshWindowListButton
│
├── AudioToggle
│   ├── Switch (ON/OFF)
│   └── Label ("Include system audio")
│
├── PINEntrySection
│   ├── InstructionText ("Enter the 4-digit PIN shown on the projector")
│   ├── PINInput (4 digit boxes, auto-focus, numeric only)
│   ├── ErrorMessage (conditional: "Wrong PIN. X attempts remaining.")
│   └── ConnectButton ("Start Streaming" - large, prominent)
│
└── ConnectionStatusFooter
    ├── ProgressIndicator (steps: Waking Pi → HDMI Ready → Awaiting PIN)
    └── CancelButton
```

#### Data Flow — Window Capture List
```
Rust (EnumWindows / CGWindowList) ──(Tauri IPC command)──→ React systemStore
                                                              │
                                                              ▼
                                                        WindowDropdown
```

#### Data Flow — PIN Verification
```
React (PIN + nonce) ──(Tauri IPC)──→ Rust ──(UDP:5001)──→ Pi
                                       ▲                    │
                                       └──── OK/FAIL ◄─────┘
                                              │
                                              ▼
                                     [OK] → start_stream()
                                     [FAIL] → show error
```

---

### 3.3. Screen 3 — Streaming Bar (Optional, Separate Window)

A minimal floating control bar. Always-on-top. Not a route — a **separate Tauri window** excluded from screen capture. **Optional** — can be disabled in settings.

```
StreamingBar (always-on-top window, WDA_EXCLUDEFROMCAPTURE)
├── DragHandle (invisible, entire bar is draggable)
├── StreamModeBadge ("🖥 Full" or "🪟 Window: PowerPoint")
├── StreamTimer ("12:34" elapsed time)
├── NetworkQualityDot (green/yellow/red — see Section 3.4)
├── StreamModeToggleButton (switch fullscreen ↔ window mid-stream)
├── AudioControlButton (speaker icon — click to expand popup)
│   └── AudioPopup (expands above or below bar, auto-direction)
│       ├── VolumeSlider (vertical, 0-100%)
│       ├── VolumePercentLabel ("75%")
│       └── MuteToggleButton (🔇 icon, toggles mute)
└── StopButton (red, "■ Stop")
```

#### Streaming Bar Features
- **Stream Mode Display**: Shows current mode (Full Screen or Window name)
- **Stream Mode Toggle**: Allows switching between fullscreen/window capture mid-stream without stopping
- **Network Quality Dot**: Real-time connection health (see Section 3.4)
- **Independent Theme**: Styled separately from main window (user picks from settings)

#### Window Behavior
- **Position**: Defaults to top-center of screen, user-draggable
- **Opacity**: Configurable (50-100%, default 90%), 100% on hover
- **Size**: Fixed 380×56px
- **Decorations**: No title bar, rounded corners (via Tauri config)
- **Not captured**: `WDA_EXCLUDEFROMCAPTURE` flag on Windows
- **Enabled by default**: User can disable in Settings

#### When Streaming Bar is Disabled
- **System Tray Icon** remains active with context menu:
  - "⏹ Stop Stream"
  - "🔇 Mute/Unmute"
  - "📊 Open UniCast" (re-show main window)
  - "❌ Quit"
- User can reopen the main window at any time to manage the stream

---

### 3.4. Network Quality Indicator — Engineering Analysis

The user asked about measuring network quality during streaming. Here's what we can measure and what makes sense:

#### What We're Actually Measuring
This is **NOT** about internet speed. It's about the **local network path quality between the sender PC and the Pi** when streaming over UDP.

#### Available Metrics (Sender-Side)

| Metric | How to Measure | Complexity | Usefulness |
|--------|---------------|------------|------------|
| **RTT (Round Trip Time)** | UDP echo to Pi (port 5005) — already implemented in `latency_tester.py` | ✅ Easy — port this to Rust | ⭐⭐⭐ Best indicator of network congestion |
| **GStreamer Pipeline State** | Monitor subprocess stdout for errors / `GST_STATE_PLAYING` | ✅ Easy | ⭐⭐ Binary: working or not |
| **GStreamer Buffer Level** | Parse `queue` element stats from gst-launch output | ⚠️ Medium — need structured output parsing | ⭐⭐ Shows if encoder keeping up |
| **Outgoing Bitrate** | Count bytes sent per second to UDP sink | ⚠️ Medium — need to instrument pipeline | ⭐ Less useful on sender side |

#### What We CAN'T Measure from Sender
- **Packet Loss**: Measured on receiver (Pi) side — UDP is fire-and-forget
- **Jitter**: Similarly receiver-side measurement
- **Decoded FPS**: Only the Pi knows actual rendered FPS

#### Proposed Solution: RTT-Based Quality Indicator
Use **periodic RTT pings** (already have the infrastructure) to determine quality:

```
RTT < 5ms   → 🟢 Green  (Excellent — LAN-like)
RTT 5-20ms  → 🟡 Yellow (Good — typical Wi-Fi)
RTT 20-50ms → 🟠 Orange (Degraded — possible congestion)
RTT > 50ms  → 🔴 Red    (Poor — user should lower bitrate)
RTT timeout → ⚫ Black  (Connection lost)
```

**Implementation**: A background Rust thread sends a UDP ping to the Pi every 2 seconds on port 5005 (echo service already exists on the Pi in `agent.py`). RTT result is emitted as a `stream-health` Tauri event. Both main window and streaming bar can subscribe.

> [!NOTE]
> This is simple, reliable, and directly actionable. We don't need complex receiver-side feedback for the first version. If Pi-side stats are needed later, we can add a periodic stats feedback channel (Pi sends stats back via UDP).

---

## 4. State Management Architecture (Zustand)

```typescript
// stores/roomStore.ts
interface RoomStore {
  rooms: Record<string, Room>;          // from Firebase
  activeFloor: string | null;           // "all" | floor number
  isLoading: boolean;
  error: string | null;
  setRooms: (rooms: Record<string, Room>) => void;
  setActiveFloor: (floor: string) => void;
}

// stores/settingsStore.ts
interface SettingsStore {
  // Favorites
  favorites: string[];                  // room IDs

  // Stream config
  resolution: "1080p" | "720p" | "480p";
  fps: 30 | 20 | 15;
  bitrate: number;                      // kbps
  delayBuffer: number;                  // ms

  // Encoder
  detectedEncoder: string | null;       // e.g., "nvh264enc"
  encoderLastScan: string | null;       // ISO timestamp

  // Audio
  audioDevice: string | null;           // device GUID
  muteLocal: boolean;                   // mute laptop speakers during stream

  // Appearance
  language: "tr" | "en";
  mainTheme: "light" | "dark";
  barTheme: "light" | "dark" | "translucent-dark";
  barOpacity: number;                   // 0.5 - 1.0

  // Streaming Bar
  streamingBarEnabled: boolean;         // default true

  // Actions
  toggleFavorite: (roomId: string) => void;
  updateSettings: (partial: Partial<SettingsStore>) => void;
  loadFromDisk: () => Promise<void>;    // reads settings.json via IPC
  saveToDisk: () => Promise<void>;      // writes settings.json via IPC
}

// stores/connectionStore.ts
interface ConnectionStore {
  phase: "idle" | "waking" | "hdmi_ready" | "awaiting_pin" | "authenticating" | "streaming";
  targetRoom: Room | null;
  streamElapsed: number;                // seconds
  streamMode: "fullscreen" | "window";  // can change mid-stream
  pinError: string | null;
  pinAttempts: number;
  isMuted: boolean;
  streamVolume: number;                 // 0.0 - 1.0
  networkQuality: "excellent" | "good" | "degraded" | "poor" | "lost";
  lastRTT: number | null;              // ms

  connect: (room: Room) => void;
  submitPIN: (pin: string) => Promise<boolean>;
  startStream: () => void;
  stopStream: () => void;
  toggleMute: () => void;
  setStreamVolume: (volume: number) => void;
  switchStreamMode: (mode: "fullscreen" | "window") => void;
}

// stores/systemStore.ts
interface SystemStore {
  openWindows: WindowInfo[];            // from Rust EnumWindows
  selectedWindow: WindowInfo | null;
  availableMonitors: MonitorInfo[];
  selectedMonitor: number;
  refreshWindows: () => Promise<void>;
}
```

---

## 5. Tauri IPC Bridge (Rust ↔ React)

### 5.1. Tauri Commands (React calls Rust)

| Command | Arguments | Returns | Purpose |
|---------|-----------|---------|---------|
| `detect_encoder` | — | `EncoderResult { name, type }` | GPU fallback chain test (NVIDIA→Intel→AMD→CPU) |
| `get_open_windows` | — | `Vec<WindowInfo>` | EnumWindows / CGWindowList |
| `get_audio_devices` | — | `Vec<AudioDevice>` | WASAPI / PulseAudio enumeration |
| `read_settings` | — | `Settings` JSON | Read settings.json |
| `write_settings` | `Settings` JSON | `bool` | Write settings.json |
| `verify_pin` | `{ target_ip, pin }` | `{ success, message }` | UDP:5001 challenge-response |
| `start_stream` | `StreamConfig` | `{ success, pid }` | Launch GStreamer subprocess |
| `stop_stream` | — | `bool` | Kill GStreamer process |
| `switch_stream_mode` | `{ mode, window_id? }` | `bool` | Switch fullscreen↔window mid-stream |
| `set_stream_volume` | `{ volume: f32, mute: bool }` | `bool` | Control GStreamer volume element (no pipeline restart) |
| `mute_system_audio` | `bool` | `bool` | Mute/restore laptop speakers (OS API) |
| `wake_pi_hdmi` | `{ target_ip }` | `bool` | Signal Pi to turn on HDMI |
| `get_monitors` | — | `Vec<MonitorInfo>` | Multi-monitor detection |
| `set_bar_capture_exclusion` | `{ hwnd }` | `bool` | Apply WDA_EXCLUDEFROMCAPTURE |

### 5.2. Tauri Events (Rust pushes to React)

| Event | Payload | Purpose |
|-------|---------|---------|
| `stream-health` | `{ rtt_ms, quality }` | Periodic RTT-based quality (every 2s) |
| `encoder-found` | `{ name, hw_type }` | Async encoder detection result |
| `stream-error` | `{ code, message }` | GStreamer pipeline errors |
| `stream-started` | `{ pid }` | Confirm stream is running |
| `stream-stopped` | `{ reason }` | Stream ended (user/error/Pi disconnect) |

---

## 6. Firebase Integration & Security Architecture

### Client-Side Setup (React — JS SDK)
```
src/
└── services/
    └── firebase.ts          ← Firebase app init + Anonymous Auth
    └── roomService.ts       ← onValue listener for /rooms
```

### Security Flow
1. App starts → `signInAnonymously()` (silent, no user action)
2. Auth token obtained → subscribe to `/rooms` with `onValue`
3. Realtime updates flow into `roomStore`

### Security Analysis — Sabotage Scenarios

| Attack Vector | Risk Level | Defense |
|--------------|------------|---------|
| **Read room data** (room names, Pi IPs) | 🟡 Low | Requires Anonymous Auth. Data is non-sensitive — same info discoverable via network scan. |
| **Modify room data** (fake status, wrong IP) | 🟢 None | Firebase write rules: `auth.token.email === 'pi-XXX@unicast.local'`. Only authenticated Pi devices can write to their own room. |
| **Hijack a stream** (connect to Pi without permission) | 🟢 None | PIN is displayed physically on projector → requires physical presence. UDP verification directly with Pi. 3 failed attempts → IP blocked by Pi. |
| **DoS Firebase** (spam requests) | 🟡 Low | Firebase rate-limits by default. Anonymous Auth has quotas. Worst case: Firebase auto-blocks abusive clients. |
| **Reverse-engineer API key** | 🟢 None | Firebase API keys are **designed to be public** (like Twitter's). All security is in the server-side rules. Even with the key, an attacker can only read room data (which is public info). |

**Verdict**: JS SDK frontend approach is safe. The real security gates are:
1. Firebase security rules (write-protection per device)
2. PIN mechanism (physical access required)
3. Rate limiting on Pi (brute-force protection)

### Offline Handling
- Firebase SDK has built-in offline persistence
- If network drops, last-known room data stays in UI
- `StatusSummary` shows "Offline — showing cached data"

---

## 7. Audio Management Architecture — Detailed

### How GStreamer Loopback Works (Technical)

```
┌──────────────────────────────────────────────────┐
│                    WINDOWS OS                     │
│                                                   │
│  App Audio ──→ [Windows Audio Mixer] ──→ Speakers │
│                        │                          │
│                        ▼                          │
│              [WASAPI Loopback Tap]                 │
│                        │                          │
│                        ▼                          │
│              GStreamer captures here               │
│              (BEFORE speakers)                     │
└──────────────────────────────────────────────────┘
```

**Key insight**: WASAPI loopback captures audio from the **mixer level**, not from the speakers. So even if the laptop speakers are muted (volume = 0), the audio data still flows through the mixer and GStreamer can capture it.

### Stream Audio Flow
```
Teacher plays video ──→ Windows Mixer ──→ GStreamer Loopback Capture
                              │                      │
                              ▼                      ▼
                    Laptop Speakers          Opus Encode → UDP → Pi
                    (MUTED by app)          (plays on projector speakers)
```

### User Controls

| Control | Location | What it does |
|---------|----------|--------------|
| **"Mute local audio" toggle** | Settings (default: ON) | When ON, laptop speakers automatically muted when stream starts. Restored when stream stops. |
| **"Audio ON/OFF" switch** | Screen 2 (Connection) | Include or exclude audio from the stream entirely. |
| **Audio Control Button** | Streaming Bar | Click → expands a mini popup with volume slider + mute toggle |
| **Volume Slider** | Streaming Bar Popup | Controls volume level sent to projector (0-100%) via GStreamer `volume` element |
| **Mute Toggle** | Streaming Bar Popup | Toggle projector audio on/off. Does NOT affect laptop. |

### Audio Popup UX (Streaming Bar)
The streaming bar's audio button works like Windows taskbar volume:
- **Default state**: Speaker icon on the bar (🔊 or 🔇 if muted)
- **Click**: A small popup expands **upward** (if bar is at top) or **downward** (if bar is at bottom)
- **Popup contents**: Vertical slider + mute toggle + percentage label
- **Dismiss**: Click outside popup or click audio button again
- **Size**: ~48×160px popup, doesn't clutter the bar
- **Also excluded from capture**: Popup inherits bar's `WDA_EXCLUDEFROMCAPTURE`

### GStreamer Mute/Volume — Zero Interruption
Critical engineering detail: **Mute/volume changes do NOT restart the GStreamer pipeline.**

```
Audio Capture → [volume element] → Opus Encoder → RTP → UDP Sink
                     ↑
              set_property("mute", true)   → silence frames
              set_property("volume", 0.7)  → 70% volume
```

- `volume` element is part of the pipeline from the start
- Mute: `volume.set_property("mute", true)` → outputs silence, pipeline keeps running
- Unmute: `volume.set_property("mute", false)` → audio resumes instantly
- Volume: `volume.set_property("volume", 0.0 - 1.0)` → smooth adjustment
- **Opus encoder with silence**: ~2 bytes/frame (DTX — Discontinuous Transmission). Negligible bandwidth.
- **No PIN renegotiation**, no connection drop, no latency spike
- This is the standard approach used by Zoom, Teams, Discord

### Behavior Summary
- Stream starts → If "mute local" enabled: laptop volume → 0 (programmatic via OS API)
- Audio still captured by GStreamer loopback (mixer-level capture)
- Audio sent to Pi → plays on projector speakers
- **Teacher hears audio from projector, not from their laptop** (desired behavior)
- Stream stops → laptop volume restored to previous level
- Teacher CAN disable "mute local" in settings if they want audio from both
- **Volume/mute changes are instantaneous with zero stream interruption**

---

## 8. Encoder Detection — Explained

### What It Is
When the app first launches, it needs to determine which **H.264 video encoder** works on this specific PC's hardware. Different PCs have different GPUs, and each GPU brand has its own encoder:

### GPU Fallback Chain
```
1. nvh264enc    → NVIDIA GPU (GeForce/Quadro) — fastest
2. qsvh264enc   → Intel QuickSync (integrated GPU on most laptops)
3. amfh264enc   → AMD/ATI GPU
4. x264enc      → Software (CPU) — works everywhere but slower, higher CPU usage
```

### Detection Process
1. App launches → checks `settings.json` for `encoder.detected`
2. If not found OR `last_scan` older than 7 days → run detection:
   - Build a tiny 10-frame test pipeline for each encoder
   - If pipeline succeeds → encoder works → save to settings
   - If fails → try next in chain
3. Result shown in Settings as "Encoder: NVIDIA H.264 (nvh264enc)"
4. **Manual "Rescan" button** available if user changes GPU or installs new drivers
5. Detection runs **asynchronously** (background thread) so the UI doesn't freeze

### Timing Strategy
- **First launch**: Always run (no saved data)
- **Subsequent launches**: Skip if last scan < 7 days old
- **Manual trigger**: Always available in Settings
- **Auto re-scan**: If saved encoder fails during actual streaming → auto-trigger fallback

---

## 9. Settings Persistence (`settings.json`)

Stored in Tauri's `app_data_dir()` (platform-specific):
- Windows: `%APPDATA%/com.unicast.app/settings.json`
- macOS: `~/Library/Application Support/com.unicast.app/settings.json`
- Linux: `~/.config/com.unicast.app/settings.json`

### Schema
```json
{
  "version": 1,
  "language": "tr",
  "favorites": ["101", "003-005"],
  "stream": {
    "resolution": "1080p",
    "fps": 30,
    "bitrate": 3000,
    "delay_buffer_ms": 74
  },
  "audio": {
    "device_id": null,
    "mute_local": true
  },
  "encoder": {
    "detected": "nvh264enc",
    "last_scan": "2026-04-06T12:00:00Z"
  },
  "appearance": {
    "main_theme": "light",
    "bar_theme": "translucent-dark",
    "bar_opacity": 0.9
  },
  "streaming_bar": {
    "enabled": true
  }
}
```

---

## 10. Internationalization (i18n)

### File Structure
```
src/
└── locales/
    ├── tr.json        ← Turkish (default)
    └── en.json        ← English
```

### Key Namespace Structure
```json
{
  "app": { "title": "UniCast" },
  "rooms": {
    "title": "Classrooms",
    "favorites": "Favorites",
    "status": {
      "idle": "Available",
      "streaming": "In Use",
      "offline": "Offline"
    },
    "floors": {
      "all": "All",
      "ground": "Ground Floor",
      "floor_n": "Floor {{n}}"
    }
  },
  "connection": {
    "pin_prompt": "Enter the 4-digit PIN shown on the projector",
    "connecting": "Connecting...",
    "wrong_pin": "Wrong PIN. {{remaining}} attempts remaining.",
    "mode_fullscreen": "Full Screen",
    "mode_window": "Window Capture"
  },
  "stream": {
    "stop": "Stop",
    "mute": "Mute",
    "unmute": "Unmute",
    "elapsed": "Streaming",
    "quality": {
      "excellent": "Excellent",
      "good": "Good",
      "degraded": "Degraded",
      "poor": "Poor",
      "lost": "Connection Lost"
    }
  },
  "settings": {
    "title": "Settings",
    "resolution": "Resolution",
    "bitrate": "Bitrate (kbps)",
    "encoder": "Encoder",
    "rescan": "Rescan Hardware",
    "audio_device": "Audio Source",
    "mute_local": "Mute laptop speakers during stream",
    "delay": "Sync Buffer (ms)",
    "streaming_bar": "Show streaming control bar",
    "main_theme": "App Theme",
    "bar_theme": "Streaming Bar Theme",
    "bar_opacity": "Bar Transparency"
  }
}
```

---

## 11. Theming & Design System

### University Brand Colors (ALKÜ)
The design system is built around the university's official brand colors:

```
ALKÜ Turquoise:   rgb(0, 174, 205)   → hsl(192, 100%, 40%)
ALKÜ Navy:        rgb(28, 64, 125)   → hsl(218, 63%, 30%)
ALKÜ Gold:        rgb(209, 173, 83)  → hsl(43, 60%, 57%)
```

### Light Theme (University / Default)
```css
[data-theme="light"] {
  /* Background layers */
  --bg-primary:    hsl(210, 20%, 98%);     /* Page background — near-white with blue tint */
  --bg-secondary:  hsl(210, 25%, 95%);     /* Cards, panels */
  --bg-tertiary:   hsl(210, 20%, 90%);     /* Hover states */

  /* Text */
  --text-primary:  hsl(218, 63%, 15%);     /* Dark navy-based */
  --text-secondary: hsl(218, 30%, 40%);
  --text-muted:    hsl(218, 15%, 55%);

  /* Brand Accent — ALKÜ Turquoise */
  --accent:        hsl(192, 100%, 40%);    /* rgb(0, 174, 205) — primary actions */
  --accent-hover:  hsl(192, 100%, 35%);    /* Slightly darker on hover */
  --accent-subtle: hsl(192, 60%, 92%);     /* Light turquoise background */

  /* Secondary Accent — ALKÜ Navy */
  --accent-secondary:       hsl(218, 63%, 30%);  /* rgb(28, 64, 125) — headers, emphasis */
  --accent-secondary-hover: hsl(218, 63%, 25%);
  --accent-secondary-subtle: hsl(218, 40%, 93%);

  /* Tertiary — ALKÜ Gold */
  --accent-gold:        hsl(43, 60%, 57%);   /* rgb(209, 173, 83) — stars, badges, highlights */
  --accent-gold-hover:  hsl(43, 60%, 50%);
  --accent-gold-subtle: hsl(43, 50%, 93%);

  /* Status Colors */
  --status-idle:      hsl(160, 65%, 42%);    /* Teal-green (harmonizes with turquoise) */
  --status-streaming: hsl(32, 90%, 52%);     /* Warm orange */
  --status-offline:   hsl(218, 10%, 65%);    /* Muted navy-gray */
  --status-error:     hsl(0, 68%, 52%);      /* Red */

  /* Borders */
  --border:        hsl(218, 20%, 88%);
  --border-hover:  hsl(192, 40%, 75%);       /* Turquoise-tinted on hover */

  /* Favorites star */
  --star-active:   hsl(43, 60%, 57%);        /* ALKÜ Gold */
}
```

### Dark Theme
```css
[data-theme="dark"] {
  /* Background layers */
  --bg-primary:    hsl(220, 25%, 8%);     /* Deep navy-black */
  --bg-secondary:  hsl(220, 22%, 12%);    /* Cards */
  --bg-tertiary:   hsl(220, 20%, 16%);    /* Hover */

  /* Text */
  --text-primary:  hsl(210, 20%, 95%);
  --text-secondary: hsl(210, 15%, 60%);
  --text-muted:    hsl(210, 10%, 40%);

  /* Brand Accent — ALKÜ Turquoise (brightened for dark backgrounds) */
  --accent:        hsl(192, 90%, 50%);
  --accent-hover:  hsl(192, 90%, 58%);
  --accent-subtle: hsl(192, 60%, 12%);

  /* Secondary — ALKÜ Navy (lightened for dark mode) */
  --accent-secondary:       hsl(218, 55%, 55%);
  --accent-secondary-hover: hsl(218, 55%, 63%);

  /* Tertiary — ALKÜ Gold */
  --accent-gold:        hsl(43, 65%, 60%);
  --accent-gold-hover:  hsl(43, 65%, 68%);

  /* Status */
  --status-idle:      hsl(160, 60%, 48%);
  --status-streaming: hsl(32, 90%, 58%);
  --status-offline:   hsl(220, 10%, 35%);
  --status-error:     hsl(0, 72%, 55%);

  /* Borders */
  --border:        hsl(220, 18%, 18%);
  --border-hover:  hsl(192, 30%, 25%);
}
```

### Streaming Bar Themes (Independent)
```css
[data-bar-theme="light"] {
  --bar-bg: hsl(210, 20%, 97%);
  --bar-text: hsl(218, 63%, 15%);
  --bar-border: hsl(218, 20%, 85%);
}

[data-bar-theme="dark"] {
  --bar-bg: hsl(220, 25%, 10%);
  --bar-text: hsl(210, 20%, 95%);
  --bar-border: hsl(220, 18%, 20%);
}

[data-bar-theme="translucent-dark"] {
  --bar-bg: hsla(220, 25%, 10%, 0.85);  /* Semi-transparent */
  --bar-text: hsl(210, 20%, 95%);
  --bar-border: hsla(192, 40%, 40%, 0.3); /* Subtle turquoise glow */
  backdrop-filter: blur(12px);
}
```

### Typography
- **Font**: `Inter` (Google Fonts) — clean, modern, excellent at small sizes
- **Heading**: 600 weight
- **Body**: 400 weight
- **Monospace** (PIN, IP): `JetBrains Mono`

### Motion
- **Page transitions**: `framer-motion` slide + fade (200ms)
- **Card hover**: scale(1.02) + border glow (150ms ease)
- **Status dot**: pulse animation for "idle" state
- **Streaming timer**: subtle digit transition animation

### Design Usage
- **Turquoise**: Primary buttons, links, active tabs, progress indicators
- **Navy**: Headers, sidebar backgrounds, emphasis text, TopBar background (light theme)
- **Gold**: Favorite stars, achievement badges, premium highlights, active status rings

---

## 12. Streaming Bar — Detailed Design

The streaming bar is a **second Tauri window**, not a route. It has its **own independent theme** selectable in settings.

### Tauri Configuration (tauri.conf.json)
```json
{
  "windows": [
    {
      "label": "main",
      "title": "UniCast",
      "width": 960,
      "height": 640,
      "minWidth": 800,
      "minHeight": 550,
      "center": true,
      "resizable": true
    },
    {
      "label": "streaming-bar",
      "title": "UniCast Stream",
      "width": 380,
      "height": 56,
      "resizable": false,
      "alwaysOnTop": true,
      "decorations": false,
      "transparent": true,
      "visible": false,
      "url": "/streaming-bar"
    }
  ]
}
```

### Communication Between Windows
Main Window and Streaming Bar share state via **Tauri Events** (not direct React state):
1. Main window calls `start_stream` → Rust starts GStreamer → Rust emits `stream-started` event
2. Both windows listen to Tauri events for state sync (`stream-health`, `stream-stopped`)
3. Stop button in bar → calls `stop_stream` Rust command → Rust emits `stream-stopped` → Main window re-shows
4. Stream mode switch in bar → calls `switch_stream_mode` → pipeline restarts with new source

### Screen Capture Exclusion
After streaming bar window is created, Rust calls `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` to prevent it from appearing in the stream. This is done in the `main.rs` window creation hook.

---

## 13. Frontend Directory Structure

```
core/
├── app/                             ← Tauri project root (NEW)
│   ├── public/
│   │   └── tauri-icon.png
│   ├── src/
│   │   ├── main.tsx                 ← React entry point
│   │   ├── App.tsx                  ← Router setup
│   │   ├── index.css                ← Tailwind imports + global styles + theme vars
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                  ← Reusable primitives
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Toggle.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Slider.tsx
│   │   │   │   ├── PINInput.tsx
│   │   │   │   ├── Tabs.tsx
│   │   │   │   └── Tooltip.tsx
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── TopBar.tsx
│   │   │   │   ├── StatusSummary.tsx
│   │   │   │   └── SystemTray.tsx    ← Tray icon context menu
│   │   │   │
│   │   │   ├── rooms/
│   │   │   │   ├── RoomCard.tsx
│   │   │   │   ├── RoomGrid.tsx
│   │   │   │   ├── FloorTabs.tsx
│   │   │   │   └── FavoritesSection.tsx
│   │   │   │
│   │   │   ├── connection/
│   │   │   │   ├── StreamModeSelector.tsx
│   │   │   │   ├── WindowDropdown.tsx
│   │   │   │   ├── AudioToggle.tsx
│   │   │   │   ├── PINEntry.tsx
│   │   │   │   └── ConnectionProgress.tsx
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── SettingsModal.tsx
│   │   │   │   ├── StreamingConfig.tsx
│   │   │   │   ├── AudioConfig.tsx
│   │   │   │   ├── NetworkConfig.tsx
│   │   │   │   ├── AppearanceConfig.tsx    ← Theme + Bar settings
│   │   │   │   └── StreamingBarConfig.tsx ← Bar enable/disable + theme
│   │   │   │
│   │   │   └── streaming/
│   │   │       ├── StreamingBar.tsx
│   │   │       ├── AudioPopup.tsx           ← Expandable volume/mute popup
│   │   │       └── NetworkQualityDot.tsx
│   │   │
│   │   ├── screens/
│   │   │   ├── RoomDiscovery.tsx       ← Screen 1
│   │   │   ├── ConnectionSetup.tsx     ← Screen 2
│   │   │   └── StreamingBarApp.tsx     ← Streaming bar window root
│   │   │
│   │   ├── stores/
│   │   │   ├── roomStore.ts
│   │   │   ├── settingsStore.ts
│   │   │   ├── connectionStore.ts
│   │   │   └── systemStore.ts
│   │   │
│   │   ├── services/
│   │   │   ├── firebase.ts
│   │   │   ├── roomService.ts
│   │   │   └── ipc.ts                  ← Typed Tauri invoke wrappers
│   │   │
│   │   ├── locales/
│   │   │   ├── tr.json
│   │   │   └── en.json
│   │   │
│   │   ├── hooks/
│   │   │   ├── useFirebaseRooms.ts
│   │   │   ├── useSettings.ts
│   │   │   ├── useStreamTimer.ts
│   │   │   ├── useEncoder.ts
│   │   │   └── useNetworkQuality.ts
│   │   │
│   │   └── types/
│   │       ├── room.ts
│   │       ├── settings.ts
│   │       ├── stream.ts
│   │       └── ipc.ts
│   │
│   ├── src-tauri/                      ← Rust backend
│   │   ├── src/
│   │   │   ├── main.rs                 ← Tauri entry, window management, capture exclusion
│   │   │   ├── commands/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── encoder.rs          ← detect_encoder(), fallback chain
│   │   │   │   ├── stream.rs           ← start_stream(), stop_stream(), switch_mode()
│   │   │   │   ├── windows.rs          ← get_open_windows()
│   │   │   │   ├── audio.rs            ← get_audio_devices(), mute_system_audio()
│   │   │   │   ├── settings.rs         ← read/write settings.json
│   │   │   │   ├── auth.rs             ← verify_pin() via UDP
│   │   │   │   ├── monitors.rs         ← get_monitors()
│   │   │   │   └── network.rs          ← RTT ping service for quality indicator
│   │   │   │
│   │   │   ├── gstreamer/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── path_setup.rs       ← Dynamic PATH for portable GStreamer
│   │   │   │   └── pipeline.rs         ← Pipeline string builders
│   │   │   │
│   │   │   └── utils/
│   │   │       ├── mod.rs
│   │   │       ├── process.rs          ← GStreamer subprocess lifecycle
│   │   │       └── capture_exclusion.rs ← WDA_EXCLUDEFROMCAPTURE implementation
│   │   │
│   │   ├── tauri.conf.json
│   │   ├── Cargo.toml
│   │   └── icons/
│   │
│   ├── package.json
│   ├── tailwind.config.js              ← Tailwind v3 JS config
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── src/                                ← Existing: Python scripts
│   ├── receiver/
│   │   ├── agent.py
│   │   └── benchmarker.py
│   ├── sender/
│   │   └── latency_tester.py
│   └── analytics/
│       └── report_generator.py
│
├── Roadmap/
├── CLAUDE.md
├── progress.md
└── README.md
```

> [!NOTE]
> **Why `core/app/`?** Separation of concerns: `core/src/` contains the existing Python infrastructure (receiver, sender, analytics). `core/app/` is the new Tauri desktop client. Each has its own dependency tree, build system, and lifecycle. Clean boundary for git, CI/CD, and team understanding.

---

## 14. Error Handling Strategy

| Scenario | User Sees | Technical Action |
|----------|-----------|-----------------|
| Firebase offline | "Showing cached rooms" banner | Use last-known `roomStore` data |
| Pi unreachable (ping fail) | "Room not responding" toast | Timeout after 5s on UDP connect |
| Wrong PIN | "Wrong PIN. 2 attempts remaining" | Pi returns `FAIL`, decrement counter |
| 3 failed PINs | "Too many attempts. Try again later" | Pi blocks IP for 5 min |
| GStreamer crash | "Stream interrupted" modal + auto-return to Screen 1 | Detect process exit, cleanup |
| No encoder found | "Using software encoding (slower)" info | Fallback to x264enc |
| DRM/black screen | "No video signal detected" warning after 10s | Frame watchdog timer |
| Network degradation | Yellow/Red dot on streaming bar + "Lower bitrate?" suggestion | RTT > 50ms triggers warning |
| Streaming bar disabled + stream active | Tray icon shows "streaming" state | Right-click tray for controls |

---

## Resolved Questions Summary

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| Q1 | Tailwind version | **v3** | Better WebView compatibility across Win/Mac/Linux |
| Q2 | Firebase SDK location | **React (JS SDK)** | Security is in rules, not key hiding. Simpler implementation. |
| Q3 | Streaming bar quality indicator | **Yes — RTT-based** | Simple to implement (UDP echo exists), directly actionable |
| Q4 | Audio strategy | **Programmatic mute + toggle** | Portable, no driver install. User controls via toggle. |
| Q5 | Project location | **`core/app/`** | Clean separation from existing Python infrastructure |
| Q6 | Encoder detection timing | **First launch + 7-day auto + manual button** | Balance between performance and accuracy |

---

## 15. Cross-Platform Compatibility Matrix

Every OS-specific API in the system, analyzed for Windows 10+, macOS (Intel), Ubuntu 20.04+, and Wayland Linux.

### Minimum Supported Platforms
| Platform | Minimum Version | WebView Engine | GStreamer Source |
|----------|----------------|----------------|------------------|
| Windows | 10 Build 19041 (2004) | WebView2 (Chromium) | Portable bundle (~150MB) |
| macOS | 11 Big Sur (Intel) | WebKit (Safari) | Homebrew → bundled in .app |
| Ubuntu | 20.04 LTS | WebKit (WPE) | System apt + AppImage bundle |
| Fedora/Arch | Latest | WebKit (WPE) | System packages |

### 15.1. Screen Capture

| OS | GStreamer Element | Notes | Risk |
|----|------------------|-------|------|
| **Windows** | `d3d11screencapturesrc` | DirectX 11, works on Win10+. Best performance. | 🟢 Low |
| **macOS** | `avfvideosrc capture-screen=true` | AVFoundation. **Requires user to grant Screen Recording permission** in System Preferences. If not granted → silent black frames (no error). | 🟡 Medium |
| **Linux X11** | `ximagesrc` | Works well on X11 sessions. No permission needed. | 🟢 Low |
| **Linux Wayland** | `pipewiresrc` | PipeWire portal required. User sees a "Share Screen" dialog first. | 🟡 Medium |

**Mitigation for macOS permission**:
- On first launch, detect if permission is granted via `CGPreflightScreenCaptureAccess()` (macOS 10.15+)
- If not granted, show a clear in-app guide: "Go to System Preferences → Privacy → Screen Recording → Enable UniCast"
- Add a "Test Capture" button that shows a preview so user can verify it works

**Mitigation for Wayland**:
- Detect if running on Wayland via `$XDG_SESSION_TYPE` environment variable
- Automatically use `pipewiresrc` instead of `ximagesrc`
- PipeWire screen share dialog is system-native and expected by users

### 15.2. Audio Capture (⚠️ Most Critical Cross-Platform Gap)

| OS | GStreamer Element | Loopback Support | Risk |
|----|------------------|-----------------|------|
| **Windows** | `wasapi2src loopback=true` | ✅ Native — captures system audio at mixer level | 🟢 Low |
| **macOS** | `osxaudiosrc` | ❌ **No native loopback!** macOS does not expose system audio capture. | 🔴 High |
| **Linux (PulseAudio)** | `pulsesrc device=<monitor>` | ✅ Built-in — PulseAudio has "Monitor of" devices | 🟢 Low |
| **Linux (PipeWire)** | `pipewiresrc` | ✅ PipeWire can capture output audio | 🟢 Low |

**macOS Audio Problem — Detailed**:
macOS fundamentally blocks applications from capturing system audio output. Two solutions exist:

| Solution | How | Pros | Cons |
|----------|-----|------|------|
| **A) BlackHole** (virtual audio driver) | Install BlackHole 2ch, route audio through it | Clean capture, no latency | Requires install (breaks portable principle), needs admin rights |
| **B) ScreenCaptureKit audio** (macOS 13+) | macOS 13 Ventura introduced `SCStreamConfiguration` with audio capture | Native, no drivers needed | Only macOS 13+, no GStreamer element exists yet — would need custom plugin or subprocess |
| **C) No audio on macOS** (MVP) | Simply disable audio toggle on macOS | Zero complexity | Reduced functionality |

> [!WARNING]
> **Recommendation for macOS audio**: Start with **Option C (no audio)** for MVP. macOS market share among university teachers is low compared to Windows. If audio is needed later, implement **Option A (BlackHole)** with bundled installer. Option B is the ideal long-term solution but requires custom GStreamer integration.

### 15.3. Video Encoding (H.264 Encoder Chains)

H.265 is NOT needed — the Pi receiver uses `avdec_h264` (H.264 decoder). All platforms must output H.264.

| OS | Encoder Chain (Priority Order) | Notes |
|----|-------------------------------|-------|
| **Windows** | 1. `nvh264enc` (NVIDIA) → 2. `qsvh264enc` (Intel QSV) → 3. `amfh264enc` (AMD) → 4. `x264enc` (CPU) | All well-tested. Most laptops have Intel QSV at minimum. |
| **macOS** | 1. `vtenc_h264` (VideoToolbox) → 2. `x264enc` (CPU) | VideoToolbox is hardware-accelerated on both Intel and Apple Silicon. Works excellently. Only 2 fallback levels needed. |
| **Linux** | 1. `vaapih264enc` (VA-API: Intel/AMD) → 2. `nvh264enc` (NVIDIA) → 3. `x264enc` (CPU) | VA-API covers most Intel integrated GPUs on Ubuntu 20.04+. |

**Rust implementation**: The `detect_encoder()` command uses `#[cfg(target_os)]` to select the appropriate chain:
```rust
#[cfg(target_os = "macos")]
const ENCODER_CHAIN: &[&str] = &["vtenc_h264", "x264enc"];

#[cfg(target_os = "windows")]
const ENCODER_CHAIN: &[&str] = &["nvh264enc", "qsvh264enc", "amfh264enc", "x264enc"];

#[cfg(target_os = "linux")]
const ENCODER_CHAIN: &[&str] = &["vaapih264enc", "nvh264enc", "x264enc"];
```

### 15.4. Window Enumeration (Window Capture Mode)

| OS | API | Rust Crate | Notes |
|----|-----|-----------|-------|
| **Windows** | `EnumWindows` (Win32) | `windows` crate | Returns all top-level windows with titles and HWNDs |
| **macOS** | `CGWindowListCopyWindowInfo` | `core-graphics` crate | Returns window list with names, PIDs, bounds |
| **Linux X11** | `XQueryTree` + `_NET_WM_NAME` | `x11rb` crate | Standard X11 approach |
| **Linux Wayland** | Not directly available | N/A | Wayland isolates windows. Use PipeWire portal for window selection (shows system dialog). |

**Wayland workaround**: On Wayland, window capture uses `xdg-desktop-portal` which shows the user a native dialog to select which window to share. This is by design — Wayland prioritizes privacy.

### 15.5. System Audio Mute (Laptop Speakers)

| OS | Method | Rust Crate | Notes |
|----|--------|-----------|-------|
| **Windows** | `IAudioEndpointVolume::SetMute()` | `windows` crate (COM API) | Clean, per-endpoint control |
| **macOS** | CoreAudio `AudioObjectSetPropertyData` or `osascript -e "set volume output muted true"` | `coreaudio-rs` or subprocess | Both work, subprocess is simpler |
| **Linux** | `pactl set-sink-mute @DEFAULT_SINK@ toggle` | subprocess | Works on both PulseAudio and PipeWire |

All platforms support save/restore of previous volume level.

### 15.6. Streaming Bar Capture Exclusion

| OS | Method | Support Level |
|----|--------|---------------|
| **Windows** | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` | ✅ Win10 2004+ (our minimum) |
| **macOS** | `window.sharingType = .none` (NSWindow) | ✅ macOS 12.0+ |
| **Linux X11** | No direct equivalent | ⚠️ Bar may appear in capture. Workaround: set `_NET_WM_WINDOW_TYPE_DOCK` or use Window Capture mode instead of Full Screen to avoid |
| **Linux Wayland** | PipeWire portal excludes non-shared windows by default | ✅ Built-in |

> [!NOTE]
> Linux X11 is the only platform where capture exclusion is imperfect. Since Window Capture mode (which captures only a specific window) naturally excludes the bar, this is a practical workaround.

### 15.7. Portable GStreamer Bundling

| OS | Strategy | Bundle Size | Notes |
|----|----------|-------------|-------|
| **Windows** | Copy GStreamer MinGW runtime into `app/gstreamer/` | ~150MB (can be trimmed to ~80MB with only needed plugins) | Dynamic PATH setup at runtime |
| **macOS** | Copy `.dylib` files into `SinifYayini.app/Contents/Frameworks/` + fix rpaths with `install_name_tool` | ~120MB | Standard macOS framework bundling |
| **Linux** | System GStreamer for dev; `linuxdeploy-plugin-gstreamer` for AppImage | ~100MB in AppImage | AppImage bundles everything |

### Cross-Platform Risk Summary

| Feature | Windows | macOS | Linux X11 | Linux Wayland |
|---------|---------|-------|-----------|---------------|
| Screen Capture | 🟢 | 🟡 Permission | 🟢 | 🟡 Portal Dialog |
| Audio Capture | 🟢 | 🔴 No native loopback | 🟢 | 🟢 |
| Video Encoding | 🟢 | 🟢 VideoToolbox | 🟢 VA-API | 🟢 VA-API |
| Window List | 🟢 | 🟢 | 🟢 | 🟡 Portal |
| Audio Mute | 🟢 | 🟢 | 🟢 | 🟢 |
| Capture Exclusion | 🟢 | 🟢 | ⚠️ Limited | 🟢 Built-in |
| GStreamer Bundle | 🟢 | 🟢 | 🟢 | 🟢 |

---

## 16. System Architecture Gap Analysis

Beyond the UI — potential issues in the **overall UniCast system** and proposed mitigations.

### 16.1. Graceful Disconnect Handling
**Problem**: Teacher closes laptop lid or Wi-Fi drops mid-stream. GStreamer subprocess on PC dies, but Pi doesn't know — it keeps listening on ports 5000/5002 indefinitely, showing a frozen frame.

**Solution**:
- **Sender-side heartbeat**: Rust background thread sends a small UDP "ALIVE" packet to Pi on port 5001 every 3 seconds
- **Pi-side timeout**: If Pi receives no heartbeat for 10 seconds → assume disconnect → kill GStreamer pipelines → return to idle screen → update Firebase status to "idle"
- **Tauri cleanup**: Tauri `on_window_event(CloseRequested)` hook kills GStreamer subprocess and sends a "DISCONNECT" packet to Pi before closing

### 16.2. Dual-User Conflict
**Problem**: Two users try to connect to the same Pi simultaneously. Ports 5000/5002 would conflict.

**Solution** (already partially designed but needs enforcement):
- Firebase `pi_status == "streaming"` → UI disables "Connect" button for that room
- Pi rejects new UDP auth requests when already streaming (port 5001 responds `b"BUSY"`)
- UI shows "This room is currently in use by another user" message
- **Edge case**: If Firebase update is delayed, Pi-side rejection is the ultimate guard

### 16.3. GStreamer Zombie Process Cleanup
**Problem**: If the Tauri app crashes (not clean exit), GStreamer subprocess may remain running, holding ports and sending data.

**Solution**:
- On app startup, Rust scans for orphaned `gst-launch-1.0` processes and kills them
- Use process groups on Unix (`setsid`) so all child processes die with the parent
- On Windows, use Job Objects to ensure child process termination
- Pi-side: heartbeat timeout (16.1) handles the receiver cleanup

### 16.4. Portable GStreamer Bundle Size
**Problem**: Full GStreamer runtime is ~500MB. Bundling everything makes the app too large.

**Solution**: Only bundle required plugins. Minimal plugin set:
```
Required plugins (~80-150MB depending on OS):
- gstcoreelements    (queue, tee, etc.)
- gstvideoconvert    (colorspace conversion)
- gstvideoscale      (resolution scaling)
- gstx264            (software H.264 encoder)
- gstrtpmanager      (RTP packaging)
- gstudp             (UDP sink)
- gstopus            (Opus audio codec)
- gstaudioconvert    (audio format conversion)
- gstvolume          (volume control)
- gstwasapi2 (Win)   / gstpulseaudio (Linux) / gstosxaudio (Mac)
- gstd3d11 (Win)     / gstximagesrc (Linux) / gstavf (Mac)
- gstnvcodec         (NVIDIA, optional)
- gstqsv             (Intel, optional)
```
Strip debug symbols. On Windows this reduces ~500MB → ~80-100MB.

### 16.5. First-Time User Experience (Onboarding)
**Problem**: Teacher opens app for first time. Encoder detection runs (1-2 sec), Firebase needs auth, no favorites set. Could feel confusing.

**Solution**:
- **Splash screen**: Show app logo + "Detecting hardware..." during first-time encoder scan
- **Auto-detect language**: Match OS locale (Turkish if system is Turkish, English otherwise)
- **Empty state**: If no rooms found, show helpful illustration + "Waiting for classrooms to come online"
- **Tooltip hints**: First-time tooltips on key elements (Favorites star, Settings gear)

### 16.6. macOS Screen Recording Permission (First-Launch UX)
**Problem**: macOS requires explicit user permission for screen recording. If not granted, GStreamer captures black frames silently (no error thrown).

**Solution**:
- On macOS, at app launch check `CGPreflightScreenCaptureAccess()` → returns `false` if not granted
- If false → show a **blocking modal**: "UniCast needs Screen Recording permission to share your screen"
- Modal includes step-by-step visual guide with "Open System Preferences" button
- After user grants permission, they must **restart the app** (macOS limitation)
- The `Test Capture` button in Settings verifies it's working

### 16.7. Network Degradation Auto-Adaptation (Future)
**Problem**: Network quality drops mid-stream. Teacher may not notice the red quality dot or know to lower bitrate.

**Solution** (Phase 2 enhancement, architecture-ready):
- If RTT > 50ms for > 10 seconds consecutively → show toast notification: "Network congestion detected. Reduce quality?"
- One-click button to drop from 1080p→720p or reduce bitrate by 50%
- Architecture support: `set_stream_volume` IPC pattern extends to `adjust_stream_quality` with dynamic pipeline reconfiguration
- **Not for MVP** but the IPC layer supports it

### 16.8. Pi Clock Drift and PIN Rotation
**Problem**: Pi generates new PIN every hour. If Pi's clock drifts or NTP fails on Eduroam, PIN rotation timing becomes unpredictable.

**Solution**:
- Pi uses `time.monotonic()` for PIN rotation (not wall clock) — immune to NTP drift
- Firebase `last_seen` timestamp uses server timestamp (`firebase.database.ServerValue.TIMESTAMP`) not local clock
- If Pi can't reach NTP, it still works — monotonic timer is hardware-based

### 16.9. Receiver (Pi) Side — Agent Evolution
**Problem**: Current `agent.py` is a benchmarking prototype. For production it needs:
- Firebase integration (presence updates)
- PIN generation and display
- HDMI CEC control
- Heartbeat monitoring
- Clean process management

**Status**: This is Faz 4 scope, not Faz 2 (UI). But the UI architecture must be compatible. The IPC commands (`verify_pin`, `wake_pi_hdmi`) are designed against the Pi agent's future API.

### 16.10. Session Recovery
**Problem**: If the app crashes during streaming, can the teacher reconnect without re-entering PIN?

**Solution**:
- When stream starts, Rust saves a `session.json` with `{ room_id, pi_ip, timestamp }`
- On app restart, check if `session.json` exists and is < 5 minutes old
- If yes → show "Resume previous session?" dialog
- If user confirms → send resume packet to Pi (PIN is not re-required within the session window)
- If no or expired → clean start, PIN required
- This requires Pi to support session tokens (Faz 4 scope)

---

## Verification Plan

### After Implementation
1. **Build test**: `npm run tauri dev` starts without errors
2. **Window management**: Main window hides, streaming bar shows (and vice versa)
3. **Capture exclusion**: Streaming bar does NOT appear in screen recording
4. **Firebase**: Anonymous auth + room list populates
5. **IPC**: All Rust commands callable from React (can use mock data until Pi is ready)
6. **i18n**: Language toggle switches all visible text
7. **Settings**: Changes persist after app restart (including bar theme, opacity, enabled state)
8. **Theme switching**: Light/Dark + independent bar theme
9. **Network quality**: RTT ping shows correct dot color
10. **Responsive**: Main window scales from 800×550 to fullscreen
11. **System tray**: Tray icon works with context menu when bar disabled
12. **Audio popup**: Volume slider and mute toggle work without pipeline restart
13. **Cross-platform**: Build succeeds on Windows, macOS (Intel), Ubuntu 20.04
