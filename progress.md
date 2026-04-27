# UniCast Development Progress


# UniCast Gelişim Raporu (Progress)

## Mevcut Durum: Faz 4 (Stabilizasyon & Saha Testleri)

### Son Yapılanlar (2026-04-25)
1. **CI/CD Mimarisi Devrimi:**
   - Inline JSON konfigürasyonundan dosya tabanlı (`tauri-resource-override.json`) konfigürasyona geçildi. macOS upload hataları bu sayede çözüldü.
   - Windows build sürecinde `msiexec /a` komutu `Start-Process -Wait` ile senkron hale getirildi, binary eksikliği giderildi.
2. **GStreamer Runtime Onarımı (Girişim 1):**
   - Her yayında registry silme işlemi iptal edildi (Hız ve stabilite için).
   - Tanı koyabilmek için `gst_debug.log` mekanizması eklendi.
3. **Versiyon Senkronizasyonu:**
   - GitHub tagleri ile `tauri.conf.json` arasındaki uyumsuzluk, build workflow'unda `${{ github.ref_name }}` kullanılarak giderildi.

## 2026-04-25/26: CI/CD Stabilization & GStreamer Packaging

### 1. GStreamer DLL Discovery
- **Issue:** `libgstd3d11.dll` was missing in Windows builds.
- **Cause:** `msiexec /a` (administrative install) was skipping optional "bad" plugins.
- **Fix:** Switched to `msiexec /i` with `ADDLOCAL=ALL` and `INSTALLDIR`.
- **Discovery:** Windows MSVC plugins do not use the `lib` prefix. The correct file is `gstd3d11.dll`. Verification steps updated.

### 2. GitHub Release Reliability
- **Issue:** 404/403 errors during artifact upload.
- **Fix:** 
  - Added `max-parallel: 1` to prevent race conditions.
  - Added explicit `permissions: contents: write` to the workflow.

### 3. Tauri Resource Injection
- **Issue:** `resource path '' doesn't exist` error in CI.
- **Cause:** `matrix.gst_resources` was undefined for Windows/macOS, leading to an empty string in the dynamically generated `tauri-resource-override.json`.
- **Status:** Fixing matrix variables to point to `gstreamer/windows/**/*` and `gstreamer/macos/silicon/**/*`.

### 4. Next Steps
- [ ] Push finalized `build.yml` with correct matrix variables.
- [ ] Verify full build on Windows and macOS.
- [ ] Test the resulting installer on a fresh Windows machine.
- **CI/CD:** GitHub Actions üzerinden otomatik Release oluşturma başarıyla tamamlandı.
- **Testing:** Oluşturulan `.exe` dosyası ile başka bilgisayarda testler yapıldı.
- **Bug Discovery:** 
    - Release build'lerde GStreamer bağlantı sorunu (muhtemelen DLL/Redist eksikliği).
    - Streaming Bar'ın hem dev hem release modunda bazen görünmemesi.

## 📊 Project Status Summary
**Phase:** Phase 3 Active - CI/CD & Release Stabilization  
**Build Status:** ✅ Windows/macOS/Linux CI/CD Pipeline Working | ⚠️ Release Binaries Unstable  
**Key Metrics:** CI/CD pipeline cross-platform fixed, initial release testing in progress  
**Latest Milestone:** Apr 22, 2026 - Successful cross-platform build, identified critical release-only bugs

## 🚀 Recent Progress (Apr 22, 2026)

### Apr 22: Release Testing & Stabilization
- **CI/CD:** GitHub Actions üzerinden otomatik Release oluşturma başarıyla tamamlandı.
- **Testing:** Oluşturulan `.exe` dosyası ile başka bilgisayarda testler yapıldı.
- **Bug Discovery:** 
    - Release build'lerde GStreamer bağlantı sorunu (muhtemelen DLL/Redist eksikliği).
    - Streaming Bar'ın hem dev hem release modunda bazen görünmemesi.
    - Pi alıcı tarafında yayın başlarken yaşanan çökme/kapanma sorunu.

### Kök Neden Analizi (Devam Ediyor):
| Sorun | Tahmin Edilen Neden | Aksiyon Planı |
|-------|-----------|-------|
| Release Bağlantı | Eksik VCRUNTIME/Gst DLL veya Firewall | `tauri build --debug` ile test edilecek |
| Mini Bar Kayıp | Window creation JS error veya event mismatch | Rust logları ve window management incelenecek |
| Pi Çökmesi | Bitrate/Profile uyumsuzluğu | Pipeline parametreleri (`x264enc` profile/level) sıkılaştırılacak |

