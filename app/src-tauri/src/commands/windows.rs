use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: u64,
    pub title: String,
    #[serde(rename = "processName")]
    pub process_name: String,
}

#[tauri::command]
pub async fn get_open_windows() -> Result<Vec<WindowInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        tokio::task::spawn_blocking(enum_windows_win32)
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "macos")]
    {
        use core_graphics::window::{
            CGWindowListCopyWindowInfo, kCGWindowListOptionOnScreenOnly, 
            kCGWindowListExcludeDesktopElements,
        };
        use core_foundation::array::CFArray;
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::string::CFString;
        use core_foundation::number::CFNumber;
        use core_foundation::base::TCFType;

        let mut windows = Vec::new();

        unsafe {
            let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
            let array_ref = CGWindowListCopyWindowInfo(options, core_graphics::window::kCGNullWindowID);
            
            if !array_ref.is_null() {
                let array: CFArray<CFDictionary> = TCFType::wrap_under_get_rule(array_ref);
                
                for i in 0..array.len() {
                    let dict = array.get(i).unwrap();
                    
                    // Filter for window layer 0 (regular windows)
                    let layer_key = CFString::from_static_string("kCGWindowLayer");
                    let layer = dict.find(layer_key.as_CFTypeRef() as *const _);
                    if let Some(l) = layer {
                        let layer_num: CFNumber = TCFType::wrap_under_get_rule(l as *const _);
                        if let Some(ln) = layer_num.to_i64() {
                            if ln != 0 { continue; }
                        }
                    }

                    let id_key = CFString::from_static_string("kCGWindowNumber");
                    let title_key = CFString::from_static_string("kCGWindowName");
                    let owner_key = CFString::from_static_string("kCGWindowOwnerName");

                    let id_raw = dict.find(id_key.as_CFTypeRef() as *const _);
                    let title_raw = dict.find(title_key.as_CFTypeRef() as *const _);
                    let owner_raw = dict.find(owner_key.as_CFTypeRef() as *const _);

                    if let (Some(id_p), Some(owner_p)) = (id_raw, owner_raw) {
                        let id_num: CFNumber = TCFType::wrap_under_get_rule(id_p as *const _);
                        let owner_str: CFString = TCFType::wrap_under_get_rule(owner_p as *const _);
                        
                        let title = if let Some(t_p) = title_raw {
                            let t_str: CFString = TCFType::wrap_under_get_rule(t_p as *const _);
                            t_str.to_string()
                        } else {
                            String::new()
                        };

                        // Only include windows with titles or meaningful content
                        if !title.trim().is_empty() {
                            windows.push(WindowInfo {
                                id: id_num.to_i64().unwrap_or(0) as u64,
                                title: title,
                                process_name: owner_str.to_string(),
                            });
                        }
                    }
                }
            }
        }
        Ok(windows)
    }
    #[cfg(target_os = "linux")]
    {
        Ok(vec![]) // X11 XQueryTree — implemented separately if needed
    }
}

#[cfg(target_os = "windows")]
fn enum_windows_win32() -> Result<Vec<WindowInfo>, String> {
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextW, IsWindowVisible, GetWindowThreadProcessId,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    use std::sync::Mutex;

    let results: Arc<Mutex<Vec<WindowInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let results_ptr = results.clone();

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        use windows::Win32::Foundation::TRUE;
        let results = &*(lparam.0 as *const Arc<Mutex<Vec<WindowInfo>>>);

        if IsWindowVisible(hwnd).as_bool() {
            let mut title_buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, &mut title_buf);
            if len > 0 {
                let title = String::from_utf16_lossy(&title_buf[..len as usize]);
                if !title.is_empty() {
                    let mut pid = 0u32;
                    GetWindowThreadProcessId(hwnd, Some(&mut pid));

                    let process_name = get_process_name(pid);

                    results.lock().unwrap().push(WindowInfo {
                        id: hwnd.0 as u64,
                        title,
                        process_name,
                    });
                }
            }
        }
        TRUE
    }

    unsafe fn get_process_name(pid: u32) -> String {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if let Ok(h) = handle {
            let mut buf = [0u16; 260];
            let mut size = buf.len() as u32;
            if QueryFullProcessImageNameW(h, PROCESS_NAME_WIN32, windows::core::PWSTR(buf.as_mut_ptr()), &mut size).is_ok() {
                let path = String::from_utf16_lossy(&buf[..size as usize]);
                return std::path::Path::new(&path)
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();
            }
        }
        String::new()
    }

    unsafe {
        EnumWindows(
            Some(enum_proc),
            LPARAM(&results_ptr as *const _ as isize),
        )
        .map_err(|e| e.to_string())?;
    }

    drop(results_ptr);

    Ok(Arc::try_unwrap(results)
        .map_err(|_| "lock error")?
        .into_inner()
        .unwrap())
}


