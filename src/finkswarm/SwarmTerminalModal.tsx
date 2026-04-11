import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  writeToAgent,
  resizeAgent,
  onAgentOutput,
  onAgentExited,
} from "../lib/tauri-bridge";
import { getTerminalTheme } from "../hooks/useTheme";
import { useSettingsStore } from "../stores/settings-store";
import type { Swarm, SwarmAgent } from "./types";
import { ROLE_META, getAgentLabel } from "./types";

interface SwarmTerminalModalProps {
  swarm: Swarm;
  onClose: () => void;
}

/**
 * Modal that shows a grid of live xterm views, one per swarm agent.
 *
 * Unlike the FinkSpace TerminalView, this one does NOT spawn — the
 * swarm-manager already spawned every PTY on launch. We only attach
 * an xterm to the existing process, stream output to it, and forward
 * keystrokes back with writeToAgent.
 */
export function SwarmTerminalModal({ swarm, onClose }: SwarmTerminalModalProps) {
  const cols = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(swarm.config.agents.length))));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="relative w-full max-w-[1400px] h-[85vh] rounded-lg border border-surface-border bg-surface shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-white">
              {swarm.config.name}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              Live agent terminals
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-white/50 hover:text-white hover:border-white/30 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="flex-1 grid gap-2 p-3 overflow-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
        >
          {swarm.config.agents.map((agent) => (
            <AgentTerminal
              key={agent.id}
              agent={agent}
              label={getAgentLabel(agent, swarm.config.agents)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Single agent terminal tile ────────────────────────────────────────

export function AgentTerminal({
  agent,
  label: labelProp,
}: {
  agent: SwarmAgent;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.settings.theme);
  const meta = ROLE_META[agent.role];
  const label =
    labelProp ??
    (agent.role === "custom" && agent.customRole
      ? agent.customRole.toUpperCase()
      : meta.label);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const termTheme = getTerminalTheme(theme);
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      fontSize: 12,
      lineHeight: 1.2,
      theme: {
        background: termTheme.background,
        foreground: termTheme.foreground,
        cursor: meta.color,
        selectionBackground: termTheme.selectionBackground,
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    try {
      fit.fit();
    } catch {
      // container may have zero size briefly
    }

    const onDataDisposable = term.onData((data) => {
      writeToAgent(agent.id, data).catch(() => {});
    });

    let outputUnlisten: (() => void) | null = null;
    let exitedUnlisten: (() => void) | null = null;
    let alive = true;

    onAgentOutput((event) => {
      if (!alive) return;
      if (event.id !== agent.id) return;
      try {
        // Pass raw bytes — xterm handles UTF-8 decoding. Decoding the
        // base64 payload as a binary string and writing that would
        // mangle multi-byte sequences (box-drawing, emoji, etc.) into
        // Latin-1 garbage like "â ".
        const bytes = Uint8Array.from(atob(event.data), (c) =>
          c.charCodeAt(0),
        );
        term.write(bytes);
      } catch {
        // ignore decode errors
      }
    }).then((un) => {
      if (!alive) un();
      else outputUnlisten = un;
    });

    onAgentExited((event) => {
      if (!alive) return;
      if (event.id !== agent.id) return;
      term.writeln(`\r\n\x1b[90m[exited with code ${event.code ?? "?"}]\x1b[0m`);
    }).then((un) => {
      if (!alive) un();
      else exitedUnlisten = un;
    });

    // Handle container resize → fit xterm + inform the PTY
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        resizeAgent(agent.id, term.cols, term.rows).catch(() => {});
      } catch {
        // ignore
      }
    });
    resizeObserver.observe(el);

    return () => {
      alive = false;
      onDataDisposable.dispose();
      outputUnlisten?.();
      exitedUnlisten?.();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [agent.id, theme, meta.color]);

  return (
    <div
      className="flex flex-col rounded-lg border overflow-hidden min-h-[240px]"
      style={{
        borderColor: meta.color + "55",
        background: "rgba(8,10,18,0.85)",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ borderColor: meta.color + "33", background: meta.color + "10" }}
      >
        <div
          className="text-[10px] font-bold tracking-wider"
          style={{ color: meta.color }}
        >
          {label}
        </div>
        <div className="text-[9px] text-white/40 lowercase">{agent.cli}</div>
        <div
          className="ml-auto w-1.5 h-1.5 rounded-full"
          style={{
            background:
              agent.status === "running"
                ? "#2ecc71"
                : agent.status === "idle"
                  ? "#f1c40f"
                  : "#95a5a6",
          }}
        />
      </div>
      <div ref={containerRef} className="flex-1 p-2" />
    </div>
  );
}
