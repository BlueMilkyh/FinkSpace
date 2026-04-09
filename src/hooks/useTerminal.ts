import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import {
  spawnAgent,
  writeToAgent,
  resizeAgent,
  onAgentOutput,
  onAgentExited,
} from "../lib/tauri-bridge";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useSettingsStore } from "../stores/settings-store";
import { getTerminalTheme } from "./useTheme";
import { isMac } from "../lib/platform";

interface UseTerminalOptions {
  agentId: string;
  command: string;
  args: string[];
  cwd: string;
  color: string;
  isVisible: boolean;
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseTerminalOptions,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const updateAgentStatus = useWorkspaceStore((s) => s.updateAgentStatus);
  const theme = useSettingsStore((s) => s.settings.theme);

  // Update terminal theme when app theme changes (without re-spawning)
  useEffect(() => {
    if (!terminalRef.current) return;
    const termTheme = getTerminalTheme(theme);
    terminalRef.current.options.theme = {
      ...terminalRef.current.options.theme,
      background: termTheme.background,
      foreground: termTheme.foreground,
      selectionBackground: termTheme.selectionBackground,
      black: termTheme.black,
      white: termTheme.foreground,
    };
  }, [theme]);

  // Re-fit terminal when it becomes visible again
  useEffect(() => {
    if (options.isVisible && fitAddonRef.current && terminalRef.current) {
      // Small delay to ensure the DOM has finished layout
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const cols = terminalRef.current!.cols;
        const rows = terminalRef.current!.rows;
        resizeAgent(options.agentId, cols, rows).catch(() => {});
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [options.isVisible, options.agentId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const termTheme = getTerminalTheme(theme);
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: termTheme.background,
        foreground: termTheme.foreground,
        cursor: options.color,
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

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    // Let app-level shortcuts pass through xterm instead of being swallowed
    // On macOS, Cmd (metaKey) is the modifier; on Windows/Linux it's Ctrl
    terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      const mod = isMac() ? e.metaKey : e.ctrlKey;
      if (mod && !e.altKey) {
        const key = e.key.toLowerCase();
        if (["t", "n", "w", "k", "d", ","].includes(key)) return false;
        if (/^[1-9]$/.test(key)) return false;
        if (key === "]" || key === "[") return false;
      }
      if (mod && e.shiftKey) {
        return false;
      }
      return true;
    });

    terminal.open(container);

    // Track which agent pane is focused
    terminal.textarea?.addEventListener("focus", () => {
      useWorkspaceStore.getState().setFocusedAgent(options.agentId);
    });

    // Use Canvas renderer (WebGL has context limits that cause blank terminals)
    try {
      const canvasAddon = new CanvasAddon();
      terminal.loadAddon(canvasAddon);
    } catch {
      // Canvas not available, fall back to default DOM renderer
    }

    fitAddon.fit();
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const cols = terminal.cols;
    const rows = terminal.rows;

    // Spawn the agent process
    spawnAgent(options.agentId, options.command, options.args, options.cwd, cols, rows).catch(
      (err) => {
        terminal.writeln(`\r\n\x1b[31mFailed to spawn agent: ${err}\x1b[0m`);
        updateAgentStatus(options.agentId, "error");
      },
    );

    // Handle user input -> PTY
    const onDataDisposable = terminal.onData((data) => {
      writeToAgent(options.agentId, data).catch(() => {});
    });

    // Handle PTY output -> terminal
    let unlistenOutput: (() => void) | null = null;
    let unlistenExited: (() => void) | null = null;

    onAgentOutput((event) => {
      if (event.id === options.agentId) {
        const bytes = Uint8Array.from(atob(event.data), (c) =>
          c.charCodeAt(0),
        );
        terminal.write(bytes);
      }
    }).then((fn) => {
      unlistenOutput = fn;
    });

    onAgentExited((event) => {
      if (event.id === options.agentId) {
        terminal.writeln(
          `\r\n\x1b[33m[Process exited with code ${event.code ?? "unknown"}]\x1b[0m`,
        );
        updateAgentStatus(options.agentId, "exited");
      }
    }).then((fn) => {
      unlistenExited = fn;
    });

    // Handle resize
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          const newCols = terminal.cols;
          const newRows = terminal.rows;
          resizeAgent(options.agentId, newCols, newRows).catch(() => {});
        }
      }, 150);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
      onDataDisposable.dispose();
      unlistenOutput?.();
      unlistenExited?.();
      terminal.dispose();
    };
  }, [options.agentId, options.command, options.cwd, options.color, containerRef, options.args, updateAgentStatus]);

  return terminalRef;
}
