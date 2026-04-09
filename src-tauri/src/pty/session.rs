use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::io::{Read, Write};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone)]
pub struct AgentOutput {
    pub id: String,
    pub data: String,
}

#[derive(Serialize, Clone)]
pub struct AgentExited {
    pub id: String,
    pub code: Option<u32>,
}

pub struct PtySession {
    master_writer: Box<dyn Write + Send>,
    master_for_resize: Box<dyn MasterPty + Send>,
    _reader_handle: JoinHandle<()>,
    child: Box<dyn portable_pty::Child + Send>,
}

impl PtySession {
    pub fn spawn(
        id: String,
        command: &str,
        args: &[String],
        cwd: &str,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<Self, String> {
        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // On macOS, GUI apps don't inherit the user's shell PATH.
        // Resolve the full path for commands that aren't absolute paths.
        let resolved_command = if !command.starts_with('/') && !command.starts_with('\\') {
            resolve_command_path(command).unwrap_or_else(|| command.to_string())
        } else {
            command.to_string()
        };

        let mut cmd = CommandBuilder::new(&resolved_command);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.cwd(cwd);

        // On macOS/Linux, enrich PATH so child processes also find tools
        #[cfg(not(target_os = "windows"))]
        {
            if let Some(enriched) = get_enriched_path() {
                cmd.env("PATH", enriched);
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        // Drop slave - we only need the master side
        drop(pair.slave);

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let reader_id = id.clone();
        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let encoded =
                            base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ = app.emit(
                            "agent-output",
                            AgentOutput {
                                id: reader_id.clone(),
                                data: encoded,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
            let _ = app.emit(
                "agent-exited",
                AgentExited {
                    id: reader_id.clone(),
                    code: None,
                },
            );
        });

        Ok(PtySession {
            master_writer: writer,
            master_for_resize: pair.master,
            _reader_handle: reader_handle,
            child,
        })
    }

    pub fn write(&mut self, data: &[u8]) -> Result<(), String> {
        self.master_writer
            .write_all(data)
            .map_err(|e| format!("Write failed: {}", e))?;
        self.master_writer
            .flush()
            .map_err(|e| format!("Flush failed: {}", e))?;
        Ok(())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master_for_resize
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize failed: {}", e))
    }

    pub fn kill(&mut self) -> Result<(), String> {
        self.child
            .kill()
            .map_err(|e| format!("Kill failed: {}", e))
    }
}

/// Build an enriched PATH that includes common user-local bin directories.
/// macOS GUI apps typically only have /usr/bin:/bin:/usr/sbin:/sbin.
#[cfg(not(target_os = "windows"))]
fn get_enriched_path() -> Option<String> {
    let home = std::env::var("HOME").ok()?;
    let base_path = std::env::var("PATH").unwrap_or_default();

    let extra_dirs = [
        format!("{home}/.local/bin"),
        format!("{home}/.npm-global/bin"),
        format!("{home}/.nvm/current/bin"),
        format!("{home}/.volta/bin"),
        format!("{home}/.cargo/bin"),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
    ];

    let mut parts: Vec<&str> = Vec::new();
    for dir in &extra_dirs {
        if !base_path.contains(dir.as_str()) && std::path::Path::new(dir).exists() {
            parts.push(dir);
        }
    }

    if parts.is_empty() {
        return None;
    }

    parts.push(&base_path);
    Some(parts.join(":"))
}

/// Try to find the full path of a command by checking enriched PATH dirs,
/// then falling back to `which` via the user's login shell.
fn resolve_command_path(command: &str) -> Option<String> {
    // First check enriched dirs directly
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let search_dirs = [
            format!("{home}/.local/bin"),
            format!("{home}/.npm-global/bin"),
            format!("{home}/.nvm/current/bin"),
            format!("{home}/.volta/bin"),
            format!("{home}/.cargo/bin"),
            "/usr/local/bin".to_string(),
            "/opt/homebrew/bin".to_string(),
        ];

        for dir in &search_dirs {
            let candidate = format!("{dir}/{command}");
            if std::path::Path::new(&candidate).exists() {
                return Some(candidate);
            }
        }

        // Fallback: ask the user's login shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        if let Ok(output) = std::process::Command::new(&shell)
            .args(["-l", "-c", &format!("which {command}")])
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, `where` can find commands
        if let Ok(output) = std::process::Command::new("where")
            .arg(command)
            .output()
        {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout);
                if let Some(first_line) = path.lines().next() {
                    let p = first_line.trim().to_string();
                    if !p.is_empty() {
                        return Some(p);
                    }
                }
            }
        }
    }

    None
}
