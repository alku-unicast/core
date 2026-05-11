use std::net::UdpSocket;
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PinVerifyResult {
    pub success: bool,
    pub message: String,

    #[serde(rename = "attemptsRemaining")]
    pub attempts_remaining: Option<u8>,

    #[serde(rename = "sessionToken")]
    pub session_token: Option<String>,
}

#[tauri::command]
pub async fn verify_pin(
    target_ip: String,
    pin: String,
) -> Result<PinVerifyResult, String> {
    tokio::task::spawn_blocking(move || {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| e.to_string())?;

        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .map_err(|e| e.to_string())?;

        let addr = format!("{target_ip}:5001");
        let payload = format!("PIN:{pin}");

        println!("[auth] Sending PIN to {}", addr);

        let sent = socket
            .send_to(payload.as_bytes(), &addr)
            .map_err(|e| {
                println!("[auth] Send failed: {}", e);
                format!("Send failed: {e}")
            })?;

        println!("[auth] Sent {} bytes to {}", sent, addr);

        let mut buf = [0u8; 128];

        let (len, from) = socket
            .recv_from(&mut buf)
            .map_err(|e| {
                println!("[auth] No response from {}: {}", addr, e);
                "Pi did not respond (timeout)".to_string()
            })?;

        let response = std::str::from_utf8(&buf[..len])
            .unwrap_or("")
            .trim();

        println!("[auth] Pi response from {}: {}", from, response);

        if response.starts_with("OK") {
            let token = response
                .strip_prefix("OK:")
                .map(|t| t.to_string());

            Ok(PinVerifyResult {
                success: true,
                message: "Authenticated".to_string(),
                attempts_remaining: None,
                session_token: token,
            })
        } else if response.starts_with("FAIL:") {
            let remaining = response
                .trim_start_matches("FAIL:")
                .parse::<u8>()
                .unwrap_or(0);

            Ok(PinVerifyResult {
                success: false,
                message: format!("Wrong PIN. {remaining} attempts remaining."),
                attempts_remaining: Some(remaining),
                session_token: None,
            })
        } else if response == "BUSY" {
            Ok(PinVerifyResult {
                success: false,
                message: "Room is currently busy.".to_string(),
                attempts_remaining: None,
                session_token: None,
            })
        } else {
            Ok(PinVerifyResult {
                success: false,
                message: format!("Unknown response from Pi: {response}"),
                attempts_remaining: None,
                session_token: None,
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn wake_pi_hdmi(target_ip: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let socket = UdpSocket::bind("0.0.0.0:0")
            .map_err(|e| e.to_string())?;

        socket
            .set_read_timeout(Some(Duration::from_secs(8)))
            .map_err(|e| e.to_string())?;

        let addr = format!("{target_ip}:5001");

        socket
            .send_to(b"WAKE", &addr)
            .map_err(|e| format!("Send failed: {e}"))?;

        let mut buf = [0u8; 32];

        let (len, _) = socket.recv_from(&mut buf).unwrap_or((0, addr.parse().unwrap()));

        let resp = std::str::from_utf8(&buf[..len])
            .unwrap_or("")
            .trim();

        Ok(resp == "READY" || resp == "OK")
    })
    .await
    .map_err(|e| e.to_string())?
}