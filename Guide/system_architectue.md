# UniCast — System Architecture and Technical Analysis

**Last Updated:** 2026-05-11  
**Status:** ACTIVE DEVELOPMENT

---

# 1. Code Structure

```text
app/src-tauri/
├── src/
│   ├── main.rs                     ← Tauri entry point, tray, WDA_EXCLUDE
│   ├── lib.rs                      ← Command registration, setup hook, RTT monitor bootstrap
│   ├── commands/
│   │   ├── auth.rs                 ← verify_pin (UDP PIN + session token parsing), wake_pi_hdmi
│   │   ├── stream.rs               ← start_stream, stop_stream, set_stream_volume,
│   │   │                               SESSION_TOKEN global static, heartbeat spawner
│   │   ├── network.rs              ← get_network_info, start_rtt_monitor, get_network_quality
│   │   ├── firebase.rs             ← fetch_firebase_rooms (anonymous auth + 50min token cache)
│   │   ├── cache.rs                ← read_rooms_cache, write_rooms_cache → AppData JSON
│   │   ├── settings.rs             ← read_settings, write_settings → AppData JSON
│   │   ├── encoder.rs              ← detect_encoder (hardware chain test)
│   │   ├── audio.rs                ← list_audio_devices, mute_system_audio
│   │   ├── monitors.rs             ← list_monitors
│   │   ├── capture.rs              ← list_windows (window capture)
│   │   ├── windows.rs              ← Tauri WebviewWindow management
│   │   └── mod.rs
│   └── gstreamer/
│       ├── path_setup.rs           ← get_gst_launch(), Smart Path, environment setup
│       └── pipeline.rs             ← build_pipeline(), Wayland/X11 detection, encoder params

app/src/
├── screens/
│   ├── RoomDiscovery.tsx           ← Main screen (room list, favorites, network status)
│   ├── ConnectionSetup.tsx         ← Connection flow (WAKE → PIN → STREAM), stream-stopped handler
│   └── StreamingBarApp.tsx         ← Separate Tauri WebviewWindow — timer, audio, network quality
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx              ← Logo, settings button
│   │   ├── StatusBanner.tsx        ← LOCAL_ONLY/NO_NETWORK warning banner
│   │   └── StatusSummary.tsx       ← Bottom bar: last update time, room count
│   ├── rooms/
│   │   ├── RoomCard.tsx            ← Individual room card (status color, favorite button)
│   │   ├── RoomGrid.tsx            ← Filtered room grid
│   │   ├── FloorTabs.tsx           ← "All | Floor 0 | Floor 1..." filter
│   │   ├── FavoritesSection.tsx    ← Horizontal favorites list (hidden if empty)
│   │   ├── ManualConnect.tsx       ← IP input form component
│   │   └── ManualConnectSection.tsx ← Wrapper hidden during NO_NETWORK
│   ├── connection/
│   │   ├── PINEntry.tsx            ← PIN input field + error display
│   │   ├── ConnectionProgress.tsx  ← Connection step indicator
│   │   ├── StreamModeSelector.tsx  ← Fullscreen / window mode selector
│   │   └── AudioToggle.tsx         ← Audio enable/disable toggle
│   ├── modals/
│   │   └── LinuxWarningModal.tsx   ← Linux window mode warning (with "don't show again")
│   ├── settings/
│   │   └── SettingsModal.tsx       ← All user settings (lazy loaded)
│   └── streaming-bar/
│       ├── NetworkQualityDot.tsx   ← RTT quality indicator (colored dot)
│       └── AudioPopup.tsx          ← Volume slider popup
├── stores/
│   ├── connectionStore.ts          ← Connection phase, stream control, sessionToken, auto-restart
│   ├── roomStore.ts                ← Room list, floor filter, cache update time
│   ├── networkStore.ts             ← ONLINE/LOCAL_ONLY/NO_NETWORK state machine
│   ├── settingsStore.ts            ← User settings (disk persistent), toggleFavorite
│   └── systemStore.ts              ← Window list, monitor list, encoder
├── services/
│   └── roomService.ts              ← Firebase polling (30s), cache, refreshRoomsNow()
└── types/
    ├── room.ts                     ← Room, RoomStatus
    ├── stream.ts                   ← StreamConfig, ConnectionPhase, StreamMode, NetworkQuality
    └── settings.ts                 ← Settings, StreamProfile, DEFAULT_SETTINGS

src/receiver/
└── agent.py                        ← Pi UDP server: PIN auth, session token, heartbeat, stream
````

---

# 2. GStreamer Pipeline

## Video — Windows (D3D11)

```text
d3d11screencapturesrc monitor-index={idx} !
queue !
d3d11download !
videoconvert !
videoscale !
video/x-raw,format=NV12,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

