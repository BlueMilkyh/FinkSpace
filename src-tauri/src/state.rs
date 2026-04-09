use parking_lot::Mutex;
use std::collections::HashMap;

use crate::pty::session::PtySession;

pub struct AppState {
    pub sessions: Mutex<HashMap<String, PtySession>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}
