use std::path::Path;
#[cfg(target_os = "windows")]
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicU8, Ordering};

/// Resolve the gst-launch-1.0 binary path using Tauri's resource resolver.
pub fn get_gst_launch(app: &AppHandle) -> String {
    let platform_subfolder = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", _) => "macos/intel",
        _ => "windows",
    };

    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let gst_root = resource_dir.join("gstreamer").join(platform_subfolder);
    
    log::info!("[gst] Resource Dir: {:?}", resource_dir);
    log::info!("[gst] Looking for GStreamer at: {:?}", gst_root);

    #[cfg(target_os = "windows")]
    {
        if gst_root.exists() {
            // Use Windows Short Path (8.3) to avoid space issues without needing Admin for junctions
            let final_path = get_short_path(&gst_root).unwrap_or_else(|e| {
                log::warn!("[gst] Short path resolution failed: {}. Using original path.", e);
                gst_root.clone()
            });

            log::info!("[gst] Final GStreamer path (Windows): {:?}", final_path);
            apply_gstreamer_env_to_parent(app);
            
            let bin_path = final_path.join("bin").join("gst-launch-1.0.exe");
            return bin_path.to_string_lossy().to_string();
        }

        log::warn!("[gst] Bundled GStreamer NOT FOUND at {:?}, falling back to system PATH", gst_root);
        "gst-launch-1.0.exe".to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        if gst_root.exists() {
            // Apply environment to parent process once during initialization
            apply_gstreamer_env_to_parent(app);
            let bin_name = if cfg!(target_os = "windows") { "gst-launch-1.0.exe" } else { "gst-launch-1.0" };
            return gst_root.join("bin").join(bin_name).to_string_lossy().to_string();
        }

        log::warn!("[gst] Bundled GStreamer not found at {:?}, falling back to system PATH", gst_root);
        "gst-launch-1.0".to_string()
    }
}

/// Windows only: Converts a long path with spaces to a short 8.3 path (e.g. C:\Users\JOHN~1\...)
#[cfg(target_os = "windows")]
fn get_short_path(path: &Path) -> Result<PathBuf, String> {
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Storage::FileSystem::GetShortPathNameW;
    use windows::core::PCWSTR;

    let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let pcwstr_path = PCWSTR(wide_path.as_ptr());
    
    unsafe {
        // First call: get the required buffer size by passing None
        let buffer_size = GetShortPathNameW(
            pcwstr_path,
            None
        );

        if buffer_size == 0 {
            return Err(format!("GetShortPathNameW size query failed (path exists? {})", path.exists()));
        }

        // Second call: actually get the short path by passing Some(&mut buffer)
        let mut buffer = vec![0u16; buffer_size as usize];
        let result = GetShortPathNameW(
            pcwstr_path,
            Some(&mut buffer)
        );

        if result == 0 {
            return Err("GetShortPathNameW execution failed".to_string());
        }

        let short_os_str = OsString::from_wide(&buffer[..result as usize]);
        Ok(PathBuf::from(short_os_str))
    }
}

/// Applies GStreamer environment to a child process Command.
pub fn apply_gstreamer_env_to_cmd(app: &AppHandle, cmd: &mut std::process::Command) {
    let envs = get_gstreamer_env_vars(app);
    for (key, val) in envs {
        if val.is_empty() {
            cmd.env_remove(key);
        } else {
            cmd.env(key, val);
        }
    }
}

/// Applies GStreamer environment to the current parent process.
pub fn apply_gstreamer_env_to_parent(app: &AppHandle) {
    let envs = get_gstreamer_env_vars(app);
    for (key, val) in envs {
        if val.is_empty() {
            // We don't really want to remove from parent unless necessary
        } else {
            std::env::set_var(key, val);
        }
    }
}

fn get_gstreamer_env_vars(app: &AppHandle) -> Vec<(&'static str, String)> {
    let mut envs = Vec::new();
    let platform_subfolder = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", _) => "macos/intel",
        _ => "windows",
    };

    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let gst_root = resource_dir.join("gstreamer").join(platform_subfolder);
    
    let actual_root = if gst_root.join("usr").exists() { gst_root.join("usr") } else { gst_root };

    if actual_root.exists() {
        let bin = actual_root.join("bin");
        let mut lib = actual_root.join("lib");
        let mut plugins = lib.join("gstreamer-1.0");

        #[cfg(target_os = "linux")]
        {
            let multiarch = if cfg!(target_arch = "x86_64") { "x86_64-linux-gnu" } else { "aarch64-linux-gnu" };
            let possible_lib = actual_root.join("lib").join(multiarch);
            if possible_lib.join("gstreamer-1.0").exists() {
                lib = possible_lib;
                plugins = lib.join("gstreamer-1.0");
            }
        }

        let bin_str = bin.to_string_lossy().to_string();
        let lib_str = lib.to_string_lossy().to_string();
        let plugins_str = plugins.to_string_lossy().to_string();

        // 1. Path & LD_LIBRARY_PATH
        #[cfg(target_os = "windows")]
        {
            if let Ok(current_path) = std::env::var("PATH") {
                envs.push(("PATH", format!("{};{};{}", bin_str, lib_str, current_path)));
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
            envs.push((ld_var, new_ld));
        }

        // 2. Plugins (Pure Bundled - No hybrid risk if bundled exists)
        envs.push(("GST_PLUGIN_PATH", plugins_str));
        envs.push(("GST_PLUGIN_SYSTEM_PATH", "".to_string())); // Clear system paths to avoid ABI mismatch
        
        #[cfg(target_os = "linux")]
        if std::env::var("APPDIR").is_ok() {
            envs.push(("GST_REGISTRY", "".to_string())); // Trigger clean scan in AppImage
        }

        // 3. Scanner
        let scanner_name = if cfg!(target_os = "windows") { "gst-plugin-scanner.exe" } else { "gst-plugin-scanner" };
        let mut scanner = actual_root.join("libexec").join("gstreamer-1.0").join(scanner_name);
        if !scanner.exists() { scanner = bin.join(scanner_name); }
        if scanner.exists() {
            envs.push(("GST_PLUGIN_SCANNER", scanner.to_string_lossy().to_string()));
        }
    }

    // 4. Debugging
    let data_dir = app.path().app_local_data_dir().unwrap_or_default();
    let registry_path = data_dir.join("gstreamer_registry_1_24_13.bin");
    envs.push(("GST_REGISTRY", registry_path.to_string_lossy().to_string()));
    envs.push(("GST_DEBUG_FILE", data_dir.join("gst_debug.log").to_string_lossy().to_string()));
    envs.push(("GST_DEBUG", "3".to_string()));

    envs
}

