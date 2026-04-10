use std::fs;
use std::path::{Path, PathBuf};

/// Resolve a `cd`-style path argument relative to a base directory.
/// Returns the canonical absolute path if it exists and is a directory.
#[tauri::command]
pub fn resolve_dir(base: String, input: String) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("Empty path".to_string());
    }

    // Expand a leading ~ to the user's home directory.
    let expanded: PathBuf = if let Some(stripped) = trimmed.strip_prefix("~") {
        let home = dirs::home_dir().ok_or_else(|| "No home directory".to_string())?;
        let rest = stripped.trim_start_matches(|c| c == '/' || c == '\\');
        if rest.is_empty() {
            home
        } else {
            home.join(rest)
        }
    } else {
        PathBuf::from(trimmed)
    };

    let candidate: PathBuf = if expanded.is_absolute() {
        expanded
    } else {
        let base_path = if base.is_empty() {
            std::env::current_dir().map_err(|e| e.to_string())?
        } else {
            PathBuf::from(&base)
        };
        base_path.join(expanded)
    };

    let canonical = std::fs::canonicalize(&candidate)
        .map_err(|e| format!("{}: {}", candidate.display(), e))?;

    if !canonical.is_dir() {
        return Err(format!("{} is not a directory", canonical.display()));
    }

    // Strip Windows extended-length prefix (\\?\) so the rest of the app sees a normal path.
    let s = canonical.to_string_lossy().to_string();
    let cleaned = s.strip_prefix(r"\\?\").unwrap_or(&s).to_string();
    Ok(cleaned)
}

/// Return the user's home directory as an absolute path.
#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "No home directory".to_string())
}

// ─── Swarm mailbox filesystem helpers ───────────────────────────────────
//
// These back the FinkSwarm filesystem-based coordination protocol. Each
// swarm creates a `<workDir>/.finkswarm/` tree with `outbox/`, `inbox/`,
// and per-agent brief files. Agents use their built-in Write tool to
// drop messages into the outbox; the manager polls it via `fs_drain_dir`
// and routes parsed messages to the right peers.

/// Create a directory and every missing parent.
#[tauri::command]
pub fn fs_make_dir_all(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("{}: {}", path, e))
}

/// Read a UTF-8 text file. Returns an empty string if the file does not
/// exist so callers can treat "missing" and "empty" the same way.
#[tauri::command]
pub fn fs_read_text(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(p).map_err(|e| format!("{}: {}", path, e))
}

/// Write `content` to `path`, creating any missing parent directories.
#[tauri::command]
pub fn fs_write_text(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("{}: {}", parent.display(), e))?;
        }
    }
    fs::write(&path, content).map_err(|e| format!("{}: {}", path, e))
}

#[derive(serde::Serialize)]
pub struct DrainedFile {
    pub name: String,
    pub content: String,
}

/// Atomically drain `.json` files from `dir`: read each file's contents,
/// delete it, and return the collected `{name, content}` entries sorted
/// by filename so timestamp-prefixed messages arrive in order.
///
/// Missing directories return an empty list (not an error) so the poller
/// can run before `fs_make_dir_all` has been called.
#[tauri::command]
pub fn fs_drain_dir(dir: String) -> Result<Vec<DrainedFile>, String> {
    let path = Path::new(&dir);
    if !path.exists() {
        return Ok(Vec::new());
    }
    let rd = fs::read_dir(path).map_err(|e| format!("{}: {}", dir, e))?;
    let mut entries: Vec<_> = rd
        .filter_map(|r| r.ok())
        .filter(|e| {
            e.file_type().map(|t| t.is_file()).unwrap_or(false)
                && e.path()
                    .extension()
                    .map(|ext| ext == "json")
                    .unwrap_or(false)
        })
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let mut out = Vec::new();
    for entry in entries {
        let p = entry.path();
        let content = match fs::read_to_string(&p) {
            Ok(s) => s,
            Err(_) => continue,
        };
        // Best-effort delete; if it fails we still emit the content once.
        let _ = fs::remove_file(&p);
        out.push(DrainedFile {
            name: entry.file_name().to_string_lossy().to_string(),
            content,
        });
    }
    Ok(out)
}

