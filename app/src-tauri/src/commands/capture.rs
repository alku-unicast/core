use tauri::{AppHandle, Manager};

/// Apply WDA_EXCLUDEFROMCAPTURE to streaming bar window.
/// Called from React via IPC after bar is created/shown.
#[tauri::command]
pub fn set_bar_capture_exclusion(app: AppHandle, label: String) -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Some(win) = app.get_webview_window(&label) {
            if let Ok(hwnd) = win.hwnd() {
                return crate::utils::capture_exclusion::exclude_from_capture(hwnd.0 as isize);
            }
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        let _ = label;
        true // No-op on non-Windows
    }
}