#[cfg(target_os = "windows")]
static WIN_VIDEO_SRC_CACHE: AtomicU8 = AtomicU8::new(0);

/// Checks which Windows video source is available and best for this system.
#[cfg(target_os = "windows")]
pub fn get_best_windows_src(app: &AppHandle) -> (String, bool) {
    let cached = WIN_VIDEO_SRC_CACHE.load(Ordering::SeqCst);
    
    let mode = if cached == 0 {
        let has_src = is_element_available(app, "d3d11screencapturesrc");
        let has_down = is_element_available(app, "d3d11download");
        
        let d3d11_ok = has_src && has_down;

        let best = if d3d11_ok {
            log::info!("[gst] D3D11 pipeline fully available (src + download).");
            1 // D3D11
        } else {
            if !has_src { log::warn!("[gst] D3D11 source element NOT available."); }
            if !has_down { log::warn!("[gst] D3D11 download element NOT available."); }

            if is_element_available(app, "dx9screencapsrc") {
                log::info!("[gst] Falling back to DX9.");
                2 // DX9
            } else {
                log::warn!("[gst] DX9 not available. Falling back to GDI.");
                3 // GDI
            }
        };
        WIN_VIDEO_SRC_CACHE.store(best, Ordering::SeqCst);
        best
    } else {
        cached
    };

    match mode {
        1 => ("d3d11screencapturesrc".to_string(), true),
        2 => ("dx9screencapsrc".to_string(), false),
        _ => ("gdiscreencapsrc".to_string(), false),
    }
}

/// Checks which Linux video source is available.
#[cfg(target_os = "linux")]
pub fn get_best_linux_src(app: &AppHandle) -> String {
    let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
    
    // Safety check: On Linux, if we are in an AppImage, we must ensure we don't hide system plugins.
    // We'll do a quick check for ximagesrc.
    let has_x11_src = is_element_available(app, "ximagesrc");
    let has_wayland_src = is_element_available(app, "pipewiresrc");

    log::info!("[gst] Linux element detection: ximagesrc={}, pipewiresrc={}, wayland={}", has_x11_src, has_wayland_src, is_wayland);

    // Priority 1: If on Wayland, always prefer pipewiresrc
    if is_wayland && has_wayland_src {
        log::info!("[gst] Wayland detected, using pipewiresrc for capture.");
        return "pipewiresrc".to_string();
    }

    // Priority 2: Standard X11 capture
    if has_x11_src {
        log::info!("[gst] Using ximagesrc for Linux screen capture.");
        "ximagesrc".to_string()
    } else if has_wayland_src {
        log::info!("[gst] Falling back to pipewiresrc.");
        "pipewiresrc".to_string()
    } else {
        // EMERGENCY FALLBACK: If detection fails but we know the session type, trust the session type.
        // This handles cases where gst-inspect-1.0 fails due to AppImage environment issues.
        if !is_wayland {
            log::warn!("[gst] Detection failed but X11 session detected. Forcing ximagesrc.");
            "ximagesrc".to_string()
        } else {
            log::warn!("[gst] Detection failed but Wayland session detected. Forcing pipewiresrc.");
            "pipewiresrc".to_string()
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn is_element_available(app: &AppHandle, name: &str) -> bool {
    let exe_name = if cfg!(target_os = "windows") { "gst-inspect-1.0.exe" } else { "gst-inspect-1.0" };
    let bin_dir = get_gst_bin_dir(app);
    let inspect_path = Path::new(&bin_dir).join(exe_name);
    
    let mut cmd = if inspect_path.exists() {
        std::process::Command::new(inspect_path)
    } else {
        std::process::Command::new(exe_name)
    };

    // SINGLE SOURCE OF TRUTH: Use the centralized environment setup
    apply_gstreamer_env_to_cmd(app, &mut cmd);

    let output = cmd.arg(name).output();
    
    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

/// Helper to get the bin dir for setting CWD during execution
pub fn get_gst_bin_dir(app: &AppHandle) -> String {
    let platform_subfolder = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", _) => "macos/intel",
        _ => "windows",
    };

    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let gst_root = resource_dir.join("gstreamer").join(platform_subfolder);

    #[cfg(target_os = "windows")]
    {
        if gst_root.exists() {
            let final_path = get_short_path(&gst_root).unwrap_or_else(|e| {
                log::warn!("[gst] Short path resolution (bin_dir) failed: {}. Using original path.", e);
                gst_root.clone()
            });
            return final_path.join("bin").to_string_lossy().to_string();
        }
        std::env::temp_dir().to_string_lossy().to_string()
    }

    #[cfg(not(target_os = "windows"))]
    {
        if gst_root.exists() {
            gst_root.join("bin").to_string_lossy().to_string()
        } else {
            std::env::temp_dir().to_string_lossy().to_string()
        }
    }
}
