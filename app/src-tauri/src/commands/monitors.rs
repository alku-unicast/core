use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub index: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
    #[serde(rename = "isPrimary")]
    pub is_primary: bool,
}

#[tauri::command]
pub async fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(enum_monitors_win32)
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Fallback: single monitor
        Ok(vec![MonitorInfo {
            index: 0,
            name: "Primary Display".to_string(),
            width: 1920,
            height: 1080,
            is_primary: true,
        }])
    }
}

#[cfg(target_os = "windows")]
fn enum_monitors_win32() -> Result<Vec<MonitorInfo>, String> {
    use windows::Win32::Foundation::{BOOL, LPARAM, RECT};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFOEXW,
    };
    use std::sync::{Arc, Mutex};

    let monitors: Arc<Mutex<Vec<MonitorInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let monitors_ptr = monitors.clone();

    unsafe extern "system" fn monitor_proc(
        hmon: HMONITOR,
        _hdc: HDC,
        _lprect: *mut RECT,
        lparam: LPARAM,
    ) -> BOOL {
        use windows::Win32::Foundation::TRUE;
        let monitors = &*(lparam.0 as *const Arc<Mutex<Vec<MonitorInfo>>>);

        let mut info = MONITORINFOEXW::default();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;

        if GetMonitorInfoW(hmon, &mut info.monitorInfo as *mut _ as *mut _).as_bool() {
            let rc = info.monitorInfo.rcMonitor;
            let width = (rc.right - rc.left) as u32;
            let height = (rc.bottom - rc.top) as u32;
            let is_primary = info.monitorInfo.dwFlags & 1 != 0;
            let name = String::from_utf16_lossy(
                &info.szDevice[..info.szDevice.iter().position(|&c| c == 0).unwrap_or(32)],
            );

            let mut list = monitors.lock().unwrap();
            let index = list.len() as u32;
            list.push(MonitorInfo {
                index,
                name,
                width,
                height,
                is_primary,
            });
        }
        TRUE
    }

    unsafe {
        let _ = EnumDisplayMonitors(
            HDC::default(),
            None,
            Some(monitor_proc),
            LPARAM(&monitors_ptr as *const _ as isize),
        );
    }

    drop(monitors_ptr);

    Ok(Arc::try_unwrap(monitors)
        .map_err(|_| "lock error")?
        .into_inner()
        .unwrap())
}
