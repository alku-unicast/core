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
        Ok(vec![]) // CGWindowList — implemented separately if needed
    }
    #[cfg(target_os = "linux")]
    {
        tokio::task::spawn_blocking(|| {
            use std::ptr;
            use std::ffi::CStr;
            use x11::xlib;

            let mut windows = Vec::new();

            unsafe {
                let display = xlib::XOpenDisplay(ptr::null());
                if display.is_null() {
                    log::error!("[windows] Could not open X display");
                    return Ok(vec![]);
                }

                let root = xlib::XDefaultRootWindow(display);
                let mut root_return = 0;
                let mut parent_return = 0;
                let mut children_return: *mut xlib::Window = ptr::null_mut();
                let mut nchildren_return = 0;

                if xlib::XQueryTree(display, root, &mut root_return, &mut parent_return, &mut children_return, &mut nchildren_return) != 0 {
                    let children = std::slice::from_raw_parts(children_return, nchildren_return as usize);
                    
                    for &window in children {
                        // Check if window is viewable/mapped
                        let mut attrs: xlib::XWindowAttributes = std::mem::zeroed();
                        if xlib::XGetWindowAttributes(display, window, &mut attrs) != 0 {
                            if attrs.map_state != xlib::IsViewable {
                                continue;
                            }
                        }

                        // Get window name
                        let mut name_ptr: *mut i8 = ptr::null_mut();
                        if xlib::XFetchName(display, window, &mut name_ptr) != 0 && !name_ptr.is_null() {
                            let name = CStr::from_ptr(name_ptr).to_string_lossy().into_owned();
                            xlib::XFree(name_ptr as *mut _);

                            if !name.is_empty() && name != "UniCast" {
                                windows.push(WindowInfo {
                                    id: window as u64,
                                    title: name,
                                    process_name: "X11 Window".to_string(),
                                });
                            }
                        }
                    }
                    xlib::XFree(children_return as *mut _);
                }
                xlib::XCloseDisplay(display);
            }

            Ok(windows)
        })
        .await
        .map_err(|e| e.to_string())?
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

    use std::sync::{Arc, Mutex};

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