---

## Video — Linux (X11 / Wayland Fallback)

```text
ximagesrc display-name=:0 use-damage=0 !
videoconvert !
videoscale !
video/x-raw,format=I420,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

> Wayland detection is based on the presence of the `WAYLAND_DISPLAY` environment variable.
> `pipewiresrc` is used automatically when Wayland is detected.
>
> Window capture mode is not supported on Wayland — fullscreen fallback is used instead.

---

## Video — macOS (AVFoundation)

```text
avfvideosrc capture-screen=true !
videoconvert !
videoscale !
video/x-raw,format=I420,width={W},height={H},framerate={fps}/1 !
queue !
{encoder} bitrate={kbps} {encoder_params} !
rtph264pay config-interval=1 !
queue !
udpsink host={IP} port=5000
```

---

## Audio Pipeline (All Platforms — enabled when `audioEnabled=true`)

| Platform | Source                                                          |
| -------- | --------------------------------------------------------------- |
| Windows  | `wasapi2src loopback=true device={id}`                          |
| Linux    | `pulsesrc device={id}`                                          |
| macOS    | `osxaudiosrc` *(microphone only — no loopback capture support)* |

```text
{audio_src} !
queue !
audioconvert !
audioresample !
opusenc bitrate=128000 !
rtpopuspay !
queue !
udpsink host={IP} port=5002
```

---

# 3. Encoder Chain and Parameters

## Encoder Priority Order (`encoder.rs`)

```text
nvh264enc   (NVIDIA)     → CUDA-based, fastest
qsvh264enc  (Intel QSV)  → Integrated graphics
amfh264enc  (AMD AMF)    → Radeon
vtenc_h264  (macOS)      → VideoToolbox (Apple Silicon + Intel Mac)
x264enc     (Software)   → Works everywhere, CPU intensive
```

---

## Encoder Parameters (`pipeline.rs`)

| Encoder    | Parameters                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| x264enc    | `tune=zerolatency speed-preset=superfast key-int-max=15 intra-refresh=true` |
| nvh264enc  | `zerolatency=true gop-size=15`                                              |
| qsvh264enc | `target-usage=balanced rate-control=cbr`                                    |
| amfh264enc | `rate-control=cbr target-usage=balanced`                                    |
| vtenc_h264 | `real-time=true`                                                            |

---

## Fallback Mechanism (`stream.rs`)

```text
start_stream(config, session_token)
    ↓
Wait 500ms → child.try_wait()
    ↓
Failed + encoder ≠ x264enc?
    → fallback_config.encoder_name = "x264enc"
    → Box::pin(start_stream(app, fallback_config, session_token)).await
    ↓
x264enc also failed?
    → Err(exit_code + GST_PLUGIN_PATH)
