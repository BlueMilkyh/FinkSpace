mod commands;
mod pty;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::agent::spawn_agent,
            commands::agent::write_to_agent,
            commands::agent::resize_agent,
            commands::agent::kill_agent,
            commands::fs::resolve_dir,
            commands::fs::home_dir,
            commands::fs::fs_make_dir_all,
            commands::fs::fs_read_text,
            commands::fs::fs_write_text,
            commands::fs::fs_drain_dir,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // On Windows: hide native decorations (we draw our own title bar)
            #[cfg(target_os = "windows")]
            {
                window.set_decorations(false)?;
            }
            // On macOS: use transparent title bar with native traffic lights
            #[cfg(target_os = "macos")]
            {
                window.set_decorations(true)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
