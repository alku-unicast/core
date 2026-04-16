use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use std::sync::Once;

static GST_SETUP_ONCE: Once = Once::new();

/// Resolve the gst-launch-1.0 binary path using Tauri's resource resolver.
pub fn get_gst_launch(app: &AppHandle) -> String {
    let platform_subfolder = match (cfg!(target_os), cfg!(target_arch)) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", "x86_64") => "macos/intel",
        _ => "windows",
    };

    let gst_root = app.path().resource_dir()
        .unwrap_or_default()
        .join("gstreamer")
        .join(platform_subfolder);

    #[cfg(target_os = "windows")]
    {
        if gst_root.exists() {
            GST_SETUP_ONCE.call_once(|| {
                if let Err(e) = setup_gstreamer_junction(app, &gst_root) {
                    log::error!("[gst] Junction setup failed: {}", e);
                }
            });

            let drive_prefix = get_drive_prefix(&gst_root);
            let pid = std::process::id();
            let junction_path = PathBuf::from(format!("{}\\UCGst_{}", drive_prefix, pid));
            
            let bin_path = junction_path.join("bin").join("gst-launch-1.0.exe");
            setup_gstreamer_env(app, &junction_path);
            return bin_path.to_string_lossy().to_string();
        }

        log::warn!("[gst] Bundled GStreamer not found at {:?}, falling back to system PATH", gst_root);
        "gst-launch-1.0.exe".to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        if gst_root.exists() {
            setup_gstreamer_env(app, &gst_root);
            let bin_name = if cfg!(target_os = "windows") { "gst-launch-1.0.exe" } else { "gst-launch-1.0" };
            return gst_root.join("bin").join(bin_name).to_string_lossy().to_string();
        }

        log::warn!("[gst] Bundled GStreamer not found at {:?}, falling back to system PATH", gst_root);
        "gst-launch-1.0".to_string()
    }
}

#[cfg(target_os = "windows")]
fn get_drive_prefix(path: &Path) -> String {
    let root_str = path.to_string_lossy();
    if root_str.starts_with("\\\\?\\") {
        root_str[4..6].to_string()
    } else if root_str.len() >= 2 && &root_str[1..2] == ":" {
        root_str[0..2].to_string()
    } else {
        "C:".to_string()
    }
}

/// Creates a directory junction at the root of the current drive to avoid spaces in paths.
/// For example: D:\Okul Belgeleri\... -> D:\UC_Gst
#[cfg(target_os = "windows")]
fn setup_gstreamer_junction(_app: &AppHandle, gst_root: &Path) -> Result<PathBuf, String> {
    let drive_prefix = get_drive_prefix(gst_root);
    let pid = std::process::id();
    let junction_path = PathBuf::from(format!("{}\\UCGst_{}", drive_prefix, pid));

    if junction_path.exists() {
        return Ok(junction_path);
    }

    let _ = std::process::Command::new("cmd")
        .args(["/C", "rmdir", "/S", "/Q", &junction_path.to_string_lossy()])
        .output();

    let mut clean_target = gst_root.to_string_lossy().to_string();
    if clean_target.starts_with("\\\\?\\") {
        clean_target = clean_target[4..].to_string();
    }

    log::info!("[gst] Mapping GStreamer runtime to: {}", junction_path.display());
    
    let output = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J", &junction_path.to_string_lossy(), &clean_target])
        .output()
        .map_err(|e| format!("Failed to execute mklink command: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        if !junction_path.exists() {
            return Err(format!("mklink /J failed: {}", err.trim()));
        }
    }

    Ok(junction_path)
}