```

---

# 4. UDP Protocol (Full Reference)

## Port 5001 — Control Channel

The Pi listens on `0.0.0.0:5001`.

Commands without tokens or with invalid tokens are silently rejected.

| Command   | Format                   | Token Required | Pi Response                                  |
| --------- | ------------------------ | -------------- | -------------------------------------------- |
| WAKE      | `WAKE`                   | No             | `READY`                                      |
| PIN       | `PIN:<pin>`              | No             | `OK:<token>` or `FAIL:<remaining>` or `BUSY` |
| HEARTBEAT | `HEARTBEAT:<token>`      | Yes            | *(no response)*                              |
| STOP      | `STOP:<token>`           | Yes            | *(stream stops, new PIN generated)*          |
| VOLUME    | `VOLUME:<0-100>:<token>` | Yes            | *(adjust HDMI audio level)*                  |

---

## Port 5005 — RTT Channel

| Command | Format | Pi Response |
| ------- | ------ | ----------- |
| PING    | `PING` | `PONG`      |

---

## Data Channels

| Port | Protocol | Content     |
| ---- | -------- | ----------- |
| 5000 | UDP/RTP  | H.264 video |
| 5002 | UDP/RTP  | Opus audio  |

---

## Session Token Security

* Token generation:

  ```python
  secrets.token_hex(16)
  ```

  → 32-character hexadecimal token (`2^128` combinations)

* IP-bound sessions:

  * Token is valid only for the IP address that submitted the PIN

* Token lifecycle:

  * Removed after:

    * `stop_streaming()`
    * or heartbeat timeout (`5s`)

* Rust global static:

  ```rust
  SESSION_TOKEN
  ```

  stored using `OnceLock`

* Streaming bar reads token directly from Rust global state instead of frontend JS state

---

# 5. Tauri Events

## Rust → Frontend

Broadcast to all windows through:

```rust
app.emit(...)
```

| Event            | Payload                              | Trigger                          |
| ---------------- | ------------------------------------ | -------------------------------- |
| `stream-started` | `{ pid: number }`                    | Successful `start_stream`        |
| `stream-stopped` | `{ reason: "user" \| "error" }`      | `stop_stream` or crash detection |
| `stream-health`  | `{ rttMs: number, quality: string }` | `start_rtt_monitor` every 2s     |

---

## Frontend → Streaming Bar Window

| Event              | Payload                                             | Trigger                     |
| ------------------ | --------------------------------------------------- | --------------------------- |
| `stream-mode-info` | `{ mode, targetIp, audioEnabled, volume, isMuted }` | 500ms after `startStream()` |

---

# 6. Data Persistence

| Data          | File               | Location             |
| ------------- | ------------------ | -------------------- |
| User settings | `settings.json`    | `{AppData}/unicast/` |
| Room cache    | `rooms_cache.json` | `{AppData}/unicast/` |

---

## Settings Structure (`version: 2`)

```typescript
{
  version: 2,
  language: "tr" | "en",
  favorites: string[],
  profiles: {
    presentation: { resolution, fps, bitrate, delayBufferMs, audioEnabled },
    video:        { resolution, fps, bitrate, delayBufferMs, audioEnabled }
  },
  audio: { deviceId, muteLocal },
  encoder: { detected, lastScan },
  appearance: { mainTheme, barTheme, barOpacity },
  streamingBar: { enabled },
  hideLinuxWindowWarning: boolean
}
```

---

# 7. Network State Machine

```text
CHECKING
  ├─→ ONLINE
  ├─→ LOCAL_ONLY
  └─→ NO_NETWORK
```

### Detection Logic

* `ONLINE`
  → `fetch_firebase_rooms` succeeds

* `LOCAL_ONLY`
  → Local network exists but Firebase request times out or fails

* `NO_NETWORK`
  → `get_network_info()` finds no active local interface

---

## Detection Method

`get_network_info()`:

* Creates a UDP socket to:

  ```text
  8.8.8.8:80
  ```
* No packet is sent
* Uses `local_addr()` to determine the active interface

---

## UI Effects

* `StatusBanner` becomes visible during:

  * `LOCAL_ONLY`
  * `NO_NETWORK`

* `ManualConnectSection` is hidden during:

  * `NO_NETWORK`

---

# 8. Streaming Bar Architecture

The streaming bar is implemented as a separate Tauri `WebviewWindow`:

```text
label: "streaming-bar"
```

---

## Critical Limitations

* Separate JavaScript module context
* Zustand stores initialize independently

  * `sessionToken = null`
  * `rooms = {}`
* `startRoomListener()` is never called inside this window
* `refreshRoomsNow()` cannot execute from this context
* Session token cannot be read from JS state
* Communication uses Rust global `SESSION_TOKEN`

---

## Audio Control Flow (Bar → Pi)

```text
Bar:
  invoke("set_stream_volume", { volume, mute, targetIp })

     ↓ (stream.rs)

