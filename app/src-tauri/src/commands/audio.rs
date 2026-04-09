use serde::{Deserialize, Serialize};

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
        let arg = if mute { "1" } else { "0" };
        let ok = std::process::Command::new("pactl")
            .args(["set-sink-mute", "@DEFAULT_SINK@", arg])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        Ok(ok)
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
        endpoint
            .SetMute(mute, &GUID::zeroed())
            .map_err(|e| e.to_string())?;
        Ok(true)
    }
}
