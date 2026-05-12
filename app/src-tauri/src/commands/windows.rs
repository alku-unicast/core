use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: u64,
    pub title: String,
    #[serde(rename = "processName")]
    pub process_name: String,
    // macOS only: physical-pixel window bounds + screen size for videocrop
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub w: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<u32>,
    #[serde(rename = "screenW", skip_serializing_if = "Option::is_none")]
    pub screen_w: Option<u32>,
    #[serde(rename = "screenH", skip_serializing_if = "Option::is_none")]
    pub screen_h: Option<u32>,
}

// ── macOS CGWindowList FFI ────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod cg_ffi {
    use std::ffi::c_void;

    pub type CFTypeRef = *const c_void;
    pub type CFArrayRef = *const c_void;
    pub type CFDictionaryRef = *const c_void;
    pub type CFStringRef = *const c_void;
    pub type CFIndex = isize;

    #[repr(C)]
    #[derive(Default)]
    pub struct CGPoint { pub x: f64, pub y: f64 }
    #[repr(C)]
    #[derive(Default)]
    pub struct CGSize { pub width: f64, pub height: f64 }
    #[repr(C)]
    #[derive(Default)]
    pub struct CGRect { pub origin: CGPoint, pub size: CGSize }

    pub const CG_WINDOW_LIST_ON_SCREEN_ONLY: u32 = 1 << 0;
    pub const CG_WINDOW_LIST_EXCLUDE_DESKTOP: u32 = 1 << 4;
    pub const CF_STRING_ENCODING_UTF8: u32 = 0x08000100;
    pub const CF_NUMBER_SINT64_TYPE: i32 = 4;

    #[link(name = "CoreGraphics", kind = "framework")]
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        // CF string keys (global variables in CoreGraphics.framework)
        pub static kCGWindowName: CFStringRef;
        pub static kCGWindowOwnerName: CFStringRef;
        pub static kCGWindowLayer: CFStringRef;
        pub static kCGWindowBounds: CFStringRef;
        pub static kCGWindowNumber: CFStringRef;

        // Array / Dictionary helpers
        pub fn CFArrayGetCount(arr: CFArrayRef) -> CFIndex;
        pub fn CFArrayGetValueAtIndex(arr: CFArrayRef, idx: CFIndex) -> CFTypeRef;
        pub fn CFDictionaryGetValue(dict: CFDictionaryRef, key: CFTypeRef) -> CFTypeRef;

        // String helper
        pub fn CFStringGetCString(
            s: CFStringRef,
            buf: *mut u8,
            bufsize: CFIndex,
            encoding: u32,
        ) -> u8;

        // Number helper
        pub fn CFNumberGetValue(
            num: CFTypeRef,
            the_type: i32,
            value_ptr: *mut std::ffi::c_void,
        ) -> u8;

        // Rect helper
        pub fn CGRectMakeWithDictionaryRepresentation(
            dict: CFDictionaryRef,
            rect: *mut CGRect,
        ) -> u8;

        // Display helpers
        pub fn CGWindowListCopyWindowInfo(option: u32, relative: u32) -> CFArrayRef;
        pub fn CGMainDisplayID() -> u32;
        pub fn CGDisplayBounds(display: u32) -> CGRect;
        pub fn CFRelease(cf: CFTypeRef);
    }
}

