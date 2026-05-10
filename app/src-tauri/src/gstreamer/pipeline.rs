use crate::commands::stream::StreamConfig;

// ── Encoder-specific GStreamer parameters ─────────────────────────────────
fn encoder_params(encoder: &str) -> &'static str {
    match encoder {
        "x264enc" => "tune=zerolatency speed-preset=ultrafast key-int-max=15 intra-refresh=true",
        "nvh264enc" => "zerolatency=true preset=low-latency-hq rc-mode=cbr gop-size=15",
        "qsvh264enc" => "target-usage=balanced rate-control=cbr",
        "amfh264enc" => "rate-control=cbr target-usage=high-quality gop-size=15",
        "vtenc_h264" => "real-time=true",
        "vaapih264enc" => "rate-control=cbr",
        _ => "",
    }
}

pub fn build_pipeline(config: &StreamConfig) -> String {
    let (width, height) = parse_resolution(&config.resolution);
    let ip = &config.target_ip;

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

    println!(
        "[gst] Building pipeline mode={} encoder={} target={}:{} fps={} bitrate={}",
        config.quality_mode, encoder, ip, 5000, fps, bitrate
    );

    let video_src = build_video_src(config);

    #[cfg(target_os = "windows")]
    let video_part = format!(
        "{video_src} ! queue ! d3d11download ! videoconvert ! videoscale ! \
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

    let audio_part = build_audio_part(config, ip);

    let full_pipeline = format!("{} {}", video_part.trim(), audio_part.trim());

    let cleaned_pipeline = full_pipeline
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    println!("[gst] Final Pipeline: {}", cleaned_pipeline);

    cleaned_pipeline
}

fn build_video_src(config: &StreamConfig) -> String {
    #[cfg(target_os = "windows")]
    {
        match config.stream_mode.as_str() {
            "window" => {
                if let Some(hwnd) = config.window_id {
                    format!("d3d11screencapturesrc window-handle={hwnd} show-cursor=false")
                } else {
                    let idx = config.monitor_index.unwrap_or(0);
                    format!("d3d11screencapturesrc monitor-index={idx} show-cursor=false")
                }
            }
            _ => {
                let idx = config.monitor_index.unwrap_or(0);
                format!("d3d11screencapturesrc monitor-index={idx} show-cursor=false")
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // screencapturekitsrc senin GStreamer paketinde yok.
        // Bu yüzden macOS için avfvideosrc kullanıyoruz.
        // window mode şimdilik screen capture'a düşer.
        match config.stream_mode.as_str() {
            "window" => "avfvideosrc capture-screen=true".to_string(),
            _ => "avfvideosrc capture-screen=true".to_string(),
        }
    }

    #[cfg(target_os = "linux")]
    {
        match config.stream_mode.as_str() {
            "window" => {
                if let Some(wid) = config.window_id {
                    format!("ximagesrc xid={wid} use-damage=false")
                } else {
                    "ximagesrc use-damage=false".to_string()
                }
            }
            _ => "ximagesrc use-damage=false".to_string(),
        }
    }
}

#[allow(unreachable_code)]
fn build_audio_part(config: &StreamConfig, ip: &str) -> String {
    let _ = ip;

    if !config.audio_enabled {
        return String::new();
    }

    #[cfg(target_os = "macos")]
    {
        // screencapturekitsrc bulunmadığı için macOS audio branch'i şimdilik kapalı.
        // Önce video stream'i doğrulayalım.
        String::new()
    }

    #[cfg(target_os = "windows")]
    {
        let device_arg = config
            .audio_device_id
            .as_ref()
            .filter(|id| !id.is_empty())
            .map(|id| format!(" device={}", id))
            .unwrap_or_default();

        format!(
            " wasapi2src loopback=true{} ! queue ! audioconvert ! audioresample ! \
             opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={} port=5002",
            device_arg, ip
        )
    }

    #[cfg(target_os = "linux")]
    {
        format!(
            " pulsesrc device=\"@DEFAULT_MONITOR@\" ! queue ! audioconvert ! audioresample ! \
             opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={ip} port=5002"
        )
    }
}

fn parse_resolution(res: &str) -> (u32, u32) {
    match res {
        "1080p" => (1920, 1080),
        "720p" => (1280, 720),
        "480p" => (854, 480),
        _ => (1920, 1080),
    }
}