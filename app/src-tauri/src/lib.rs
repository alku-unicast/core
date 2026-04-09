// UniCast — Tauri v2 Entry Point
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod gstreamer;
mod utils;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewWindow,
};
use commands::network::start_rtt_monitor;

#[cfg(target_os = "windows")]
use utils::capture_exclusion::exclude_from_capture;

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_path::init())
        .invoke_handler(tauri::generate_handler![
            // Encoder
            commands::encoder::detect_encoder,
            // Stream
            commands::stream::start_stream,
            commands::stream::stop_stream,
            commands::stream::switch_stream_mode,
            commands::stream::set_stream_volume,
            // System
            commands::windows::get_open_windows,
            commands::monitors::get_monitors,
            commands::audio::get_audio_devices,
            commands::audio::mute_system_audio,
            // Settings
            commands::settings::read_settings,
            commands::settings::write_settings,
            // Auth
            commands::auth::verify_pin,
            commands::auth::wake_pi_hdmi,
            // Network
            commands::network::get_network_quality,
            // Capture exclusion
            commands::capture::set_bar_capture_exclusion,
        ])
        .setup(|app| {
            // ── Streaming bar: apply WDA_EXCLUDEFROMCAPTURE (Windows) ────────
            #[cfg(target_os = "windows")]
            {
                if let Some(bar) = app.get_webview_window("streaming-bar") {
                    if let Ok(hwnd) = bar.hwnd() {
                        exclude_from_capture(hwnd.0 as isize);
                    }
                }
            }

            // ── macOS: streaming bar capture exclusion ──────────────────────
            #[cfg(target_os = "macos")]
            {
                use tauri::objc_id::Id;
                if let Some(bar) = app.get_webview_window("streaming-bar") {
                    let ns_window = bar.ns_window().unwrap();
                    unsafe {
                        let _: () = msg_send![ns_window as *mut _, setSharingType: 0i64];
                    }
                }
            }

            // ── System tray ─────────────────────────────────────────────────
            let handle = app.handle().clone();
            let quit = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "UniCast'ı Aç", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "⏹ Yayını Durdur", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &stop, &quit])?;

            TrayIconBuilder::new()
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .on_menu_event(move |_app, event| match event.id.as_ref() {
                    "quit" => {
                        utils::process::kill_gstreamer();
                        std::process::exit(0);
                    }
                    "show" => {
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "stop" => {
                        let _ = commands::stream::stop_stream_internal();
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // ── RTT monitor background thread ───────────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_rtt_monitor(app_handle).await;
            });

            // ── Scan for orphaned GStreamer processes on startup ─────────────
            utils::process::kill_gstreamer();

            Ok(())
        })
        // Clean up on window close
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    utils::process::kill_gstreamer();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
