use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::process::Child;
use tauri::{AppHandle, Emitter};
use crate::gstreamer::{path_setup::get_gst_launch, pipeline::build_pipeline};

// Global GStreamer process handle
static GST_PROCESS: std::sync::OnceLock<Arc<Mutex<Option<Child>>>> =
    std::sync::OnceLock::new();

fn gst_handle() -> &'static Arc<Mutex<Option<Child>>> {
    GST_PROCESS.get_or_init(|| Arc::new(Mutex::new(None)))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamConfig {
    #[serde(rename = "targetIp")]
    pub target_ip: String,
    pub resolution: String,
    pub fps: u32,
    pub bitrate: u32,
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
) -> Result<StartStreamResult, String> {
    // Kill any existing stream first
    stop_stream_internal();

    let gst_launch = get_gst_launch();
    let pipeline = build_pipeline(&config);

    log::info!("[stream] Starting: {pipeline}");

    // WINDOWS İÇİN DÜZELTME: .exe ekini kaldırdık çünkü değişkenle beraber geliyor
    #[cfg(target_os = "windows")]
    let child = std::process::Command::new("cmd")
        .args(["/C", &format!("{} {}", gst_launch, pipeline)]) // .exe silindi
        .spawn()
        .map_err(|e| format!("Failed to launch GStreamer (Windows): {e}"))?;

    // LINUX / MAC İÇİN (Eski usul devam)
    #[cfg(not(target_os = "windows"))]
    let child = std::process::Command::new(&gst_launch)
        .args(pipeline.split_whitespace())
        .spawn()
        .map_err(|e| format!("Failed to launch GStreamer: {e}"))?;
    
    // PID değerini al (Arayüze göndermek için lazım)
    let pid = child.id();

    // Store handle
    let mut guard = gst_handle().lock().unwrap();
    *guard = Some(child);
    drop(guard);

    // Emit stream-started event
    app.emit("stream-started", serde_json::json!({ "pid": pid }))
        .ok();

    // Watch process in background for crashes
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        let mut g = gst_handle().lock().unwrap();
        if let Some(ref mut c) = *g {
            let status = c.wait();
            drop(g);
            match status {
                Ok(s) if !s.success() => {
                    log::error!("[stream] GStreamer exited with error: {s}");
                    app_clone
                        .emit(
                            "stream-stopped",
                            serde_json::json!({ "reason": "error" }),
                        )
                        .ok();
                }
                Ok(_) => {
                    app_clone
                        .emit(
                            "stream-stopped",
                            serde_json::json!({ "reason": "user" }),
                        )
                        .ok();
                }
                _ => {}
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
    let mut guard = gst_handle().lock().unwrap();
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
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
pub async fn set_stream_volume(volume: f32, mute: bool) -> Result<bool, String> {
    // TODO: GStreamer `volume` element dynamic property change requires
    // pipeline to be launched with GST_DEBUG_DUMP_DOT_DIR or via gst-pipeline
    // managed via gst-rust bindings. For MVP, this is handled via
    // a named pipe / control socket in a future iteration.
    // For now, log and return OK.
    log::info!("[stream] set_stream_volume: volume={volume}, mute={mute}");
    Ok(true)
}
