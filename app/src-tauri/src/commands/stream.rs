use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::process::Child;
use tauri::{AppHandle, Emitter};
use crate::gstreamer::{path_setup::get_gst_launch, pipeline::build_pipeline};

// Global GStreamer process handle
static GST_PROCESS: std::sync::OnceLock<Arc<Mutex<Option<Child>>>> =
    std::sync::OnceLock::new();

// Global Heartbeat flag
static HEARTBEAT_RUNNING: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

// Global session token — set on stream start, cleared on stop.
// Stored here so separate WebviewWindows (streaming bar) don't need to pass it.
static SESSION_TOKEN: std::sync::OnceLock<Arc<Mutex<Option<String>>>> =
    std::sync::OnceLock::new();

fn gst_handle() -> &'static Arc<Mutex<Option<Child>>> {
    GST_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)))
}

fn session_token_handle() -> &'static Arc<Mutex<Option<String>>> {
    SESSION_TOKEN.get_or_init(|| Arc::new(Mutex::new(None)))
}

/// Spawns a background task that sends "HEARTBEAT:<token>" to the receiver every 2 seconds.
/// This prevents the Pi's safety timeout (5s) from kicking in.
fn spawn_heartbeat(target_ip: String, session_token: String) {
    HEARTBEAT_RUNNING.store(true, std::sync::atomic::Ordering::SeqCst);

    tokio::spawn(async move {
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok();
        let addr = format!("{}:5001", target_ip);
        let hb_msg = format!("HEARTBEAT:{}", session_token);
        let stop_msg = format!("STOP:{}", session_token);

        while HEARTBEAT_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
            if let Some(ref sock) = socket {
                let _ = sock.send_to(hb_msg.as_bytes(), &addr);
            }
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }

        // Final "STOP:<token>" for graceful cleanup on Pi side
        if let Some(ref sock) = socket {
            let _ = sock.send_to(stop_msg.as_bytes(), &addr);
        }
        log::info!("[heartbeat] Stopped for {}", target_ip);
    });
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamConfig {
    #[serde(rename = "targetIp")]
    pub target_ip: String,
    pub resolution: String,
    pub fps: u32,
    pub bitrate: u32,
    #[serde(rename = "qualityMode")]
    pub quality_mode: String,       // "presentation" | "video"
    #[serde(rename = "delayBufferMs")]
    pub delay_buffer_ms: u32,
    #[serde(rename = "encoderName")]
    pub encoder_name: String,
    #[serde(rename = "streamMode")]
    pub stream_mode: String,        // "fullscreen" | "window"
    #[serde(rename = "windowId")]
    pub window_id: Option<u64>,
    #[serde(rename = "monitorIndex")]
    pub monitor_index: Option<u32>,
    #[serde(rename = "audioEnabled")]
    pub audio_enabled: bool,
    #[serde(rename = "audioDeviceId")]
    pub audio_device_id: Option<String>,
    #[serde(rename = "muteLocal")]
    pub mute_local: bool,
    // macOS window-mode crop bounds (physical pixels)
    #[serde(rename = "windowX")]
    pub window_x: Option<i32>,
    #[serde(rename = "windowY")]
    pub window_y: Option<i32>,
    #[serde(rename = "windowW")]
    pub window_w: Option<u32>,
    #[serde(rename = "windowH")]
    pub window_h: Option<u32>,
    #[serde(rename = "screenW")]
    pub screen_w: Option<u32>,
    #[serde(rename = "screenH")]
    pub screen_h: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct StartStreamResult {
    pub success: bool,
    pub pid: u32,
}

#[tauri::command]
pub async fn start_stream(
    app: AppHandle,
    config: StreamConfig,
    session_token: String,
) -> Result<StartStreamResult, String> {
    // Kill any existing stream first
    stop_stream_internal();

    // Re-apply WDA_EXCLUDEFROMCAPTURE to the streaming bar before GStreamer starts.
    // On some Windows/WebView2 configurations, hide() may reset the flag set at startup.
    // Applying it here guarantees GStreamer never captures even the first frame of the bar.
    #[cfg(target_os = "windows")]
    {
        if let Some(bar) = app.get_webview_window("streaming-bar") {
            if let Ok(hwnd) = bar.hwnd() {
                crate::utils::capture_exclusion::exclude_from_capture(hwnd.0 as isize);
            }
        }
    }

    let gst_launch = get_gst_launch(&app);
    let bin_dir = crate::gstreamer::path_setup::get_gst_bin_dir(&app);
    let pipeline = build_pipeline(&app, &config);

    println!("[stream] gst_launch path: {}", gst_launch);
    println!("[stream] bin_dir (CWD): {}", bin_dir);
    println!("[stream] pipeline: {}", pipeline);
    println!("[stream] Full command about to run: {} {}", gst_launch, pipeline);

    // WINDOWS: Split the pipeline into separate arguments for gst-launch-1.0.
    // CREATE_NO_WINDOW (0x08000000) prevents a CMD console popup on Windows.
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    #[cfg(target_os = "windows")]
    let mut child = {
        let mut cmd = std::process::Command::new(&gst_launch);
        cmd.args(pipeline.split_whitespace())
            .current_dir(&bin_dir)
            .creation_flags(0x08000000); // CREATE_NO_WINDOW
        cmd.spawn()
            .map_err(|e| format!("Failed to launch GStreamer (Windows): {e}"))?
    };

    // LINUX / MAC İÇİN (Eski usul devam)
    #[cfg(not(target_os = "windows"))]
    let mut cmd = std::process::Command::new(&gst_launch);
    
    #[cfg(not(target_os = "windows"))]
    {
        cmd.args(pipeline.split_whitespace());
        
        // Apply platform-specific GStreamer environment (Single Source of Truth)
        crate::gstreamer::path_setup::apply_gstreamer_env_to_cmd(&app, &mut cmd);

        #[cfg(target_os = "linux")]
        {
            if let Some(bin_dir) = std::path::Path::new(&gst_launch).parent() {
                cmd.current_dir(bin_dir);
                log::info!("[stream] bin_dir (CWD): {:?}", bin_dir);
            }
            // Nuclear fix: Force-disable MIT-SHM at X11 level to prevent BadMatch crashes during window resize
            cmd.env("_X11_NO_MITSHM", "1");
        }
    }

    #[cfg(not(target_os = "windows"))]
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to launch GStreamer: {e}"))?;

    // --- UNIVERSAL FALLBACK LOGIC ---
    // Wait a tiny bit to see if it crashes immediately (e.g. driver error)
    std::thread::sleep(std::time::Duration::from_millis(500));
    if let Ok(Some(status)) = child.try_wait() {
        if !status.success() {
            if config.encoder_name != "x264enc" {
                log::warn!("[stream] Hardware encoder failed immediately. Falling back to software (x264enc)...");
                let mut fallback_config = config.clone();
                fallback_config.encoder_name = "x264enc".to_string();
                return Box::pin(start_stream(app, fallback_config, session_token)).await;
            } else {
                return Err(format!(
                    "GStreamer pipeline failed immediately (exit {:?}). GST_PLUGIN_PATH={:?}  Log: {:?}",
                    status.code(),
                    std::env::var("GST_PLUGIN_PATH").unwrap_or_else(|_| "<not set>".to_string()),
                    std::env::var("GST_DEBUG_FILE").unwrap_or_else(|_| "<not set>".to_string()),
                ));
            }
        }
    }
    // --------------------------------

    // PID değerini al (Arayüze göndermek için lazım)
    let pid = child.id();

    // Store handle
    let mut guard = gst_handle().lock().unwrap();
    *guard = Some(child);
    drop(guard);

    // Store token globally so streaming bar window can use it without sharing JS state
    *session_token_handle().lock().unwrap() = Some(session_token.clone());

    // Start heartbeat loop
    spawn_heartbeat(config.target_ip.clone(), session_token);

    // Emit stream-started event
    app.emit("stream-started", serde_json::json!({ "pid": pid }))
        .ok();

    // Watch process in background for crashes
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));
            let mut g = gst_handle().lock().unwrap();
            // Checking status without blocking the mutex for long
            let status = match &mut *g {
                Some(c) => c.try_wait(),
                None => break, // Process explicitly set to None by stop_stream_internal
            };
            drop(g); // Immediate drop before handling result

            match status {
                Ok(Some(s)) => {
                    stop_stream_internal(); // Ensure heartbeat stops too
                    if !s.success() {
                        log::error!("[stream] GStreamer exited with error: {s}");
                        app_clone.emit("stream-stopped", serde_json::json!({ "reason": "error" })).ok();
                    } else {
                        app_clone.emit("stream-stopped", serde_json::json!({ "reason": "user" })).ok();
                    }
                    break;
                }
                Ok(None) => {}, // Still running
                Err(_) => break, // Check failure
            }
        }
    });

    Ok(StartStreamResult { success: true, pid })
}

