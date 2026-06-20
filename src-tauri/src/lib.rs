// Twitch Farmer — Tauri shell
//
// Responsibilities:
//   * pick a free localhost port + random token, launch the Python backend
//     and supervise it (kill on exit)
//   * expose those to the front-end via the `backend_info` command
//   * system tray (show / hide / quit) with left-click to restore
//   * close-to-tray / start-in-tray driven by the saved config
//   * single-instance + autostart plugins

use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Child;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent, WindowEvent,
};

#[derive(Default)]
struct BackendState {
    port: u16,
    token: String,
    child: Mutex<Option<Child>>,
}

#[derive(Serialize, Clone)]
struct BackendInfo {
    port: u16,
    token: String,
}

#[tauri::command]
fn backend_info(state: tauri::State<BackendState>) -> BackendInfo {
    BackendInfo {
        port: state.port,
        token: state.token.clone(),
    }
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Open %APPDATA%\TwitchFarmer (config, logs, cookies) in Explorer.
#[tauri::command]
fn open_data_folder() {
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let p = PathBuf::from(appdata).join("TwitchFarmer");
        let _ = std::process::Command::new("explorer").arg(p).spawn();
    }
}

/// Run a downloaded installer silently, then relaunch the app, then quit.
/// The installer's NSIS pre-install hook closes this app + backend first.
#[tauri::command]
fn apply_update(app: tauri::AppHandle, installer: String) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.to_string_lossy().to_string();
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // sequential in cmd: install silently -> short wait -> relaunch the app
        let line = format!(
            "\"{}\" /S & ping -n 4 127.0.0.1 >nul & start \"\" \"{}\"",
            installer, exe_str
        );
        std::process::Command::new("cmd")
            .args(["/C", &line])
            .creation_flags(0x0000_0008 | 0x0800_0000) // DETACHED_PROCESS | CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    app.exit(0);
    Ok(())
}

// ----------------------------------------------------------------------- //
// helpers
// ----------------------------------------------------------------------- //
fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
        .unwrap_or(8917)
}

/// %APPDATA%/TwitchFarmer/config.json — read shell-relevant booleans without
/// pulling in a full JSON model. Returns `default` if the key is missing.
fn config_flag(key: &str, default: bool) -> bool {
    let Some(appdata) = std::env::var_os("APPDATA") else {
        return default;
    };
    let path = PathBuf::from(appdata)
        .join("TwitchFarmer")
        .join("config.json");
    let Ok(text) = std::fs::read_to_string(path) else {
        return default;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
        return default;
    };
    json.get("app")
        .and_then(|a| a.get(key))
        .and_then(|v| v.as_bool())
        .unwrap_or(default)
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn spawn_backend(app: &tauri::AppHandle, port: u16, token: &str) -> Option<Child> {
    use std::process::Command;

    let mut cmd: Command;
    if cfg!(debug_assertions) {
        // dev: run the source via the project venv interpreter
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let backend = manifest.parent().unwrap().join("backend");
        let python = backend.join(".venv/Scripts/python.exe");
        cmd = Command::new(python);
        cmd.arg("server.py").current_dir(&backend);
    } else {
        // release: the frozen sidecar lives next to resources
        let exe = app
            .path()
            .resource_dir()
            .ok()
            .map(|d| {
                d.join("backend-dist")
                    .join("twitch-farmer-backend")
                    .join("twitch-farmer-backend.exe")
            })
            .unwrap_or_else(|| PathBuf::from("twitch-farmer-backend.exe"));
        cmd = Command::new(exe);
    }
    cmd.arg("--port")
        .arg(port.to_string())
        .arg("--token")
        .arg(token);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => Some(child),
        Err(e) => {
            eprintln!("failed to spawn backend: {e}");
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let port = free_port();
    let token = uuid::Uuid::new_v4().to_string();

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(BackendState {
            port,
            token: token.clone(),
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            backend_info,
            show_main_window,
            apply_update,
            open_data_folder
        ])
        .setup(move |app| {
            let handle = app.handle().clone();

            // --- launch backend ---
            let child = spawn_backend(&handle, port, &token);
            *app.state::<BackendState>().child.lock().unwrap() = child;

            // --- system tray ---
            let show = MenuItemBuilder::with_id("show", "Show Twitch Farmer").build(app)?;
            let start = MenuItemBuilder::with_id("start", "Start farming").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "Stop farming").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &start, &stop, &quit])
                .build()?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Twitch Farmer")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    // forwarded to the front-end, which calls the engine control API
                    "start" => {
                        let _ = app.emit("tray-control", "start");
                    }
                    "stop" => {
                        let _ = app.emit("tray-control", "stop");
                    }
                    "quit" => app.exit(0),
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
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // --- start hidden if requested (config start_in_tray OR --minimized) ---
            let minimized_arg = std::env::args().any(|a| a == "--minimized");
            if config_flag("start_in_tray", false) || minimized_arg {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if config_flag("close_to_tray", true) {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            // minimize-to-tray: when the window is minimized, hide it to the tray
            WindowEvent::Resized(_) => {
                if config_flag("minimize_to_tray", true)
                    && window.is_minimized().unwrap_or(false)
                {
                    let _ = window.unminimize();
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) = app.state::<BackendState>().child.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
