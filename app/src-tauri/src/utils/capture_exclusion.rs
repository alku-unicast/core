/// Removes a window from screen capture output entirely (Windows 10 build 19041+).
#[cfg(target_os = "windows")]
pub fn exclude_from_capture(hwnd: isize) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowDisplayAffinity, WINDOW_DISPLAY_AFFINITY};
    // WDA_EXCLUDEFROMCAPTURE (0x11): window is invisible to all capture APIs.
    // Older WDA_MONITOR (0x01) only showed black; this removes it entirely.
    unsafe {
        SetWindowDisplayAffinity(
            HWND(hwnd as isize),
            WINDOW_DISPLAY_AFFINITY(0x11),
        )
        .map(|_| true)
        .unwrap_or(false)
    }
}

#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
pub fn exclude_from_capture(_hwnd: isize) -> bool {
    true
}