#[cfg(target_os = "macos")]
fn enum_windows_macos() -> Result<Vec<WindowInfo>, String> {
    use cg_ffi::*;
    use std::ffi::c_void;

    unsafe {
        let main_display = CGMainDisplayID();
        // CGDisplayBounds returns logical points (independent of Retina scale).
        // avfvideosrc capture-screen=true also outputs at logical resolution,
        // so videocrop values must be in logical pixels — no scale factor needed.
        let screen_logical = CGDisplayBounds(main_display);

        let window_list = CGWindowListCopyWindowInfo(
            CG_WINDOW_LIST_ON_SCREEN_ONLY | CG_WINDOW_LIST_EXCLUDE_DESKTOP,
            0, // kCGNullWindowID
        );

        if window_list.is_null() {
            return Ok(vec![]);
        }

        let count = CFArrayGetCount(window_list);
        let mut windows = Vec::new();

        for i in 0..count {
            let dict = CFArrayGetValueAtIndex(window_list, i);
            if dict.is_null() {
                continue;
            }

            // Skip non-normal windows (layer != 0)
            let layer_val = CFDictionaryGetValue(dict, kCGWindowLayer);
            if layer_val.is_null() {
                continue;
            }
            let mut layer: i64 = 0;
            CFNumberGetValue(
                layer_val,
                CF_NUMBER_SINT64_TYPE,
                &mut layer as *mut i64 as *mut c_void,
            );
            if layer != 0 {
                continue;
            }

            // Title (kCGWindowName — null means app has no title / no Screen Recording access)
            let name_val = CFDictionaryGetValue(dict, kCGWindowName);
            if name_val.is_null() {
                continue;
            }
            let mut title_buf = [0u8; 512];
            if CFStringGetCString(name_val, title_buf.as_mut_ptr(), 512, CF_STRING_ENCODING_UTF8)
                == 0
            {
                continue;
            }
            let title = std::ffi::CStr::from_ptr(title_buf.as_ptr() as *const i8)
                .to_string_lossy()
                .into_owned();
            if title.is_empty() || title == "UniCast" {
                continue;
            }

            // Process / owner name
            let owner_val = CFDictionaryGetValue(dict, kCGWindowOwnerName);
            let process_name = if !owner_val.is_null() {
                let mut buf = [0u8; 256];
                if CFStringGetCString(
                    owner_val,
                    buf.as_mut_ptr(),
                    256,
                    CF_STRING_ENCODING_UTF8,
                ) != 0
                {
                    std::ffi::CStr::from_ptr(buf.as_ptr() as *const i8)
                        .to_string_lossy()
                        .into_owned()
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            // Window ID
            let id_val = CFDictionaryGetValue(dict, kCGWindowNumber);
            let mut wid: i64 = 0;
            if !id_val.is_null() {
                CFNumberGetValue(
                    id_val,
                    CF_NUMBER_SINT64_TYPE,
                    &mut wid as *mut i64 as *mut c_void,
                );
            }

            // Bounds (in logical points → convert to physical pixels)
            let bounds_val = CFDictionaryGetValue(dict, kCGWindowBounds);
            let mut rect = CGRect::default();
            if bounds_val.is_null()
                || CGRectMakeWithDictionaryRepresentation(bounds_val, &mut rect) == 0
            {
                continue;
            }

            // Skip windows outside the primary display — avfvideosrc only captures the
            // primary screen, so secondary-monitor windows would produce invalid videocrop values.
            if rect.origin.x < 0.0
                || rect.origin.y < 0.0
                || (rect.origin.x + rect.size.width) > screen_logical.size.width
                || (rect.origin.y + rect.size.height) > screen_logical.size.height
            {
                continue;
            }

            let (x, y, w, h) = (
                Some(rect.origin.x as i32),
                Some(rect.origin.y as i32),
                Some(rect.size.width as u32),
                Some(rect.size.height as u32),
            );

            windows.push(WindowInfo {
                id: wid as u64,
                title,
                process_name,
                x,
                y,
                w,
                h,
                screen_w: Some(screen_logical.size.width as u32),
                screen_h: Some(screen_logical.size.height as u32),
            });
        }

        CFRelease(window_list);
        Ok(windows)
    }
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
        tokio::task::spawn_blocking(enum_windows_macos)
            .await
            .map_err(|e| e.to_string())?
    }
    #[cfg(target_os = "linux")]
    {
        tokio::task::spawn_blocking(|| {
            use std::ptr;
            use std::ffi::CStr;
            use x11_dl::xlib;

            let mut windows = Vec::new();

            // 1. Load X11 library at runtime
            let lib_x11 = match xlib::Xlib::open() {
                Ok(x) => x,
                Err(e) => {
                    log::error!("[windows] Could not open X11 library: {}", e);
                    return Ok(vec![]);
                }
            };

            unsafe {
                let display = (lib_x11.XOpenDisplay)(ptr::null());
                if display.is_null() {
                    log::error!("[windows] Could not open X display");
                    return Ok(vec![]);
                }

                let root = (lib_x11.XDefaultRootWindow)(display);
                
                // 2. Get atoms
                let client_list_atom = (lib_x11.XInternAtom)(display, b"_NET_CLIENT_LIST\0".as_ptr() as *const i8, xlib::False);
                let utf8_string_atom = (lib_x11.XInternAtom)(display, b"UTF8_STRING\0".as_ptr() as *const i8, xlib::False);
                let net_wm_name_atom = (lib_x11.XInternAtom)(display, b"_NET_WM_NAME\0".as_ptr() as *const i8, xlib::False);

                if client_list_atom == 0 {
                    (lib_x11.XCloseDisplay)(display);
                    return Ok(vec![]);
                }

                let mut actual_type = 0;
                let mut actual_format = 0;
                let mut nitems = 0;
                let mut bytes_after = 0;
                let mut data_ptr: *mut u8 = ptr::null_mut();

                // 3. Query the property from the root window
                if (lib_x11.XGetWindowProperty)(
                    display, root, client_list_atom, 0, 1024, xlib::False, xlib::XA_WINDOW,
                    &mut actual_type, &mut actual_format, &mut nitems, &mut bytes_after, &mut data_ptr
                ) == 0 && !data_ptr.is_null() {
                    
                    let window_ids = std::slice::from_raw_parts(data_ptr as *const xlib::Window, nitems as usize);

                    for &window in window_ids {
                        // 4. Try to get UTF-8 name (_NET_WM_NAME)
                        let mut name_type = 0;
                        let mut name_format = 0;
                        let mut name_nitems = 0;
                        let mut name_bytes_after = 0;
                        let mut name_ptr: *mut u8 = ptr::null_mut();

                        let mut title = String::new();

                        if (lib_x11.XGetWindowProperty)(
                            display, window, net_wm_name_atom, 0, 1024, xlib::False, utf8_string_atom,
                            &mut name_type, &mut name_format, &mut name_nitems, &mut name_bytes_after, &mut name_ptr
                        ) == 0 && !name_ptr.is_null() {
                            title = CStr::from_ptr(name_ptr as *const i8).to_string_lossy().into_owned();
                            (lib_x11.XFree)(name_ptr as *mut _);
                        } else {
                            // Fallback to legacy XFetchName
                            let mut legacy_name_ptr: *mut i8 = ptr::null_mut();
                            if (lib_x11.XFetchName)(display, window, &mut legacy_name_ptr) != 0 && !legacy_name_ptr.is_null() {
                                title = CStr::from_ptr(legacy_name_ptr).to_string_lossy().into_owned();
                                (lib_x11.XFree)(legacy_name_ptr as *mut _);
                            }
                        }

                        if !title.is_empty() && title != "UniCast" {
                            windows.push(WindowInfo {
                                id: window as u64,
                                title,
                                process_name: "Linux App".to_string(),
                                x: None, y: None, w: None, h: None,
                                screen_w: None, screen_h: None,
                            });
                        }
                    }
                    (lib_x11.XFree)(data_ptr as *mut _);
                }
                (lib_x11.XCloseDisplay)(display);
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
                        x: None, y: None, w: None, h: None,
                        screen_w: None, screen_h: None,
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

