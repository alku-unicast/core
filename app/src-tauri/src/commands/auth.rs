use std::net::UdpSocket;
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PinVerifyResult {
    pub success: bool,
    pub message: String,
    #[serde(rename = "attemptsRemaining")]
    pub attempts_remaining: Option<u8>,
}

/// Send PIN to Pi via UDP:5001 and wait for OK/FAIL response.
/// Protocol: send b"PIN:<pin>", receive b"OK" or b"FAIL:<attempts_remaining>"
///
/// NOTE: nonce is currently plain PIN. RSA signing will be added in a future phase.
#[tauri::command]
pub async fn verify_pin(
    target_ip: String,
    pin: String,
) -> Result<PinVerifyResult, String> {
    tokio::task::spawn_blocking(move || {
        let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| e.to_string())?;

        let addr = format!("{target_ip}:5001");
        let payload = format!("PIN:{pin}");
        socket
            .send_to(payload.as_bytes(), &addr)
            .map_err(|e| format!("Send failed: {e}"))?;

        let mut buf = [0u8; 64];
        let (len, _) = socket
            .recv_from(&mut buf)
            .map_err(|_| "Pi did not respond (timeout)".to_string())?;

        let response = std::str::from_utf8(&buf[..len]).unwrap_or("").trim();

        if response == "OK" {
            Ok(PinVerifyResult {
                success: true,
                message: "Authenticated".to_string(),
                attempts_remaining: None,
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
            })
        } else if response == "BUSY" {
            Ok(PinVerifyResult {
                success: false,
                message: "Room is currently busy.".to_string(),
                attempts_remaining: None,
            })
        } else {
            Ok(PinVerifyResult {
                success: false,
                message: "Unknown response from Pi.".to_string(),
                attempts_remaining: None,
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Signal Pi to wake HDMI (CEC power-on). Sends b"WAKE" to UDP:5001.
#[tauri::command]
pub async fn wake_pi_hdmi(target_ip: String) -> Result<bool, String> {
    tokio::task::spawn_blocking(move || {
        let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
        socket
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|e| e.to_string())?;

        let addr = format!("{target_ip}:5001");
        socket
            .send_to(b"WAKE", &addr)
            .map_err(|e| format!("Send failed: {e}"))?;

        let mut buf = [0u8; 16];
        let (len, _) = socket.recv_from(&mut buf).unwrap_or((0, addr.parse().unwrap()));
        let resp = std::str::from_utf8(&buf[..len]).unwrap_or("").trim();

        Ok(resp == "READY" || resp == "OK")
    })
    .await
    .map_err(|e| e.to_string())?
}
