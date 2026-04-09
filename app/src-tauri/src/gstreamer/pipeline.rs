use crate::commands::stream::StreamConfig;

/// Build the gst-launch-1.0 pipeline string from StreamConfig.
/// Matches the pipeline used in Python test scripts.
pub fn build_pipeline(config: &StreamConfig) -> String {
    let (width, height) = parse_resolution(&config.resolution);
    let ip = &config.target_ip;
    let fps = config.fps;
    let bitrate = config.bitrate;
    let encoder = &config.encoder_name;
    let delay = config.delay_buffer_ms;

    let video_src = build_video_src(config, width, height, fps);
    let audio_part = if config.audio_enabled {
        build_audio_part(config, ip, delay)
    } else {
        String::new()
    };

    format!(
        "{video_src} \
         ! {encoder} tune=zerolatency bitrate={bitrate} speed-preset=superfast key-int-max={fps} \
         ! rtph264pay config-interval=1 pt=96 \
         ! udpsink host={ip} port=5000 \
         {audio_part}"
    )
}

fn parse_resolution(res: &str) -> (u32, u32) {
    match res {
        "1080p" => (1920, 1080),
        "720p"  => (1280, 720),
        "480p"  => (854, 480),
        _       => (1920, 1080),
    }
}

fn build_video_src(config: &StreamConfig, width: u32, height: u32, fps: u32) -> String {
    match config.stream_mode.as_str() {
        "window" => {
            #[cfg(target_os = "windows")]
            if let Some(hwnd) = config.window_id {
                return format!(
                    "d3d11screencapturesrc window-handle={hwnd} \
                     ! videoconvert ! video/x-raw,format=I420,width={width},height={height},framerate={fps}/1"
                );
            }
            // Fallback to fullscreen
            build_fullscreen_src(config, width, height, fps)
        }
        _ => build_fullscreen_src(config, width, height, fps),
    }
}

fn build_fullscreen_src(config: &StreamConfig, width: u32, height: u32, fps: u32) -> String {
    let monitor_idx = config.monitor_index.unwrap_or(0);

    #[cfg(target_os = "windows")]
    return format!(
        "d3d11screencapturesrc monitor-index={monitor_idx} \
         ! videoconvert ! video/x-raw,format=I420,width={width},height={height},framerate={fps}/1"
    );

    #[cfg(target_os = "macos")]
    return format!(
        "avfvideosrc capture-screen=true \
         ! videoconvert ! video/x-raw,format=I420,width={width},height={height},framerate={fps}/1"
    );

    #[cfg(target_os = "linux")]
    {
        // Auto-detect Wayland vs X11
        let is_wayland = std::env::var("XDG_SESSION_TYPE")
            .map(|v| v == "wayland")
            .unwrap_or(false);
        if is_wayland {
            format!(
                "pipewiresrc \
                 ! videoconvert ! video/x-raw,format=I420,width={width},height={height},framerate={fps}/1"
            )
        } else {
            format!(
                "ximagesrc screen-num={monitor_idx} \
                 ! videoconvert ! video/x-raw,format=I420,width={width},height={height},framerate={fps}/1"
            )
        }
    }
}

fn build_audio_part(config: &StreamConfig, ip: &str, delay_ms: u32) -> String {
    let device_clause = config
        .audio_device_id
        .as_deref()
        .map(|id| format!("device=\"{id}\""))
        .unwrap_or_default();

    #[cfg(target_os = "windows")]
    return format!(
        "wasapi2src loopback=true {device_clause} \
         ! audioconvert ! audioresample \
         ! opusenc bitrate=128000 \
         ! rtpopuspay \
         ! udpsink host={ip} port=5002"
    );

    #[cfg(target_os = "macos")]
    return String::new(); // No system audio on macOS MVP

    #[cfg(target_os = "linux")]
    return format!(
        "pulsesrc {device_clause} \
         ! audioconvert ! audioresample \
         ! opusenc bitrate=128000 \
         ! rtpopuspay \
         ! udpsink host={ip} port=5002"
    );
}
