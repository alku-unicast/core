/// Kill any running gst-launch-1.0 processes.
/// Called on startup (orphan cleanup) and on app exit.
pub fn kill_gstreamer() {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "gst-launch-1.0.exe"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("pkill")
            .arg("-f")
            .arg("gst-launch-1.0")
            .output();
    }
}
