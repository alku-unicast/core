use crate::commands::stream::StreamConfig;

pub fn build_pipeline(config: &StreamConfig) -> String {
    let (width, height) = parse_resolution(&config.resolution);
    let ip = &config.target_ip;
    let fps = config.fps;
    let bitrate = config.bitrate;
    let encoder = if config.encoder_name.is_empty() {
        "x264enc"
    } else {
        &config.encoder_name
    };

    // Video Hattı: CMD'de çalışan halinin aynısı + stabilite için 'queue'lar eklendi
    let video_part = format!(
        "d3d11screencapturesrc monitor-index=0 ! queue ! videoconvert ! \
         video/x-raw,width={},height={},framerate={}/1 ! queue ! \
         {} bitrate={} tune=zerolatency speed-preset=superfast ! \
         rtph264pay config-interval=1 ! queue ! udpsink host={} port=5000",
        width, height, fps, encoder, bitrate, ip
    );

    let audio_part = if config.audio_enabled {
        format!(
            " wasapi2src loopback=true ! queue ! audioconvert ! audioresample ! \
                 opusenc bitrate=128000 ! rtpopuspay ! queue ! udpsink host={} port=5002",
            ip
        )
    } else {
        String::new()
    };

    let full_pipeline = format!("{}{}", video_part, audio_part);

    // Temizlik: Çift boşlukları tek boşluğa düşür
    full_pipeline
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
}

fn parse_resolution(res: &str) -> (u32, u32) {
    match res {
        "1080p" => (1920, 1080),
        "720p" => (1280, 720),
        "480p" => (854, 480),
        _ => (1920, 1080),
    }
}
