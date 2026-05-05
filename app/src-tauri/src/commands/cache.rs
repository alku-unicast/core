use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CachedRoom {
    pub id: String,
    pub label: String,
    pub floor: String,
    pub ip: String,
    pub status: String,
    #[serde(rename = "lastSeen")]
    pub last_seen: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RoomsCache {
    pub rooms: Vec<CachedRoom>,
    #[serde(rename = "lastUpdated")]
    pub last_updated: i64,
    pub version: u32,
}

fn cache_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("rooms_cache.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_rooms_cache(app: tauri::AppHandle) -> Result<Option<RoomsCache>, String> {
    let path = cache_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let contents = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Cache read error: {}", e))?;
    let cache: RoomsCache = serde_json::from_str(&contents)
        .map_err(|e| format!("Cache parse error: {}", e))?;
    Ok(Some(cache))
}

#[tauri::command]
pub async fn write_rooms_cache(app: tauri::AppHandle, cache: RoomsCache) -> Result<(), String> {
    let path = cache_path(&app)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Dir create error: {}", e))?;
    }
    let contents = serde_json::to_string(&cache).map_err(|e| e.to_string())?;
    tokio::fs::write(&path, contents)
        .await
        .map_err(|e| format!("Cache write error: {}", e))?;
    Ok(())
}
