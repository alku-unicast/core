use serde::{Deserialize, Serialize};

#[cfg(target_os = "linux")]
static SAVED_LINUX_VOL: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(-1);

// Stores pre-mute Windows volume as f32 bits. u32::MAX = sentinel (not saved).
#[cfg(target_os = "windows")]
static SAVED_WIN_VOL: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(u32::MAX);

#[cfg(target_os = "linux")]
fn get_sink_volume_pct() -> u32 {
    let out = std::process::Command::new("pactl")
        .args(["get-sink-volume", "@DEFAULT_SINK@"])
        .output();
    if let Ok(o) = out {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout);
            for part in s.split('/') {
                let trimmed = part.trim();
                if let Some(stripped) = trimmed.strip_suffix('%') {
                    if let Ok(val) = stripped.trim().parse::<u32>() {
                        if val <= 150 { return val; }
                    }
                }
            }
        }
    }
    50 // safe fallback
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

#[tauri::command]
pub async fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    #[cfg(target_os = "windows")]
    {
        get_audio_devices_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec![AudioDevice {
            id: "default".to_string(),
            name: "Default Audio Output".to_string(),
            is_default: true,
        }])
    }
}

#[cfg(target_os = "windows")]
fn get_audio_devices_windows() -> Result<Vec<AudioDevice>, String> {
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
        DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CoInitialize, CLSCTX_ALL};


    unsafe {
        let _ = CoInitialize(None);

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| e.to_string())?;

        let collection = enumerator
            .EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| e.to_string())?;

        let count = collection.GetCount().map_err(|e| e.to_string())?;

        // Get default device ID for comparison
        let default_device = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .ok();
        let default_id = default_device
            .as_ref()
            .and_then(|d| d.GetId().ok())
            .map(|id| id.to_string().unwrap_or_default())
            .unwrap_or_default();

        let mut devices = Vec::new();
        for i in 0..count {
            let device = collection.Item(i).map_err(|e| e.to_string())?;
            let id_pwstr = device.GetId().map_err(|e| e.to_string())?;
            let id = id_pwstr.to_string().unwrap_or_default();

            // Get friendly name via property store
            let props = device
                .OpenPropertyStore(windows::Win32::System::Com::STGM_READ)
                .map_err(|e| e.to_string())?;

            let name_key = windows::Win32::UI::Shell::PropertiesSystem::PROPERTYKEY {
                fmtid: windows::core::GUID::from_u128(
                    0xa45c254e_df1a_4efd_8020_67d146a850e0,
                ),
                pid: 14, // PKEY_Device_FriendlyName
            };

            let name = props
                .GetValue(&name_key)
                .ok()
                .and_then(|v| {
                    let s = v.to_string();
                    if s.is_empty() { None } else { Some(s) }
                })
                .unwrap_or_else(|| format!("Device {i}"));

            devices.push(AudioDevice {
                is_default: id == default_id,
                id,
                name,
            });
        }

        Ok(devices)
    }
}

/// Mute / unmute the system's default audio output (laptop speakers).
/// Saves and restores the previous state.
#[tauri::command]
pub async fn mute_system_audio(mute: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        mute_system_audio_windows(mute)
    }
    #[cfg(target_os = "macos")]
    {
        let script = if mute {
            "osascript -e 'set volume output muted true'"
        } else {
            "osascript -e 'set volume output muted false'"
        };
        let ok = std::process::Command::new("sh")
            .arg("-c")
            .arg(script)
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        Ok(ok)
    }
    #[cfg(target_os = "linux")]
    {
        use std::sync::atomic::Ordering;
        // Volume-based approach: set-sink-volume 1% silences speakers while
        // keeping the monitor source signal intact (only full mute kills it).
        if mute {
            let current = get_sink_volume_pct();
            SAVED_LINUX_VOL.store(current as i32, Ordering::SeqCst);
            let _ = std::process::Command::new("pactl")
                .args(["set-sink-volume", "@DEFAULT_SINK@", "1%"])
                .status();
        } else {
            let saved = SAVED_LINUX_VOL.load(Ordering::SeqCst);
            let pct = if saved > 1 { saved as u32 } else { 50 };
            let _ = std::process::Command::new("pactl")
                .args(["set-sink-volume", "@DEFAULT_SINK@", &format!("{}%", pct)])
                .status();
        }
        Ok(true)
    }
}

#[cfg(target_os = "windows")]
fn mute_system_audio_windows(mute: bool) -> Result<bool, String> {
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::System::Com::{CoCreateInstance, CoInitialize, CLSCTX_ALL};
    use windows::core::GUID;
    use std::sync::atomic::Ordering;

    unsafe {
        let _ = CoInitialize(None);
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
                .map_err(|e| e.to_string())?;
        let device = enumerator
            .GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| e.to_string())?;
        let endpoint: IAudioEndpointVolume = device
            .Activate(CLSCTX_ALL, None)
            .map_err(|e| e.to_string())?;

        if mute {
            // Save current volume then set to ~1% — volume-based approach preserves
            // WASAPI loopback capture signal (SetMute kills it entirely).
            let mut current: f32 = 1.0;
            let _ = endpoint.GetMasterVolumeLevelScalar(&mut current);
            SAVED_WIN_VOL.store(current.to_bits(), Ordering::SeqCst);
            endpoint
                .SetMasterVolumeLevelScalar(0.01, &GUID::zeroed())
                .map_err(|e| e.to_string())?;
        } else {
            let saved_bits = SAVED_WIN_VOL.load(Ordering::SeqCst);
            let vol = if saved_bits == u32::MAX {
                1.0f32
            } else {
                f32::from_bits(saved_bits).clamp(0.01, 1.0)
            };
            endpoint
                .SetMasterVolumeLevelScalar(vol, &GUID::zeroed())
                .map_err(|e| e.to_string())?;
        }
        Ok(true)
    }
}
