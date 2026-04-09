/// Apply WDA_EXCLUDEFROMCAPTURE to streaming bar window.
/// Called from React via IPC after bar is created/shown.
#[tauri::command]
pub fn set_bar_capture_exclusion(hwnd: isize) -> bool {
    #[cfg(target_os = "windows")]
    {
        crate::utils::capture_exclusion::exclude_from_capture(hwnd)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = hwnd;
        true // No-op on non-Windows
    }
}
