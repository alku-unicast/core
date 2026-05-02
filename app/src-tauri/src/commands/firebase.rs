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
    let url = "https://unicast-8a705-default-rtdb.europe-west1.firebasedatabase.app/rooms.json";
    
    let client = reqwest::Client::new();
    let response = client.get(url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Firebase returned error status: {}", response.status()));
    }

    let rooms: HashMap<String, RawRoom> = response.json()
        .await
        .map_err(|e| format!("JSON parsing error: {}", e))?;

    Ok(rooms)
}
