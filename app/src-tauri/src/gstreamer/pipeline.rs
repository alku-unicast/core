use tauri::AppHandle;
use crate::commands::stream::StreamConfig;
#[cfg(any(target_os = "windows", target_os = "linux"))]
use crate::gstreamer::path_setup;

// ── Encoder-specific GStreamer parameters ─────────────────────────────────
// Each hardware encoder has different property names for zero-latency settings.
fn encoder_params(encoder: &str) -> &'static str {
    match encoder {
        "x264enc" => "tune=zerolatency speed-preset=ultrafast key-int-max=15",
        "nvh264enc" => "zerolatency=true preset=low-latency-hq rc-mode=cbr gop-size=15",
        "qsvh264enc" => "target-usage=balanced rate-control=cbr",
        "amfh264enc" => "rate-control=cbr target-usage=high-quality gop-size=15",
        "vtenc_h264" => "real-time=true",
        "vaapih264enc" => "rate-control=cbr",
        _ => "",
    }
}

pub fn build_pipeline(app: &AppHandle, config: &StreamConfig) -> String {
    let (width, height) = parse_resolution(&config.resolution);
    let ip = &config.target_ip;
    
    // Adaptive quality settings based on Mode
    // Video: High FPS (30/60), High Bitrate (6Mbps), low latency
    // Presentation: Medium FPS (20), Medium Bitrate (3Mbps), high clarity
    let (fps, bitrate) = match config.quality_mode.as_str() {
        "video" => (u32::max(config.fps, 30), u32::max(config.bitrate, 5000)),
        "presentation" => (20, 3000),
        _ => (config.fps, config.bitrate),
    };

    let encoder = if config.encoder_name.is_empty() {
        "x264enc"
    } else {
        &config.encoder_name
    };

    println!("[gst] Building pipeline mode={} encoder={} target={}:{} fps={} bitrate={}", 
             config.quality_mode, encoder, ip, 5000, fps, bitrate);

    // ── Video source: platform + mode aware ──────────────────────────────────
    #[cfg(target_os = "windows")]
    let (video_src, is_d3d11) = build_windows_video_src(app, config);

    #[cfg(not(target_os = "windows"))]
    let video_src = build_video_src(app, config);

    #[cfg(target_os = "windows")]
    let download_part = if is_d3d11 { "! queue ! d3d11download" } else { "! queue" };

    #[cfg(target_os = "windows")]
    let video_part = format!(
        "{video_src} {download_part} ! videoconvert ! videoscale ! \
         video/x-raw,format=NV12,width={width},height={height},framerate={fps}/1 ! queue ! \
         {encoder} bitrate={bitrate} {} ! \
         rtph264pay config-interval=1 ! queue ! udpsink host={ip} port=5000",
        encoder_params(encoder)
    );

    #[cfg(not(target_os = "windows"))]
    let video_part = format!(
        "{video_src} ! queue ! videoconvert ! videoscale ! videoconvert ! \
         video/x-raw,format=NV12,width={width},height={height},framerate={fps}/1 ! queue ! \
         {encoder} bitrate={bitrate} {} ! \
         rtph264pay config-interval=1 ! queue ! udpsink host={ip} port=5000",
        encoder_params(encoder)
    );

    // ── Audio source: platform aware ──────────────────────────────────────────
    let audio_part = build_audio_part(config, ip);

    // Combine parts with a space to ensure independent pipeline branches are correctly parsed
    let full_pipeline = format!("{} {}", video_part.trim(), audio_part.trim());

    let cleaned_pipeline = full_pipeline
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    println!("[gst] Final Pipeline: {}", cleaned_pipeline);

    cleaned_pipeline
}

