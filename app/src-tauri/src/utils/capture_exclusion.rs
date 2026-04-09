/// Apply WDA_EXCLUDEFROMCAPTURE to a HWND so it doesn't appear in screen captures.
/// Called once after streaming bar window is created.
#[cfg(target_os = "windows")]
pub fn exclude_from_capture(hwnd: isize) -> bool {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity;
    const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;

    unsafe {
        SetWindowDisplayAffinity(HWND(hwnd as *mut _), WDA_EXCLUDEFROMCAPTURE)
            .map(|_| true)
            .unwrap_or(false)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn exclude_from_capture(_hwnd: isize) -> bool {
    true
}