SESSION_TOKEN global
     ↓

"VOLUME:<val>:<token>"
     ↓

UDP:5001
```

---

# 9. Known Issues and Status

| Issue                                                                | Status           |
| -------------------------------------------------------------------- | ---------------- |
| Encoder detection uses `videotestsrc` instead of real screen capture | Ongoing          |
| `\\?\` path prefix incompatibility with Windows `cmd.exe`            | Fixed            |
| Audio device ID was not passed into pipeline                         | Fixed            |
| No audio loopback on macOS                                           | Known limitation |
| Linux window mode `BadMatch` (MIT-SHM)                               | Fixed            |
| GStreamer CMD popup on Windows                                       | Fixed            |
| Volume slider from streaming bar did not work                        | Fixed            |
| UI updated 20–25s late after stream ended                            | Fixed            |
| x264enc crashes were silently ignored                                | Fixed            |

---

# 10. Architectural Decisions

| Decision                                   | Reason                           | Status |
| ------------------------------------------ | -------------------------------- | ------ |
| Tailwind v3 instead of v4                  | Tauri WebView compatibility      | Final  |
| Rust HTTP instead of Firebase JS SDK       | Avoid CORS issues                | Final  |
| Firebase anonymous auth                    | Public repo, visible API key     | Final  |
| RTT-based quality indicator                | Low overhead                     | Final  |
| `WDA_EXCLUDEFROMCAPTURE`                   | Prevent capturing streaming bar  | Final  |
| No macOS system audio                      | AVFoundation limitation          | Final  |
| Encoder chain: NVIDIA → Intel → AMD → x264 | GPU first, CPU fallback          | Final  |
| Session token (32-char hex, IP-bound)      | Prevent UDP abuse                | Final  |
| Rust-managed `settings.json`               | Fewer dependencies               | Final  |
| Stale-while-revalidate cache strategy      | Instant UI startup               | Final  |
| Rust global `SESSION_TOKEN`                | Separate JS context workaround   | Final  |
| `refreshRoomsNow()` only from main window  | Streaming bar lacks shared state | Final  |
| Linux AppImage bundles GStreamer           | No root/install requirement      | Final  |
| Windows uses `msiexec /a`                  | GitHub runner compatibility      | Final  |
| macOS uses Direct Target + Deep Search     | Framework paths vary             | Final  |

---

# 11. GStreamer Plugin Reference (Windows Bundle)

## Used Plugins

| DLL | Görev |
|-----|-------|
| `gstd3d11.dll` | Windows screen capture (D3D11) |
| `gstx264.dll` | H.264 software encoder |
| `gstopus.dll`, `gstopusparse.dll` | Opus audio codec |
| `gstrtp.dll`, `gstrtpmanager.dll` | RTP packetizer |
| `gstudp.dll` | UDP sink |
| `gstaudio.dll`, `gstaudioconvert.dll`, `gstaudioresample.dll` | Audio processing |
| `gstvideo.dll`, `gstvideoconvertscale.dll` | Video processing |
| `gstwasapi2.dll` | Windows audio capture (loopback) |
| `gstcoreelements.dll` | queue, tee, fakesink |
| `gstcuda.dll` | NVIDIA CUDA support |


---

## Removable Plugins

- WebRTC: `gstwebrtc.dll`, `gstrswebrtc.dll`
- Cloud/AI: `gstaws.dll`, `gstelevenlabs.dll`
- Gereksiz codec: `gstx265.dll`, `gstrav1e.dll`, `gstvpx.dll`, `gstdav1d.dll`
- Editing: `gstges.dll`
- Alternatif ses: `gstflac.dll`, `gstspeex.dll`, `gstlame.dll`
- Broadcast: `gstdecklink.dll`, `gstndi.dll`
- Debug: `gstcheck.dll`, `gstdebug.dll`
- Script: `gstpython.dll`, `gstjavascript.dll`