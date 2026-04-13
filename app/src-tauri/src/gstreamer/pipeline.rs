use crate::commands::stream::StreamConfig;

pub fn build_pipeline(config: &StreamConfig) -> String {
    let (width, height) = parse_resolution(&config.resolution);
    let ip = &config.target_ip;
    
    // ── Quality Parameters ───────────────────────────────────────────────────
    let fps = config.fps;
    let bitrate = config.bitrate;

    let encoder = if config.encoder_name.is_empty() {
        "x264enc"
    } else {
        &config.encoder_name
    };

    // ── Video source: platform + mode aware ──────────────────────────────────
    let video_src = build_video_src(config);

    let encoder_params = match encoder {
        "x264enc" => "tune=zerolatency speed-preset=superfast key-int-max=15 intra-refresh=true",
        "nvh264enc" => "zerolatency=true gop-size=15",
        _ => "",
    };

    #[cfg(target_os = "windows")]
    let video_part = format!(
        "{video_src} ! queue ! d3d11download ! videoconvert ! videoscale ! \
         video/x-raw,format=NV12,width={width},height={height},framerate={fps}/1 ! queue ! \
         {encoder} bitrate={bitrate} {encoder_params} ! \
         rtph264pay config-interval=1 ! queue ! udpsink host={ip} port=5000"
    );

    #[cfg(not(target_os = "windows"))]
    let video_part = format!(
        "{video_src} ! queue ! videoconvert ! videoscale ! videoconvert ! \
         video/x-raw,format=NV12,width={width},height={height},framerate={fps}/1 ! queue ! \
         {encoder} bitrate={bitrate} {encoder_params} ! \
         rtph264pay config-interval=1 ! queue ! udpsink host={ip} port=5000"
    );

    // ── Audio source: platform aware (P9 — Mac has no WASAPI) ────────────────
    let audio_part = build_audio_part(config, ip);

    let full_pipeline = format!("{video_part}{audio_part}");

    // Normalise whitespace (collapse double spaces from format! fragments)
    full_pipeline
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

// ── Video source selection ────────────────────────────────────────────────────

fn build_video_src(config: &StreamConfig) -> String {
    #[cfg(target_os = "windows")]
    {
        match config.stream_mode.as_str() {
            "window" => {
                // C3: Window capture — pass HWND from get_open_windows
                if let Some(hwnd) = config.window_id {
                    format!("d3d11screencapturesrc window-handle={hwnd} show-cursor=false")
                } else {
                    // Fallback: full primary monitor
                    let idx = config.monitor_index.unwrap_or(0);
                    format!("d3d11screencapturesrc monitor-index={idx} show-cursor=false")
                }
            }
            _ => {
                // fullscreen
                let idx = config.monitor_index.unwrap_or(0);
                format!("d3d11screencapturesrc monitor-index={idx} show-cursor=false")
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // avfvideosrc for full screen; no window mode on Mac (MVP)
        "avfvideosrc capture-screen=true".to_string()
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

// ── Audio source selection ────────────────────────────────────────────────────

#[allow(unreachable_code)]
fn build_audio_part(config: &StreamConfig, ip: &str) -> String {
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
        format!(
            " wasapi2src loopback=true ! queue ! audioconvert ! audioresample ! \
             opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={ip} port=5002"
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

// ── Resolution helper ─────────────────────────────────────────────────────────

fn parse_resolution(res: &str) -> (u32, u32) {
    match res {
        "1080p" => (1920, 1080),
        "720p"  => (1280, 720),
        "480p"  => (854, 480),
        _       => (1920, 1080),
    }
}
