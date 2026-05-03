use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Instant, Duration};
use tokio::sync::Mutex;

// Token Cache: (idToken, expiry_instant)
static TOKEN_CACHE: Mutex<Option<(String, Instant)>> = Mutex::const_new(None);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawRoom {
    pub name: Option<String>,
    pub floor: Option<String>,
    pub pi_ip: Option<String>,
    pub pi_status: Option<String>,
    pub last_seen: Option<serde_json::Value>, // Flexible type (seconds or null or "")
}

#[tauri::command]
pub async fn fetch_firebase_rooms() -> Result<HashMap<String, RawRoom>, String> {
    let api_key = "AIzaSyAOpBLf5BWV8YMERPMDiL50FMl8ogsUlyY";
    let db_url = "https://unicast-8a705-default-rtdb.europe-west1.firebasedatabase.app/rooms.json";
    
    // 1. Get or Refresh Token
    let mut cache = TOKEN_CACHE.lock().await;
    let id_token = if let Some((token, expiry)) = cache.as_ref() {
        if Instant::now() < *expiry {
            token.clone()
        } else {
            refresh_token(api_key).await?
        }
    } else {
        refresh_token(api_key).await?
    };
    
    // Update cache if we got a new one
    if cache.as_ref().map(|(t, _)| t != &id_token).unwrap_or(true) {
        *cache = Some((id_token.clone(), Instant::now() + Duration::from_secs(3000))); // 50 mins
    }
    drop(cache); // Release lock before DB request

    // 2. Fetch rooms using the token
    let client = reqwest::Client::new();
    let response = client.get(format!("{}?auth={}", db_url, id_token))
        .send()
        .await
        .map_err(|e| format!("Database request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Firebase returned error status: {}", response.status()));
    }

    // Capture raw text for diagnosis
    let body_text = response.text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;
    
    if body_text == "null" {
        return Ok(HashMap::new());
    }

    // Try to parse the string into HashMap
    let rooms: HashMap<String, RawRoom> = serde_json::from_str(&body_text)
        .map_err(|e| format!("JSON parsing error: {}. Body was: {}", e, body_text))?;

    Ok(rooms)
}

async fn refresh_token(api_key: &str) -> Result<String, String> {
    let auth_url = format!("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={}", api_key);
    let client = reqwest::Client::new();
    let auth_body = serde_json::json!({ "returnSecureToken": true });

    let auth_resp = client.post(&auth_url)
        .json(&auth_body)
        .send()
        .await
        .map_err(|e| format!("Auth request failed: {}", e))?;

    let auth_json: serde_json::Value = auth_resp.json()
        .await
        .map_err(|e| format!("Failed to parse auth JSON: {}", e))?;

    auth_json["idToken"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No idToken found in auth response".to_string())
}
