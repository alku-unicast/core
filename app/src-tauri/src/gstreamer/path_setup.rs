use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Resolve the gst-launch-1.0 binary path using Tauri's resource resolver.
/// On Windows, it looks into the bundled 'gstreamer' resource folder.
pub fn get_gst_launch(app: &AppHandle) -> String {
    #[cfg(target_os = "windows")]
    {
        // Resolve gstreamer folder from resources
        let gst_root = app.path().resource_dir()
            .unwrap_or_default()
            .join("gstreamer");

        let bin_path = gst_root.join("bin").join("gst-launch-1.0.exe");

        if bin_path.exists() {
            // Set GStreamer environment variables for this process
            setup_gstreamer_env(&gst_root);
            return bin_path.to_string_lossy().to_string();
        }

        // Fallback to system PATH if resource is missing
        log::warn!("[gst] Bundled GStreamer not found at {:?}, falling back to system PATH", bin_path);
        "gst-launch-1.0.exe".to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux handling (assuming system GStreamer or AppImage bundled)
        "gst-launch-1.0".to_string()
    }
}

#[cfg(target_os = "windows")]
fn setup_gstreamer_env(gst_root: &PathBuf) {
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = gst_root.join("lib").join("gstreamer-1.0");

    // Prepend GStreamer bin and lib to PATH for DLL discovery
    let current_path = std::env::var("PATH").unwrap_or_default();
    let new_path = format!(
        "{};{};{}",
        bin.display(),
        lib.display(),
        current_path
    );
    
    std::env::set_var("PATH", &new_path);
    
    // Set plugin search paths
    let plugins_str = plugins.display().to_string();
    std::env::set_var("GST_PLUGIN_PATH", &plugins_str);
    std::env::set_var("GST_PLUGIN_SYSTEM_PATH", &plugins_str);
    
    log::info!("[gst] Environment configured with: {}", bin.display());
}
