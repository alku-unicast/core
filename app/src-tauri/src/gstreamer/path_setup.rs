use std::path::Path;
#[cfg(target_os = "windows")]
use std::path::PathBuf;
use tauri::AppHandle;
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
            setup_gstreamer_env(app, &final_path);
            
            let bin_path = final_path.join("bin").join("gst-launch-1.0.exe");
            return bin_path.to_string_lossy().to_string();
        }

        log::warn!("[gst] Bundled GStreamer NOT FOUND at {:?}, falling back to system PATH", gst_root);
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

    let data_dir = app
        .path()
        .app_local_data_dir()
        .unwrap_or_default();

    // Registry is version-keyed so GStreamer auto-invalidates it on upgrades.
    // Do NOT delete it on every launch — that forces a slow full plugin re-scan
    // every time gst-launch starts, which takes 2-3s and can crash mid-scan.
    // Use a versioned registry filename to force a fresh scan for this build.
    // If the registry was previously empty/stale, this ensures a re-scan.
    let registry_path = data_dir.join("gstreamer_registry_1_24_13.bin");
    if let Some(path_str) = registry_path.to_str() {
        std::env::set_var("GST_REGISTRY", path_str);
        log::info!("[gst] Using registry at: {}", path_str);
    }

    // Write gst-launch stderr to a rotated log file for post-crash diagnosis.
    let debug_log = data_dir.join("gst_debug.log");
    if let Some(path_str) = debug_log.to_str() {
        std::env::set_var("GST_DEBUG_FILE", path_str);
    }
    
    // Level 3 (INFO) is sufficient for plugin scanning diagnostics without bloating the disk.
    std::env::set_var("GST_DEBUG", "3");
    
    // Diagnostic: Check for bundled VC++ DLLs
    #[cfg(target_os = "windows")]
    {
        let dlls = ["vcruntime140_1.dll", "concrt140.dll", "msvcp140_1.dll"];
        for dll in dlls {
            let p = bin.join(dll);
            if p.exists() {
                log::info!("[gst] Bundled DLL found: {}", dll);
            } else {
                log::warn!("[gst] Bundled DLL MISSING: {}", dll);
            }
        }
    }

    log::info!("[gst] Environment setup complete for platform root: {:?}", gst_root);
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
    let platform_subfolder = match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", _) => "windows",
        ("linux", _) => "linux",
        ("macos", "aarch64") => "macos/silicon",
        ("macos", _) => "macos/intel",
        _ => "windows",
    };

    let resource_dir = app.path().resource_dir().unwrap_or_default();
    let gst_root = resource_dir.join("gstreamer").join(platform_subfolder);
    let bin_dir = get_gst_bin_dir(app);
    let exe_name = if cfg!(target_os = "windows") { "gst-inspect-1.0.exe" } else { "gst-inspect-1.0" };
    
    let inspect_path = if gst_root.exists() {
        Path::new(&bin_dir).join(exe_name)
    } else {
        std::path::PathBuf::from(exe_name)
    };

    let mut cmd = std::process::Command::new(&inspect_path);

    // If using bundled GStreamer, set up its specific environment
    if gst_root.exists() {
        let plugins_path = gst_root.join("lib").join("gstreamer-1.0");
        if plugins_path.exists() {
            cmd.env("GST_PLUGIN_PATH", plugins_path.to_string_lossy().to_string());
        }

        #[cfg(target_os = "windows")]
        {
            let current_path = std::env::var("PATH").unwrap_or_default();
            cmd.env("PATH", format!("{};{}", bin_dir, current_path));
            
            // Handle Windows registry if needed
            let data_dir = app.path().app_local_data_dir().unwrap_or_default();
            let reg_path = data_dir.join("gstreamer_registry_1_24_13.bin");
            cmd.env("GST_REGISTRY", reg_path.to_string_lossy().to_string());
        }
    } else {
        // If using system GStreamer on Linux AppImage, clear environment to avoid pollution.
        #[cfg(target_os = "linux")]
        if std::env::var("APPDIR").is_ok() {
            cmd.env_clear();

            let vars_to_restore = [
                "DISPLAY",
                "XAUTHORITY",
                "WAYLAND_DISPLAY",
                "HOME",
                "XDG_RUNTIME_DIR",
                "DBUS_SESSION_BUS_ADDRESS",
            ];

            for var in vars_to_restore {
                if let Ok(val) = std::env::var(var) {
                    cmd.env(var, val);
                }
            }
            cmd.env("PATH", "/usr/bin:/bin:/usr/local/bin");
            
            if let Ok(orig_ld) = std::env::var("LD_LIBRARY_PATH_ORIG") {
                cmd.env("LD_LIBRARY_PATH", orig_ld);
            }
        }
    }

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