| macOS `--config` | YAML block scalar `\"` → literal `\` | Config dosyaya yazılıp path geçiliyor |
| tauri.conf.json glob | `gstreamer/windows/**/*` macOS'ta path yok | resources `[]` boşaltıldı, `--config` ile per-platform inject |
| Rust `cfg!(target_os)` | `cfg!` bool döndürür, string değil | `std::env::consts::OS` kullanıldı |
| macOS `tauri::objc_id` | Tauri v2 artık re-export etmiyor | `objc2` crate direkt kullanıldı |
| ubuntu-20.04 | Apr 2025'te deprecated edildi | `ubuntu-22.04`'e geçildi |
| macos-13 | GitHub kapasitesi kısıtlı | Kaldırıldı (ARM64 + Rosetta 2 yeterli) |
| Linux `libgstreamer1.0-dev` | `libunwind-dev` unmet dep | `-dev` kaldırıldı (Rust GStreamer FFI kullanmıyor) |
| Linux `libgtk-3-0` | Runtime-only, pkg-config `.pc` dosyası yok | `libgtk-3-dev` + Tauri v2 dev paketleri |

**Sonuç:**
- `tauri.conf.json`: `"resources": []` — GStreamer platform-specific config build.yml'de inject ediliyor
- `path_setup.rs`: `cfg!(target_os)` → `std::env::consts::OS` (2 yerde)
- `lib.rs`: macOS objc2 API modernize edildi
- `Cargo.toml`: `objc2 = "0.6"` macOS bağımlılığı eklendi
- `build.yml`: Matrix `windows + ubuntu-22.04 + macos-latest (ARM64)`

## 🚀 Recent Progress (Apr 11-21, 2026)

### Apr 21: CI/CD Pipeline Repair & Directory Fixes
**Windows GStreamer extraction:** Replaced `lessmsi.exe` with stable `msiexec /a` + PowerShell Smart Search  
**Frontend build fix:** Added `working-directory: ./app` to all npm/tauri steps  
**macOS framework:** Hybrid path detection (`Versions/1.0` → Deep Search fallback)  
**Tauri v2 GStreamer bundling:** `APPIMAGE_BUNDLE_GSTREAMER=1` + `bundleMediaFramework: true`

### Apr 21: Tauri Built-in GStreamer Support
**Discovery:** Tauri v2 natively bundles GStreamer - no external `linuxdeploy` needed  
**New CI/CD flow:**
```
Linux: APPIMAGE_BUNDLE_GSTREAMER=1 → tauri build --bundles appimage
Windows: msiexec extraction + caching  
macOS: Framework path expansion
```
**User experience:** Single executable, no install/root required

### Apr 16: Cross-Platform Architecture & Engineering Audit
**GStreamer folder structure:** `gstreamer/windows|linux|macos/intel|macos/silicon`  
**Windows DLL fix:** `VCRUNTIME140.dll`/`MSVCP140.dll` → Side-by-side deployment  
**Linux strategy:** Ubuntu 20.04 GLIBC compatible + Wayland/X11 auto-detection  
**macOS Phase 1:** Video-only (audio loopback deferred)

### Apr 15: Cross-Platform Independence Analysis  
**Issues diagnosed:** VCRUNTIME140 missing, D3D11 window mode `E_NOINTERFACE`, plugin scanner path  
**CI/CD decision:** Matrix builds producing platform-specific binaries (`unicast-windows.exe`, etc.)  
**Element selection:** Windows=`d3d11screencapturesrc`, Linux=`pipewiresrc`, macOS=`avfvideosrc`

### Apr 14: GStreamer Stabilization & Hybrid GPU Adaptation
**Directory Junctions:** PID-based virtual paths (`D:\UCGst_{PID}`) solve Turkish path issues  
**Pipeline syntax:** Separate CLI arguments prevent quotation errors  
**GPU bridge:** `d3d11screencapturesrc` + `d3d11download` stabilizes RTX/AMD hybrid systems  
**Quality modes:** Presentation (20fps/6Mbps sharp) vs Video (30fps/4Mbps smooth)

### Apr 14: Portable GStreamer Deployment
**Tauri v2 bundling:** GStreamer → `resources[]` in `tauri.conf.json`  
**Runtime PATH:** Process-local env vars prevent DLL Hell  
**Smart detection:** `AppHandle.path().resource_dir()` works AppData/portable

### Apr 13: Intelligent Quality Modes & UI Parity
**GPU-RAM bridge:** `d3d11download` + `videoscale` fixes format negotiation  
**Dynamic modes:** Presentation vs Video bitrate/FPS presets  
**UI fixes:** Streaming bar audio slider, network health widget when bar disabled

### Apr 13: Pi 5 Firebase & Robust Streaming
**Rust heartbeat:** UDP:5001 keep-alive every 2s prevents Pi timeout  
**Pipeline robustness:** `d3d11download` + fixed `I420` format  
**Firebase schema:** `pi_status`/`pi_ip`/`name` sync with roomService.ts  
**Graceful STOP:** UDP signal immediately returns Pi to IDLE

### Apr 10: UI & Architecture Fixes (Multi-Phase)
**GStreamer crash:** `nvh264enc tune=zerolatency` → `zerolatency=true`  
**Window capture lock:** Fixed `Arc<Mutex<>>` reference leak  
**Mini bar UX:** Transparent shadow=false, rotated audio slider, live theme sync  
**Deadlock fix:** Non-blocking `try_wait()` + `taskkill /F /T` process tree  
**State management:** `settings-updated` Tauri event for real-time sync

### Apr 10: E2E Integration & Security
**Tauri v2 capabilities:** Added `event:listen`/`window:control` permissions  
**Protocol verification:** UDP handshake (WAKE/READY/PIN) 100% stable  
**Rust cleanup:** Fixed `windows` crate v0.57 breaking changes

### Apr 9: Pi Agent v3 Firebase Integration
**Firebase-admin SDK:** Real-time `/rooms/<ROOM_ID>` status (`idle/streaming/offline`)  
**Protocol v3:** PIN attempts tracking, 20s grace period, CEC power control  
**RTT echo:** Port 5005 health metrics daemon

### Apr 9: SettingsModal & StreamingBarApp
**SettingsModal:** Stream/Audio/Network/Appearance tabs with live persistence  
**StreamingBarApp:** Timer, RTT dots, audio popup, mode badges

## 📈 Historical Development Summary (Pre-Apr 11, 2026)

**Apr 10 (Sessions 1-6):** Fixed GStreamer crashes, window capture deadlocks, mini bar clipping/shadows, audio slider rotation, graceful shutdowns, and live theme synchronization across dual-window system.

**Apr 9:** Deployed mock Pi testing infrastructure and completed RoomDiscovery/ConnectionSetup screens with HashRouter compatibility.

**Apr 7:** Production Pi 5 deployment with Debian 12 DRM/KMS, smart agent v2 state machine, and ALKÜ-branded standby screen.

**Apr 6:** Established UI architecture (Tauri v2 + React 18 + Tailwind + Zustand + Firebase) with dual-window WDA integration planning.

**Apr 5:** Restructured codebase into modular sender/receiver/analytics and implemented RTP benchmarking with WASAPI Opus audio PoC.

## 🎯 Next Steps & Roadmap
```
[ ] Windows VC++ Redistributable bundling
[ ] Linux pipewiresrc Wayland testing  
[ ] macOS audio loopback (BlackHole)
[ ] GStreamer thinning (259→30 plugins)
[ ] RSA authentication layer
[ ] i18n (TR/EN locales)
```

### Apr 26: GStreamer Path & Plugin Finalization
- **Compilation Fix:** Resolved `GetShortPathNameW` signature mismatch for `windows` crate v0.57.0 (switched to 2-argument idiomatic Rust call).
- **Registry & Debug:** Forced a fresh plugin scan via `gstreamer_registry_1_24_13.bin` and enabled `GST_DEBUG=3` for diagnostics.
- **Critical Finding (Fresh Windows):** 
    - `gstd3d11.dll` exists in the bundle but **fails to register** its elements (`d3d11screencapturesrc` is missing).
    - **Fallback Working:** `gstwinscreencap.dll` is working perfectly, providing `dx9screencapsrc` and `gdiscreencapsrc`.
- **Root Cause Hypothesis:** `gstd3d11.dll` likely requires specific VC++ 2022 Redistributable extensions or hardware features (Desktop Duplication API) that are absent on the test machine.

### UI & Pipeline Status
- **Issue:** "GStreamer eklentileri kontrol edin" error on fresh machines due to missing D3D11 plugins.
- **Solution (Apr 26):** Implemented **Intelligent Fallback Mechanism** in `pipeline.rs`.
    - 🔍 **Discovery:** Added `is_element_available` using `gst-inspect-1.0.exe`.
    - 🛡️ **Resilience:** Pipeline now tries D3D11 -> DX9 -> GDI in order.
    - ⚙️ **Optimization:** Automatically removes `d3d11download` when using DX9/GDI sources.

---

## 📊 Project Status Summary
**Phase:** Phase 4 Active - Stabilization & Fallback Logic  
**Build Status:** ✅ Cross-platform CI/CD Fixed | ✅ Intelligent GStreamer Fallback Implemented  
**Key Metrics:** Bundle size optimized, Registry reset working, Smart DX9/GDI fallback active.  
**Latest Milestone:** Apr 26, 2026 - Stabilized Windows release via dynamic GStreamer plugin discovery.

---

## 🛠️ Technical Decisions (ADR Log)

| Decision | Rationale | Status |
|----------|-----------|--------|
| **Tauri v2 GStreamer Bundling** | Eliminates user installation | ✅ Implemented |
| **Matrix CI/CD Builds** | Platform-native binaries | ✅ Working |
| **Directory Junctions** | Solves Windows path issues | ✅ Production |
| **GPU-RAM Bridge** | Hybrid NVIDIA/AMD stability | ✅ Stable |
| **Firebase Real-time** | Pi status sync | ✅ Live |
| **Intelligent Fallback** | Handles missing plugins (D3D11/DX9) | ✅ Implemented |

**Last Updated:** April 26, 2026  
**Total Sessions:** 25 | **Stability:** Field Test Ready
