import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import {
  spawnAgent,
  writeToAgent,
  resizeAgent,
  onAgentOutput,
  onAgentExited,
} from "./tauri-bridge";
import { useWorkspaceStore } from "../stores/workspace-store";
import { getTerminalTheme, type AppTheme } from "../hooks/useTheme";
import { isMac } from "./platform";

interface ManagedTerminal {
  terminal: Terminal;
  fitAddon: FitAddon;
  container: HTMLDivElement | null;
  resizeObserver: ResizeObserver | null;
  unlistenOutput: (() => void) | null;
  unlistenExited: (() => void) | null;
  onDataDisposable: { dispose: () => void } | null;
  spawned: boolean;
}

const terminals = new Map<string, ManagedTerminal>();

/** Get or create a Terminal instance for the given agentId */
export function getOrCreateTerminal(
  agentId: string,
  _command: string,
  _args: string[],
  _cwd: string,
  color: string,
  theme: AppTheme,
): ManagedTerminal {
  const existing = terminals.get(agentId);
  if (existing) return existing;

  const termTheme = getTerminalTheme(theme);
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 1.2,
    theme: {
      background: termTheme.background,
      foreground: termTheme.foreground,
      cursor: color,
      selectionBackground: termTheme.selectionBackground,
      black: termTheme.black,
      red: "#e74c3c",
      green: "#2ecc71",
      yellow: "#f1c40f",
      blue: "#3498db",
      magenta: "#9b59b6",
      cyan: "#00bcd4",
      white: termTheme.foreground,
      brightBlack: "#555555",
      brightRed: "#ff6b6b",
      brightGreen: "#69db7c",
      brightYellow: "#ffd43b",
      brightBlue: "#74c0fc",
      brightMagenta: "#da77f2",
      brightCyan: "#3bc9db",
      brightWhite: "#ffffff",
    },
  });

  // Let app-level shortcuts pass through
  terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
    const mod = isMac() ? e.metaKey : e.ctrlKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (["t", "n", "w", "k", "d", ","].includes(key)) return false;
      if (/^[1-9]$/.test(key)) return false;
      if (key === "]" || key === "[") return false;
    }
    if (mod && e.shiftKey) return false;
    return true;
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const managed: ManagedTerminal = {
    terminal,
    fitAddon,
    container: null,
    resizeObserver: null,
    unlistenOutput: null,
    unlistenExited: null,
    onDataDisposable: null,
    spawned: false,
  };

  terminals.set(agentId, managed);
  return managed;
}

/** Attach a managed terminal to a DOM container. Handles open, canvas addon, spawn, and listeners. */
export function attachToContainer(
  agentId: string,
  container: HTMLDivElement,
  command: string,
  args: string[],
  cwd: string,
) {
  const managed = terminals.get(agentId);
  if (!managed) return;

  // Already attached to this container
  if (managed.container === container) return;

  const { terminal, fitAddon } = managed;

  // If previously attached elsewhere, detach the DOM elements
  if (managed.container && managed.container !== container) {
    detachResizeObserver(managed);
  }

  managed.container = container;

  // If terminal hasn't been opened yet, open it
  if (!terminal.element) {
    terminal.open(container);
    try {
      terminal.loadAddon(new CanvasAddon());
    } catch {
      // Canvas not available, fall back to DOM renderer
    }

    // Right-click → copy selection if any, else paste from clipboard
    const el = terminal.element as HTMLElement | undefined;
    if (el) {
      el.addEventListener("contextmenu", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (terminal.hasSelection()) {
            const text = terminal.getSelection();
            if (text) {
              await navigator.clipboard.writeText(text);
            }
            terminal.clearSelection();
          } else {
            const text = await navigator.clipboard.readText();
            if (text) {
              await writeToAgent(agentId, text);
            }
          }
        } catch {
          // Clipboard access denied or unavailable
        }
      });
    }
  } else {
    // Re-parent the terminal element into the new container
    container.innerHTML = "";
    if (terminal.element) {
      container.appendChild(terminal.element);
    }
  }

  // Track focus
  terminal.textarea?.addEventListener("focus", () => {
    useWorkspaceStore.getState().setFocusedAgent(agentId);
  });

  // Fit to new container
  requestAnimationFrame(() => {
    fitAddon.fit();
    const cols = terminal.cols;
    const rows = terminal.rows;

    // Spawn if not yet spawned
    if (!managed.spawned) {
      managed.spawned = true;
      spawnAgent(agentId, command, args, cwd, cols, rows).catch((err) => {
        terminal.writeln(`\r\n\x1b[31mFailed to spawn agent: ${err}\x1b[0m`);
        useWorkspaceStore.getState().updateAgentStatus(agentId, "error");
      });

      // Input → PTY
      managed.onDataDisposable = terminal.onData((data) => {
        writeToAgent(agentId, data).catch(() => {});
      });

      // PTY output → terminal
      onAgentOutput((event) => {
        if (event.id === agentId) {
          const bytes = Uint8Array.from(atob(event.data), (c) => c.charCodeAt(0));
          terminal.write(bytes);
        }
      }).then((fn) => {
        managed.unlistenOutput = fn;
      });

      onAgentExited((event) => {
        if (event.id === agentId) {
          terminal.writeln(
            `\r\n\x1b[33m[Process exited with code ${event.code ?? "unknown"}]\x1b[0m`,
          );
          useWorkspaceStore.getState().updateAgentStatus(agentId, "exited");
        }
      }).then((fn) => {
        managed.unlistenExited = fn;
      });
    } else {
      // Already spawned, just resize to new container dimensions
      resizeAgent(agentId, cols, rows).catch(() => {});
    }
  });

  // Observe container resizes
  setupResizeObserver(managed, agentId);
}

