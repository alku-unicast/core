use tauri::{AppHandle, Manager};

/// Removes the streaming-bar window from screen capture output.
/// macOS: NSWindowSharingNone — Core Graphics / avfvideosrc honour this flag.
/// Windows: WDA_EXCLUDEFROMCAPTURE — supported from Windows 10 build 19041.
/// Linux: no-op (no universal per-window exclusion API on X11/Wayland).
#[tauri::command]
pub fn set_bar_capture_exclusion(app: AppHandle, label: String) -> bool {
    let Some(win) = app.get_webview_window(&label) else {
        log::warn!("[capture] window '{}' not found", label);
        return false;
    };

    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = win.hwnd() {
            let ok = crate::utils::capture_exclusion::exclude_from_capture(hwnd.0 as isize);
            log::info!("[capture] WDA_EXCLUDEFROMCAPTURE applied to '{}': {}", label, ok);
            return ok;
        }
        false
    }

    #[cfg(target_os = "macos")]
    {
        use objc2::msg_send;
        use objc2::runtime::AnyObject;

        match win.ns_window() {
            Ok(ptr) => {
                let ns_win = ptr as *mut AnyObject;
                // NSWindowSharingNone = 0: window excluded from all screen capture APIs
                unsafe { let _: () = msg_send![ns_win, setSharingType: 0u64]; }
                log::info!("[capture] NSWindowSharingNone applied to '{}'", label);
                true
            }
            Err(e) => {
                log::warn!("[capture] ns_window() failed for '{}': {}", label, e);
                false
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let _ = win;
        log::info!("[capture] capture exclusion not available on Linux ('{}')", label);
        true
    }
}
