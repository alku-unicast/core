use std::path::PathBuf;
use std::sync::OnceLock;

static GST_LAUNCH_PATH: OnceLock<String> = OnceLock::new();

/// Resolve the gst-launch-1.0 binary path.
/// On Windows, looks for portable GStreamer bundle in app directory first,
/// then falls back to PATH.
pub fn get_gst_launch() -> String {
    GST_LAUNCH_PATH
        .get_or_init(|| {
            #[cfg(target_os = "windows")]
            {
                // Check for portable bundle next to the executable
                let exe_dir = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.parent().map(|d| d.to_path_buf()))
                    .unwrap_or_default();

                let portable = exe_dir.join("gstreamer").join("bin").join("gst-launch-1.0.exe");
                if portable.exists() {
                    // Set GStreamer PATH so plugins load correctly
                    setup_gstreamer_env(&exe_dir.join("gstreamer"));
                    return portable.to_string_lossy().to_string();
                }

                // Fall back to system PATH
                "gst-launch-1.0.exe".to_string()
            }
            #[cfg(not(target_os = "windows"))]
            {
                "gst-launch-1.0".to_string()
            }
        })
        .clone()
}

#[cfg(target_os = "windows")]
fn setup_gstreamer_env(gst_root: &PathBuf) {
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = gst_root.join("lib").join("gstreamer-1.0");

    // Prepend GStreamer bin to PATH
    let current_path = std::env::var("PATH").unwrap_or_default();
    let new_path = format!(
        "{};{};{}",
        bin.display(),
        lib.display(),
        current_path
    );
    std::env::set_var("PATH", &new_path);
    std::env::set_var("GST_PLUGIN_PATH", plugins.display().to_string());
    std::env::set_var("GST_PLUGIN_SYSTEM_PATH", plugins.display().to_string());
}