/** Detach terminal element from its container (before React unmounts it) */
export function detachFromContainer(agentId: string) {
  const managed = terminals.get(agentId);
  if (!managed) return;

  detachResizeObserver(managed);

  // Pull the terminal element out of the container into a safe off-DOM holder
  // so it survives React destroying the container div
  const el = managed.terminal.element;
  if (el && el.parentElement) {
    el.parentElement.removeChild(el);
  }

  managed.container = null;
}

function setupResizeObserver(managed: ManagedTerminal, agentId: string) {
  detachResizeObserver(managed);
  if (!managed.container) return;

  let resizeTimeout: ReturnType<typeof setTimeout>;
  const observer = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (managed.fitAddon && managed.container) {
        managed.fitAddon.fit();
        const cols = managed.terminal.cols;
        const rows = managed.terminal.rows;
        resizeAgent(agentId, cols, rows).catch(() => {});
      }
    }, 150);
  });
  observer.observe(managed.container);
  managed.resizeObserver = observer;
}

function detachResizeObserver(managed: ManagedTerminal) {
  if (managed.resizeObserver) {
    managed.resizeObserver.disconnect();
    managed.resizeObserver = null;
  }
}

/** Update the theme for a specific terminal */
export function updateTerminalTheme(agentId: string, theme: AppTheme) {
  const managed = terminals.get(agentId);
  if (!managed) return;
  const termTheme = getTerminalTheme(theme);
  managed.terminal.options.theme = {
    ...managed.terminal.options.theme,
    background: termTheme.background,
    foreground: termTheme.foreground,
    selectionBackground: termTheme.selectionBackground,
    black: termTheme.black,
    white: termTheme.foreground,
  };
}

/** Refit a terminal (e.g. when it becomes visible) */
export function refitTerminal(agentId: string) {
  const managed = terminals.get(agentId);
  if (!managed || !managed.container) return;
  managed.fitAddon.fit();
  const cols = managed.terminal.cols;
  const rows = managed.terminal.rows;
  resizeAgent(agentId, cols, rows).catch(() => {});
}

/** Destroy a terminal completely (when agent is closed) */
export function destroyTerminal(agentId: string) {
  const managed = terminals.get(agentId);
  if (!managed) return;
  detachResizeObserver(managed);
  managed.onDataDisposable?.dispose();
  managed.unlistenOutput?.();
  managed.unlistenExited?.();
  managed.terminal.dispose();
  terminals.delete(agentId);
}

/** Check if a terminal exists */
export function hasTerminal(agentId: string): boolean {
  return terminals.has(agentId);
}

/** Whether the terminal currently has a selection */
export function hasSelection(agentId: string): boolean {
  const managed = terminals.get(agentId);
  return managed?.terminal.hasSelection() ?? false;
}

/** Copy the current terminal selection to the clipboard. Returns true on success. */
export async function copySelection(agentId: string): Promise<boolean> {
  const managed = terminals.get(agentId);
  if (!managed || !managed.terminal.hasSelection()) return false;
  const text = managed.terminal.getSelection();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    managed.terminal.clearSelection();
    return true;
  } catch {
    return false;
  }
}