// ── Video source selection ────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn build_windows_video_src(app: &AppHandle, config: &StreamConfig) -> (String, bool) {
    let (best_element, is_d3d11) = path_setup::get_best_windows_src(app);
    log::info!("[gst] Using Windows video source: {} (is_d3d11={})", best_element, is_d3d11);

    let idx = config.monitor_index.unwrap_or(0);

    let src = match best_element.as_str() {
        "d3d11screencapturesrc" => {
            if config.stream_mode == "window" {
                if let Some(hwnd) = config.window_id {
                    format!("{} window-handle={hwnd} show-cursor=false", best_element)
                } else {
                    format!("{} monitor-index={idx} show-cursor=false", best_element)
                }
            } else {
                format!("{} monitor-index={idx} show-cursor=false", best_element)
            }
        },
        "dx9screencapsrc" => {
            // dx9screencapsrc uses 'monitor' instead of 'monitor-index'
            // and 'cursor' instead of 'show-cursor'.
            // It does not support window-handle capture, so we fall back to monitor capture.
            if config.stream_mode == "window" {
                log::warn!("[gst] D3D11 not available. Falling back to dx9screencapsrc (monitor={idx}). Window capture is NOT supported in DX9 mode.");
            }
            format!("{} monitor={idx} cursor=false", best_element)
        },
        _ => {
            // gdiscreencapsrc (fallback) uses 'monitor' and 'cursor'
            // It also does not support window-handle capture.
            if config.stream_mode == "window" {
                log::warn!("[gst] D3D11 and DX9 not available. Falling back to gdiscreencapsrc (monitor={idx}). Window capture is NOT supported in GDI mode.");
            }
            format!("{} monitor={idx} cursor=false", best_element)
        }
    };

    (src, is_d3d11)
}

#[cfg(not(target_os = "windows"))]
fn build_video_src(_app: &AppHandle, _config: &StreamConfig) -> String {

    #[cfg(target_os = "macos")]
    {
        // avfvideosrc for full screen; no window mode on Mac (MVP)
        "avfvideosrc capture-screen=true".to_string()
    }

    #[cfg(target_os = "linux")]
    {
        let best_element = path_setup::get_best_linux_src(_app);
        let is_wayland = std::env::var("WAYLAND_DISPLAY").is_ok();
        
        match _config.stream_mode.as_str() {
            "window" => {
                if let Some(wid) = _config.window_id {
                    if is_wayland || best_element == "pipewiresrc" {
                        // Wayland window isolation prevents simple XID capture. Fallback to full screen picker.
                        log::warn!("[gst] Wayland/Pipewire window capture is experimental; falling back to full-screen (portal choice)");
                        format!("{best_element} ! videoconvert")
                    } else {
                        format!("{best_element} xid={wid} use-damage=false")
                    }
                } else {
                    if is_wayland || best_element == "pipewiresrc" {
                        format!("{best_element} ! videoconvert")
                    } else {
                        format!("{best_element} use-damage=false")
                    }
                }
            }
            _ => {
                if is_wayland || best_element == "pipewiresrc" {
                    format!("{best_element} ! videoconvert")
                } else {
                    format!("{best_element} use-damage=false")
                }
            }
        }
    }
}

// ── Audio source selection ────────────────────────────────────────────────────

#[allow(unreachable_code)]
fn build_audio_part(config: &StreamConfig, _ip: &str) -> String {
    if !config.audio_enabled {
        return String::new();
    }

    // P9: macOS — disable audio in MVP (no reliable loopback without extra setup)
    #[cfg(target_os = "macos")]
    {
        log::info!("[pipeline] Audio disabled on macOS (P9)");
        return String::new();
    }

    #[cfg(target_os = "windows")]
    {
        let device_arg = config
            .audio_device_id
            .as_ref()
            .filter(|id| !id.is_empty() && id.starts_with('{'))
            .map(|id| format!(" device=\"{}\"", id))
            .unwrap_or_default();

        format!(
            " wasapi2src loopback=true{} ! queue ! audioconvert ! audioresample ! \
             opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={} port=5002",
            device_arg, _ip
        )
    }

    #[cfg(target_os = "linux")]
    {
        // Check for PulseAudio or Pipewire-Pulse
        let pulse_running = std::process::Command::new("pactl")
            .arg("info")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if !pulse_running {
            log::warn!("[pipeline] PulseAudio source not available, streaming video-only");
            return String::new();
        }

        format!(
            " pulsesrc device=\"@DEFAULT_MONITOR@\" ! queue ! audioconvert ! audioresample ! \
             opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={_ip} port=5002"
        )
    }
}

// ── Resolution helper ─────────────────────────────────────────────────────────

fn parse_resolution(res: &str) -> (u32, u32) {
    match res {
        "1080p" => (1920, 1080),
        "720p"  => (1280, 720),
        "480p"  => (854, 480),
        _       => (1920, 1080),
    }
}
