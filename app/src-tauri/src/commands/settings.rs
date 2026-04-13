use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    pub version: u32,
    pub language: String,
    pub favorites: Vec<String>,
    pub profiles: ProfileSettings,
    pub audio: AudioSettings,
    pub encoder: EncoderSettings,
    pub appearance: AppearanceSettings,
    #[serde(rename = "streamingBar")]
    pub streaming_bar: StreamingBarSettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileSettings {
    pub presentation: StreamProfile,
    pub video: StreamProfile,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamProfile {
    pub resolution: String,
    pub fps: u32,
    pub bitrate: u32,
    #[serde(rename = "delayBufferMs")]
    pub delay_buffer_ms: u32,
    #[serde(rename = "audioEnabled")]
    pub audio_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioSettings {
    #[serde(rename = "deviceId")]
    pub device_id: Option<String>,
    #[serde(rename = "muteLocal")]
    pub mute_local: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EncoderSettings {
    pub detected: Option<String>,
    #[serde(rename = "lastScan")]
    pub last_scan: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppearanceSettings {
    #[serde(rename = "mainTheme")]
    pub main_theme: String,
    #[serde(rename = "barTheme")]
    pub bar_theme: String,
    #[serde(rename = "barOpacity")]
    pub bar_opacity: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamingBarSettings {
    pub enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 2,
            language: "tr".to_string(),
            favorites: vec![],
            profiles: ProfileSettings {
                presentation: StreamProfile {
                    resolution: "1080p".to_string(),
                    fps: 15,
                    bitrate: 5000,
                    delay_buffer_ms: 60,
                    audio_enabled: false,
                },
                video: StreamProfile {
                    resolution: "1080p".to_string(),
                    fps: 30,
                    bitrate: 4000,
                    delay_buffer_ms: 74,
                    audio_enabled: true,
                },
            },
            audio: AudioSettings {
                device_id: None,
                mute_local: true,
            },
            encoder: EncoderSettings {
                detected: None,
                last_scan: None,
            },
            appearance: AppearanceSettings {
                main_theme: "light".to_string(),
                bar_theme: "translucent-dark".to_string(),
                bar_opacity: 0.9,
            },
            streaming_bar: StreamingBarSettings { enabled: true },
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("settings.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let path = settings_path(&app)?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_settings(app: tauri::AppHandle, settings: Settings) -> Result<bool, String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(true)
}