fn setup_gstreamer_env(app: &AppHandle, gst_root: &Path) {
    // Smart root detection: some extractions (like dpkg -x) nest everything under "usr/"
    let actual_root = if gst_root.join("usr").exists() {
        gst_root.join("usr")
    } else {
        gst_root.to_path_buf()
    };

    let bin = actual_root.join("bin");
    
    // Smart lib detection: Official tar.xz uses "lib", Debian uses "lib/x86_64-linux-gnu"
    let mut lib = actual_root.join("lib");
    let mut plugins = lib.join("gstreamer-1.0");

    if !plugins.exists() {
        // Check for common multiarch paths used in Ubuntu/Debian
        let possible_lib = if cfg!(target_arch = "x86_64") && cfg!(target_os = "linux") {
            actual_root.join("lib").join("x86_64-linux-gnu")
        } else if cfg!(target_arch = "aarch64") && cfg!(target_os = "linux") {
            actual_root.join("lib").join("aarch64-linux-gnu")
        } else {
            actual_root.join("lib")
        };

        if possible_lib.join("gstreamer-1.0").exists() {
            lib = possible_lib;
            plugins = lib.join("gstreamer-1.0");
            log::info!("[gst] Detected multiarch lib path: {:?}", lib);
        }
    }

    let scanner_name = if cfg!(target_os = "windows") { "gst-plugin-scanner.exe" } else { "gst-plugin-scanner" };
    
    // Scanner can be in libexec or in the same bin dir depending on build
    let mut scanner = actual_root.join("libexec").join("gstreamer-1.0").join(scanner_name);
    if !scanner.exists() {
        scanner = bin.join(scanner_name);
    }

    let bin_str = bin.to_string_lossy().to_string();
    let lib_str = lib.to_string_lossy().to_string();
    let plugins_str = plugins.to_string_lossy().to_string();
    let scanner_str = scanner.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let current_path = std::env::var("PATH").unwrap_or_default();
        if !current_path.contains(&bin_str) {
            let new_path = format!(
                "{};{};{}",
                bin_str,
                lib_str,
                current_path
            );
            std::env::set_var("PATH", &new_path);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let ld_var = if cfg!(target_os = "macos") { "DYLD_LIBRARY_PATH" } else { "LD_LIBRARY_PATH" };
        let current_ld = std::env::var(ld_var).unwrap_or_default();
        let new_ld = if current_ld.is_empty() {
            format!("{}:{}", bin_str, lib_str)
        } else {
            format!("{}:{}:{}", bin_str, lib_str, current_ld)
        };
        std::env::set_var(ld_var, new_ld);
    }
    
    std::env::set_var("GST_PLUGIN_PATH", &plugins_str);
    std::env::set_var("GST_PLUGIN_SYSTEM_PATH", &plugins_str);
    
    if scanner.exists() {
        std::env::set_var("GST_PLUGIN_SCANNER", &scanner_str);
    } else {
        log::error!("[gst] Plugin scanner NOT FOUND at {:?}. Cross-platform plugins might fail to load!", scanner);
    }

    let registry_path = app
        .path()
        .app_local_data_dir()
        .unwrap_or_default()
        .join("gstreamer_registry.bin");

    if registry_path.exists() {
        if let Err(e) = std::fs::remove_file(&registry_path) {
            log::warn!("[gst] Could not clear registry: {}", e);
        } else {
            log::info!("[gst] Registry cleared for fresh scan: {:?}", registry_path);
        }
    }

    if let Some(path_str) = registry_path.to_str() {
        std::env::set_var("GST_REGISTRY", path_str);
    }
    
    std::env::set_var("GST_DEBUG", "2");
    log::info!("[gst] Environment setup complete for platform root: {:?}", gst_root);
}

/// Helper to get the bin dir for setting CWD during execution
pub fn get_gst_bin_dir(app: &AppHandle) -> String {
    let platform_subfolder = match (cfg!(target_os), cfg!(target_arch)) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", "x86_64") => "macos/intel",
        _ => "windows",
    };

    let gst_root = app.path().resource_dir()
        .unwrap_or_default()
        .join("gstreamer")
        .join(platform_subfolder);
        
    #[cfg(target_os = "windows")]
    {
        let drive_prefix = get_drive_prefix(&gst_root);
        let pid = std::process::id();
        format!("{}\\UCGst_{}\\bin", drive_prefix, pid)
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        gst_root.join("bin").to_string_lossy().to_string()
    }
}
