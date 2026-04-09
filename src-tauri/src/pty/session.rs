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

        let mut cmd = CommandBuilder::new(command);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.cwd(cwd);

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
