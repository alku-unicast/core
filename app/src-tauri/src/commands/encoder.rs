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
#[tauri::command]
pub async fn detect_encoder() -> Result<EncoderResult, String> {
    let gst_launch = get_gst_launch();

    for (encoder, hw_type) in ENCODER_CHAIN {
        let pipeline = format!(
            "videotestsrc num-buffers=10 ! video/x-raw,width=640,height=360,framerate=30/1 \
             ! videoconvert ! {encoder} ! fakesink"
        );

        let result = {
            #[cfg(target_os = "windows")]
            {
                // Must wrap in cmd /C on Windows (same as start_stream)
                tokio::process::Command::new("cmd")
                    .args(["/C", &format!("{} {}", gst_launch, pipeline)])
                    .output()
                    .await
            }
            #[cfg(not(target_os = "windows"))]
            {
                tokio::process::Command::new(&gst_launch)
                    .args(pipeline.split_whitespace())
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
            _ => {
                log::debug!("[encoder] {encoder} not available, trying next...");
            }
        }
    }

    Err("No suitable encoder found".to_string())
}
