# UniCast Stabilization & Cross-Platform Plan

## 1. Raspberry Pi (Receiver) - UI & Power
### TTY Visibility Issues
- **Problem:** TTY console and blinking cursor visible behind/beside the idle image due to resolution mismatch.
- **Solution A (Kernel):** Edit `/boot/firmware/cmdline.txt` to include `consoleblank=0 vt.global_cursor_default=0`.
- **Solution B (Agent):** Use `kmsprint` to detect actual resolution and scale the PNG/Pipeline accordingly.
- **Solution C (Cursor):** Execute `setterm -cursor off > /dev/tty1` at agent startup.

### Power Management (Plan B/C)
- **Status:** `drm_blank.py` (persistent DRM master) is the current path forward.
- **Task:** Test `drm_blank.py` on the classroom projector. If it fails, fallback to "Black Frame Idle" mode.

## 2. Arch Linux (Sender) - Compatibility
### The "No Stream" Issue
- **Root Cause:** Missing `gst-plugins-ugly` (x264enc) or `gst-plugin-pipewire` (Wayland).
- **Fallback Strategy:**
  1. **Encoder Chain:** `x264enc` (High Quality) -> `openh264enc` (High Compatibility) -> `avenc_h264` (Fallback).
  2. **Diagnostic Probe:** On startup, run `gst-inspect-1.0` for required elements.
  3. **Actionable Errors:** Show specific "Missing Package" warnings instead of generic "Pipeline Error".

## 3. macOS (Sender) - Stability
### Video Capture
- **Current:** `avfvideosrc` with screen capture.
- **Permission Check:** Add detection for Screen Recording permissions. If missing, guide user to Settings.
- **Modern API:** Investigate `screencapturekit` for macOS 12.3+ for smoother permission handling and better performance.

### Audio Capture
- **Status:** Currently disabled on macOS.
- **Future:** Plan to use `screencapturekit` for combined audio/video capture after video stability is confirmed.

## 4. UI/UX Refinements (Tauri App)
- **Clipping:** Fix orange button/wifi icon clipping in `ConnectionSetup.tsx` via `my-2` and `shrink-0`.
- **Reactivity:** Ensure volume controls hide/show correctly based on `audioEnabled` state.
- **Layout:** Change fixed `min-h-[220px]` to `h-auto` to prevent overflow in small windows.