#[tauri::command]
pub fn stop_stream(app: AppHandle) -> bool {
    let stopped = stop_stream_internal();
    if stopped {
        app.emit("stream-stopped", serde_json::json!({ "reason": "user" }))
            .ok();
    }
    stopped
}

pub fn stop_stream_internal() -> bool {
    // 1. Stop Heartbeat Loop + clear session token
    HEARTBEAT_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
    *session_token_handle().lock().unwrap() = None;

    // 2. Kill GStreamer
    let mut guard = gst_handle().lock().unwrap();
    if let Some(mut child) = guard.take() {
        #[cfg(target_os = "windows")]
        let pid = child.id();
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .output();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill();
        }
        let _ = child.wait(); // Safe now since we own it locally
        log::info!("[stream] GStreamer stopped.");
        return true;
    }
    false
}

#[tauri::command]
pub async fn switch_stream_mode(
    _app: AppHandle,
    mode: String,
    window_id: Option<u64>,
) -> Result<bool, String> {
    // Get current config is not stored — in MVP we restart with new mode.
    // connectionStore on frontend will call start_stream again with new mode.
    log::info!("[stream] switch_stream_mode to {mode}, window={window_id:?}");
    Ok(true)
}

#[tauri::command]
pub async fn set_stream_volume(
    volume: f32,
    mute: bool,
    target_ip: Option<String>,
) -> Result<bool, String> {
    log::info!("[stream] set_stream_volume: volume={volume}, mute={mute}, target={target_ip:?}");

    if let Some(ip) = target_ip {
        let token = session_token_handle().lock().unwrap().clone();
        if let Some(token) = token {
            let addr = format!("{}:5001", ip);
            let socket = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;

            let vol_value = if mute { 0u32 } else { (volume * 100.0) as u32 };
            let msg = format!("VOLUME:{}:{}", vol_value, token);

            let _ = socket.send_to(msg.as_bytes(), &addr);
        }
    }

    Ok(true)
}
