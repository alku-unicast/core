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
        tokio::task::spawn_blocking(get_audio_devices_windows)
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(get_audio_devices_macos)
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        Ok(vec![AudioDevice {
            id: "default".to_string(),
            name: "Default Audio Output".to_string(),
            is_default: true,
        }])
    }
}

/// Lists Core Audio input devices using system_profiler.
/// Includes built-in mic and any virtual devices (e.g. BlackHole).
#[cfg(target_os = "macos")]
fn get_audio_devices_macos() -> Result<Vec<AudioDevice>, String> {
    use std::process::Command;

    // system_profiler outputs JSON with audio device info
    let out = Command::new("system_profiler")
        .args(["SPAudioDataType", "-json"])
        .output()
        .map_err(|e| e.to_string())?;

    if !out.status.success() {
        return Ok(default_macos_audio());
    }

    let json: serde_json::Value =
        serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;

    let mut devices: Vec<AudioDevice> = Vec::new();

    // SPAudioDataType → array of items, each has "_items" array
    if let Some(items) = json
        .get("SPAudioDataType")
        .and_then(|v| v.as_array())
    {
        for section in items {
            if let Some(sub) = section.get("_items").and_then(|v| v.as_array()) {
                for dev in sub {
                    let name = dev
                        .get("_name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if name.is_empty() {
                        continue;
                    }
                    // Only include devices that have input capability
                    let has_input = dev
                        .get("coreaudio_input_source")
                        .or_else(|| dev.get("coreaudio_default_input_device"))
                        .is_some();
                    if !has_input {
                        continue;
                    }
                    let is_default = dev
                        .get("coreaudio_default_input_device")
                        .and_then(|v| v.as_str())
                        .map(|s| s == "spaudio_yes")
                        .unwrap_or(false);
                    // Use device name as id — osxaudiosrc accepts device name strings
                    devices.push(AudioDevice {
                        id: name.clone(),
                        name,
                        is_default,
                    });
                }
            }
        }
    }

    if devices.is_empty() {
        return Ok(default_macos_audio());
    }

    // Ensure exactly one default
    if !devices.iter().any(|d| d.is_default) {
        if let Some(d) = devices.first_mut() {
            d.is_default = true;
        }
    }

    Ok(devices)
}

#[cfg(target_os = "macos")]
fn default_macos_audio() -> Vec<AudioDevice> {
    vec![AudioDevice {
        id: "default".to_string(),
        name: "Default Microphone".to_string(),
        is_default: true,
    }]
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
            let current = endpoint.GetMasterVolumeLevelScalar().unwrap_or(1.0);
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
