use std::net::UdpSocket;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::AppHandle;
use serde::Serialize;

// Current target IP for RTT pings — updated by connection store
static TARGET_IP: std::sync::OnceLock<Arc<Mutex<Option<String>>>> =
    std::sync::OnceLock::new();

fn target_ip_store() -> &'static Arc<Mutex<Option<String>>> {
    TARGET_IP.get_or_init(|| Arc::new(Mutex::new(None)))
}

pub fn set_rtt_target(ip: Option<String>) {
    let mut guard = target_ip_store().lock().unwrap();
    *guard = ip;
}

#[derive(Debug, Serialize, Clone)]
pub struct NetworkQualityPayload {
    #[serde(rename = "rttMs")]
    pub rtt_ms: u32,
    pub quality: String,
}

fn quality_from_rtt(rtt_ms: u32) -> &'static str {
    match rtt_ms {
        0..=4    => "excellent",
        5..=19   => "good",
        20..=49  => "degraded",
        _        => "poor",
    }
}

/// Background loop: sends UDP ping to Pi:5005 every 2s, emits `stream-health` event.
pub async fn start_rtt_monitor(app: AppHandle) {
    loop {
        tokio::time::sleep(Duration::from_secs(2)).await;

        let ip = {
            let guard = target_ip_store().lock().unwrap();
            guard.clone()
        };

        let Some(ip) = ip else { continue };

        let payload = measure_rtt(&ip);

        let event_payload = match payload {
            Some(rtt_ms) => NetworkQualityPayload {
                quality: quality_from_rtt(rtt_ms).to_string(),
                rtt_ms,
            },
            None => NetworkQualityPayload {
                quality: "lost".to_string(),
                rtt_ms: 0,
            },
        };

        app.emit("stream-health", &event_payload).ok();
    }
}

fn measure_rtt(ip: &str) -> Option<u32> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket
        .set_read_timeout(Some(Duration::from_millis(500)))
        .ok()?;

    let addr = format!("{ip}:5005");
    let start = Instant::now();
    socket.send_to(b"PING", &addr).ok()?;

    let mut buf = [0u8; 8];
    socket.recv_from(&mut buf).ok()?;

    let elapsed = start.elapsed().as_millis() as u32;
    Some(elapsed)
}

/// One-shot RTT query (used by React if needed)
#[tauri::command]
pub async fn get_network_quality(target_ip: String) -> Result<NetworkQualityPayload, String> {
    let result = tokio::task::spawn_blocking(move || measure_rtt(&target_ip))
        .await
        .map_err(|e| e.to_string())?;

    Ok(match result {
        Some(rtt_ms) => NetworkQualityPayload {
            quality: quality_from_rtt(rtt_ms).to_string(),
            rtt_ms,
        },
        None => NetworkQualityPayload {
            quality: "lost".to_string(),
            rtt_ms: 0,
        },
    })
}
