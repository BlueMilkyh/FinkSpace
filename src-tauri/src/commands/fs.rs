use std::path::PathBuf;

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

