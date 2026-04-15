use serde::{Deserialize, Serialize};
use crate::gstreamer::path_setup::get_gst_launch;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncoderResult {
    pub name: String,
    #[serde(rename = "hwType")]
    pub hw_type: String,
}

#[cfg(target_os = "windows")]
const ENCODER_CHAIN: &[(&str, &str)] = &[
    ("nvh264enc", "NVIDIA"),
    ("qsvh264enc", "Intel QSV"),
    ("amfh264enc", "AMD AMF"),
    ("x264enc", "Software"),
];

#[cfg(target_os = "macos")]
const ENCODER_CHAIN: &[(&str, &str)] = &[
    ("vtenc_h264", "Apple VideoToolbox"),
    ("x264enc", "Software"),
];

#[cfg(target_os = "linux")]
const ENCODER_CHAIN: &[(&str, &str)] = &[
    ("vaapih264enc", "VA-API"),
    ("nvh264enc", "NVIDIA"),
    ("x264enc", "Software"),
];

/// Test each encoder in the fallback chain, return first working one.
/// Uses a short timeout (5s per encoder) to prevent hanging on broken drivers.
#[tauri::command]
pub async fn detect_encoder(app: tauri::AppHandle) -> Result<EncoderResult, String> {
    let gst_launch = get_gst_launch(&app);
    let bin_dir = crate::gstreamer::path_setup::get_gst_bin_dir(&app);

    for (encoder, hw_type) in ENCODER_CHAIN {
        // Small test pipeline: REAL D3D11 capture -> encoder -> fakesink
        // This ensures the hardware PATH (capture + encode) actually works.
        let pipeline = format!(
            "d3d11screencapturesrc monitor-index=0 num-buffers=1 ! \
             d3d11download ! \
             video/x-raw,format=NV12,width=640,height=360,framerate=30/1 ! \
             {encoder} ! fakesink"
        );

        let result = {
            #[cfg(target_os = "windows")]
            {
                // Split the pipeline into separate arguments to avoid syntax errors on Windows
                tokio::process::Command::new(&gst_launch)
                    .args(["-q"])
                    .args(pipeline.split_whitespace())
                    .current_dir(&bin_dir)
                    .output()
                    .await
            }
            #[cfg(not(target_os = "windows"))]
            {
                tokio::process::Command::new(&gst_launch)
                    .args(["-q", &pipeline])
                    .output()
                    .await
            }
        };

        match result {
            Ok(output) if output.status.success() => {
                log::info!("[encoder] Detected: {encoder} ({hw_type})");
                return Ok(EncoderResult {
                    name: encoder.to_string(),
                    hw_type: hw_type.to_string(),
                });
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::debug!(
                    "[encoder] {encoder} failed (exit {}): {}",
                    output.status.code().unwrap_or(-1),
                    stderr.chars().take(200).collect::<String>()
                );
            }
            Err(e) => {
                log::debug!("[encoder] {encoder} error: {e}");
            }
        }
    }

    Err("No suitable encoder found".to_string())
}
