use crate::state::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn spawn_agent(
    id: String,
    command: String,
    args: Vec<String>,
    cwd: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let session =
        crate::pty::session::PtySession::spawn(id.clone(), &command, &args, &cwd, cols, rows, app)?;

    state.sessions.lock().insert(id, session);
    Ok(())
}

#[tauri::command]
pub fn write_to_agent(id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("Agent {} not found", id))?;
    session.write(data.as_bytes())
}

#[tauri::command]
pub fn resize_agent(
    id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Agent {} not found", id))?;
    session.resize(cols, rows)
}

#[tauri::command]
pub fn kill_agent(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    if let Some(mut session) = sessions.remove(&id) {
        session.kill()?;
    }
    Ok(())
}
