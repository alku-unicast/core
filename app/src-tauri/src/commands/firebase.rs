use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RawRoom {
    pub name: Option<String>,
    pub floor: Option<String>,
    pub pi_ip: Option<String>,
    pub pi_status: Option<String>,
    pub last_seen: Option<u64>,
}

#[tauri::command]
pub async fn fetch_firebase_rooms() -> Result<HashMap<String, RawRoom>, String> {
    let api_key = "AIzaSyAOpBLf5BWV8YMERPMDiL50FMl8ogsUlyY";
    let auth_url = format!("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={}", api_key);
    let db_url = "https://unicast-8a705-default-rtdb.europe-west1.firebasedatabase.app/rooms.json";
    
    let client = reqwest::Client::new();

    // 1. Sign in anonymously to get a token
    let auth_body = serde_json::json!({
        "returnSecureToken": true
    });

    let auth_resp = client.post(&auth_url)
        .json(&auth_body)
        .send()
        .await
        .map_err(|e| format!("Auth request failed: {}", e))?;

    let auth_json: serde_json::Value = auth_resp.json()
        .await
        .map_err(|e| format!("Failed to parse auth JSON: {}", e))?;

    let id_token = auth_json["idToken"].as_str()
        .ok_or_else(|| "No idToken found in auth response".to_string())?;

    // 2. Fetch rooms using the token
    let response = client.get(format!("{}?auth={}", db_url, id_token))
        .send()
        .await
        .map_err(|e| format!("Database request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Firebase returned error status: {}", response.status()));
    }

    // Parse into a generic JSON Value first to handle 'null'
    let full_json: serde_json::Value = response.json()
        .await
        .map_err(|e| format!("JSON parsing error: {}", e))?;

    if full_json.is_null() {
        return Ok(HashMap::new());
    }

    // Try to convert Value to HashMap
    let rooms: HashMap<String, RawRoom> = serde_json::from_value(full_json)
        .map_err(|e| format!("Room structure mismatch: {}", e))?;

    Ok(rooms)
}
