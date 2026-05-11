use std::path::{Path, PathBuf};
use std::sync::Once;
use tauri::{AppHandle, Manager};

static GST_SETUP_ONCE: Once = Once::new();

pub fn get_gst_launch(app: &AppHandle) -> String {
    #[cfg(target_os = "windows")]
    {
        let gst_root = app
            .path()
            .resource_dir()
            .unwrap_or_default()
            .join("gstreamer");

        if gst_root.exists() {
            GST_SETUP_ONCE.call_once(|| {
                if let Err(e) = setup_gstreamer_junction(app, &gst_root) {
                    log::error!("[gst] Junction setup failed: {}", e);
                }
            });

            let drive_prefix = get_drive_prefix(&gst_root);
            let pid = std::process::id();
            let junction_path = PathBuf::from(format!("{}\\UCGst_{}", drive_prefix, pid));

            setup_gstreamer_env(app, &junction_path);

            let bin_path = junction_path.join("bin").join("gst-launch-1.0.exe");
            return bin_path.to_string_lossy().to_string();
        }

        log::warn!(
            "[gst] Bundled GStreamer not found at {:?}, falling back to system PATH",
            gst_root
        );

        "gst-launch-1.0.exe".to_string()
    }

    #[cfg(target_os = "macos")]
    {
        let gst_root = resolve_gstreamer_root(app, "macos");

        if gst_root.exists() {
            setup_gstreamer_env_unix(app, &gst_root);

            let launch_path = gst_root.join("bin").join("gst-launch-1.0");
            if launch_path.exists() {
                return launch_path.to_string_lossy().to_string();
            }

            log::warn!(
                "[gst] Bundled macOS gst-launch not found at {:?}, falling back to system PATH",
                launch_path
            );
        }

        "gst-launch-1.0".to_string()
    }

    #[cfg(target_os = "linux")]
    {
        let gst_root = resolve_gstreamer_root(app, "linux");

        if gst_root.exists() {
            setup_gstreamer_env_unix(app, &gst_root);

            let launch_path = gst_root.join("bin").join("gst-launch-1.0");
            if launch_path.exists() {
                return launch_path.to_string_lossy().to_string();
            }

            log::warn!(
                "[gst] Bundled Linux gst-launch not found at {:?}, falling back to system PATH",
                launch_path
            );
        }

        "gst-launch-1.0".to_string()
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn resolve_gstreamer_root(app: &AppHandle, platform: &str) -> PathBuf {
    let resource_root = app.path().resource_dir().unwrap_or_default();

    let bundled_platform = resource_root.join("gstreamer").join(platform);
    if bundled_platform.exists() {
        return bundled_platform;
    }

    let bundled_flat = resource_root.join("gstreamer");
    if bundled_flat.join("bin").join("gst-launch-1.0").exists() {
        return bundled_flat;
    }

    let dev_platform = std::env::current_dir()
        .unwrap_or_default()
        .join("src-tauri")
        .join("gstreamer")
        .join(platform);

    if dev_platform.exists() {
        return dev_platform;
    }

    let dev_alt = std::env::current_dir()
        .unwrap_or_default()
        .join("app")
        .join("src-tauri")
        .join("gstreamer")
        .join(platform);

    if dev_alt.exists() {
        return dev_alt;
    }

    bundled_platform
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn setup_gstreamer_env_unix(app: &AppHandle, gst_root: &Path) {
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = lib.join("gstreamer-1.0");

    let bin_str = bin.to_string_lossy().to_string();
    let lib_str = lib.to_string_lossy().to_string();
    let plugins_str = plugins.to_string_lossy().to_string();

    let current_path = std::env::var("PATH").unwrap_or_default();
    if !current_path.contains(&bin_str) {
        std::env::set_var("PATH", format!("{}:{}", bin_str, current_path));
    }

    #[cfg(target_os = "macos")]
    {
        let current_dyld = std::env::var("DYLD_LIBRARY_PATH").unwrap_or_default();
        if !current_dyld.contains(&lib_str) {
            std::env::set_var("DYLD_LIBRARY_PATH", format!("{}:{}", lib_str, current_dyld));
        }
    }

    #[cfg(target_os = "linux")]
    {
        let current_ld = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
        if !current_ld.contains(&lib_str) {
            std::env::set_var("LD_LIBRARY_PATH", format!("{}:{}", lib_str, current_ld));
        }
    }

    std::env::set_var("GST_PLUGIN_PATH", &plugins_str);
    std::env::set_var("GST_PLUGIN_SYSTEM_PATH", &plugins_str);

    let scanner = gst_root
        .join("libexec")
        .join("gstreamer-1.0")
        .join("gst-plugin-scanner");

    if scanner.exists() {
        std::env::set_var("GST_PLUGIN_SCANNER", scanner.to_string_lossy().to_string());
    }

    let registry_path = app
        .path()
        .app_local_data_dir()
        .unwrap_or_default()
        .join("gstreamer_registry.bin");

    if let Some(path_str) = registry_path.to_str() {
        std::env::set_var("GST_REGISTRY", path_str);
    }

    std::env::set_var("GST_DEBUG", "2");

    println!("[gst] Unix GStreamer root: {}", gst_root.display());
    println!("[gst] Unix GStreamer bin: {}", bin.display());
    println!("[gst] Unix GStreamer plugins: {}", plugins.display());
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

#[cfg(target_os = "windows")]
fn setup_gstreamer_env(app: &AppHandle, gst_root: &Path) {
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = gst_root.join("lib").join("gstreamer-1.0");
    let scanner = gst_root
        .join("libexec")
        .join("gstreamer-1.0")
        .join("gst-plugin-scanner.exe");

    let bin_str = bin.to_string_lossy().to_string();
    let lib_str = lib.to_string_lossy().to_string();
    let plugins_str = plugins.to_string_lossy().to_string();
    let scanner_str = scanner.to_string_lossy().to_string();

    let current_path = std::env::var("PATH").unwrap_or_default();

    if !current_path.contains(&bin_str) {
        std::env::set_var("PATH", format!("{};{};{}", bin_str, lib_str, current_path));
    }

    std::env::set_var("GST_PLUGIN_PATH", &plugins_str);
    std::env::set_var("GST_PLUGIN_SYSTEM_PATH", &plugins_str);

    if scanner.exists() {
        std::env::set_var("GST_PLUGIN_SCANNER", &scanner_str);
    }

    let registry_path = app
        .path()
        .app_local_data_dir()
        .unwrap_or_default()
        .join("gstreamer_registry.bin");

    if let Some(path_str) = registry_path.to_str() {
        std::env::set_var("GST_REGISTRY", path_str);
    }

    std::env::set_var("GST_DEBUG", "2");

    println!("[gst] Environment pointing to junction: {}", bin_str);
}

pub fn get_gst_bin_dir(app: &AppHandle) -> String {
    #[cfg(target_os = "windows")]
    {
        let gst_root = app
            .path()
            .resource_dir()
            .unwrap_or_default()
            .join("gstreamer");

        let drive_prefix = get_drive_prefix(&gst_root);
        let pid = std::process::id();

        return format!("{}\\UCGst_{}\\bin", drive_prefix, pid);
    }

    #[cfg(target_os = "macos")]
    {
        let gst_root = resolve_gstreamer_root(app, "macos");
        return gst_root.join("bin").to_string_lossy().to_string();
    }

    #[cfg(target_os = "linux")]
    {
        let gst_root = resolve_gstreamer_root(app, "linux");
        return gst_root.join("bin").to_string_lossy().to_string();
    }
}
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn apply_gstreamer_env_to_cmd(
    app: &tauri::AppHandle,
    cmd: &mut std::process::Command,
) {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    let gst_root = resolve_gstreamer_root(app, platform);
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = lib.join("gstreamer-1.0");

    cmd.env("GST_PLUGIN_PATH", plugins.to_string_lossy().to_string());
    cmd.env("GST_PLUGIN_SYSTEM_PATH", plugins.to_string_lossy().to_string());

    #[cfg(target_os = "macos")]
    cmd.env("DYLD_LIBRARY_PATH", lib.to_string_lossy().to_string());

    #[cfg(target_os = "linux")]
    cmd.env("LD_LIBRARY_PATH", lib.to_string_lossy().to_string());

    let current_path = std::env::var("PATH").unwrap_or_default();
    cmd.env("PATH", format!("{}:{}", bin.to_string_lossy(), current_path));
}
#[cfg(any(target_os = "macos", target_os = "linux"))]
pub fn apply_gstreamer_env_to_tokio_cmd(
    app: &tauri::AppHandle,
    cmd: &mut tokio::process::Command,
) {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    let gst_root = resolve_gstreamer_root(app, platform);
    let bin = gst_root.join("bin");
    let lib = gst_root.join("lib");
    let plugins = lib.join("gstreamer-1.0");

    cmd.env("GST_PLUGIN_PATH", plugins.to_string_lossy().to_string());
    cmd.env("GST_PLUGIN_SYSTEM_PATH", plugins.to_string_lossy().to_string());

    #[cfg(target_os = "macos")]
    {
        cmd.env("DYLD_LIBRARY_PATH", lib.to_string_lossy().to_string());
    }

    #[cfg(target_os = "linux")]
    {
        cmd.env("LD_LIBRARY_PATH", lib.to_string_lossy().to_string());
    }

    let current_path = std::env::var("PATH").unwrap_or_default();
    cmd.env("PATH", format!("{}:{}", bin.to_string_lossy(), current_path));
}