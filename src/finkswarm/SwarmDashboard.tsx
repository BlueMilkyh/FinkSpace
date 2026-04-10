import { useState } from "react";
import {
  Play,
  StopCircle,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useSwarmStore } from "./store";
import type { Swarm, SwarmAgent } from "./types";
import { ROLE_META } from "./types";
import { startSwarm, stopSwarm } from "./manager";
import { SwarmGraph } from "./SwarmGraph";
import { SwarmConsole } from "./SwarmConsole";
import { SwarmTerminalModal, AgentTerminal } from "./SwarmTerminalModal";
import { InlineEdit } from "../components/InlineEdit";

interface SwarmDashboardProps {
  swarm: Swarm;
}

export function SwarmDashboard({ swarm }: SwarmDashboardProps) {
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const focusedAgent =
    (focusedAgentId &&
      swarm.config.agents.find((a) => a.id === focusedAgentId)) ||
    null;
  const renameSwarm = useSwarmStore((s) => s.renameSwarm);
  const setSwarmStatus = useSwarmStore((s) => s.setSwarmStatus);
  const removeSwarm = useSwarmStore((s) => s.removeSwarm);

  const runningCount = swarm.config.agents.filter(
    (a) => a.status === "running",
  ).length;
  const idleCount = swarm.config.agents.filter((a) => a.status === "idle").length;

  const statusColor =
    swarm.status === "running"
      ? "#2ecc71"
      : swarm.status === "paused"
        ? "#f1c40f"
        : swarm.status === "error"
          ? "#e74c3c"
          : swarm.status === "completed"
            ? "#7f8c8d"
            : "#9ca3af";

  return (
    <div className="absolute inset-0 flex flex-col bg-surface">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-border bg-surface-light backdrop-blur">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: statusColor }}
          />
          <div
            onDoubleClick={() => setEditingName(true)}
            className="cursor-text"
          >
            <InlineEdit
              value={swarm.config.name}
              onSave={(name) => renameSwarm(swarm.id, name)}
              isEditing={editingName}
              onStartEdit={() => setEditingName(true)}
              onStopEdit={() => setEditingName(false)}
              className="text-sm font-semibold text-white"
            />
          </div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded"
            style={{
              color: statusColor,
              background: statusColor + "15",
              border: `1px solid ${statusColor}55`,
            }}
          >
            {swarm.status}
          </div>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-4 ml-6 text-[10px] uppercase tracking-wider text-white/50">
          <div>
            <span className="font-bold text-white">{swarm.config.agents.length}</span>{" "}
            Agents
          </div>
          <div>
            <span className="font-bold text-green-400">{runningCount}</span> Running
          </div>
          <div>
            <span className="font-bold text-yellow-400">{idleCount}</span> Idle
          </div>
          <div>
            <span className="font-bold text-white">{swarm.messages.length}</span>{" "}
            Messages
          </div>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setTerminalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-surface-border text-xs font-semibold uppercase tracking-wider text-white/70 hover:text-white hover:border-white/30 transition-colors"
        >
          <TerminalIcon size={12} /> Terminals
        </button>

        {swarm.status === "running" ? (
          <button
            onClick={async () => {
              await stopSwarm(swarm.id);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-400/40 text-red-300 text-xs font-semibold uppercase tracking-wider hover:bg-red-500/20 transition-colors"
          >
            <StopCircle size={12} /> Stop Swarm
          </button>
        ) : swarm.status === "draft" || swarm.status === "completed" ? (
          <button
            onClick={async () => {
              setSwarmStatus(swarm.id, "running");
              const fresh = useSwarmStore
                .getState()
                .swarms.find((s) => s.id === swarm.id);
              if (fresh) await startSwarm(fresh);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-orange text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            <Play size={12} /> Launch
          </button>
        ) : null}

        <button
          onClick={() => {
            if (confirm(`Delete swarm "${swarm.config.name}"?`)) {
              stopSwarm(swarm.id).finally(() => removeSwarm(swarm.id));
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-white/40 hover:text-red-400 hover:border-red-400/40 transition-colors"
          title="Delete swarm"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Main split */}
      <div className="flex-1 relative">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={70} minSize={40}>
            <div className="relative h-full w-full">
              {/* Mission brief strip */}
              <div className="absolute top-4 left-4 right-4 z-10 px-4 py-2.5 rounded-lg bg-surface-light border border-surface-border backdrop-blur">
                <div className="text-[9px] uppercase tracking-widest font-semibold text-accent-orange/70">
                  Mission
                </div>
                <div className="text-xs text-white/80 line-clamp-2 mt-0.5">
                  {swarm.config.prompt}
                </div>
              </div>
              <SwarmGraph
                swarm={swarm}
                onSelectAgent={(a) => setFocusedAgentId(a.id)}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-transparent hover:bg-accent-orange/20 transition-colors" />
          <Panel defaultSize={30} minSize={20}>
            <SwarmConsole swarm={swarm} />
          </Panel>
        </PanelGroup>
      </div>

      {terminalOpen && (
        <SwarmTerminalModal swarm={swarm} onClose={() => setTerminalOpen(false)} />
      )}

      {focusedAgent && (
        <AgentConsoleModal
          agent={focusedAgent}
          onClose={() => setFocusedAgentId(null)}
        />
      )}
    </div>
  );
}

// ─── Single-agent console (opens when you click a card in the graph) ──

function AgentConsoleModal({
  agent,
  onClose,
}: {
  agent: SwarmAgent;
  onClose: () => void;
}) {
  const meta = ROLE_META[agent.role];
  const label =
    agent.role === "custom" && agent.customRole
      ? agent.customRole.toUpperCase()
      : meta.label;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1100px] h-[80vh] rounded-lg border border-surface-border bg-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: meta.color }}
            />
            <div
              className="text-sm font-semibold"
              style={{ color: meta.color }}
            >
              {label}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-white/40">
              {agent.cli} · {agent.status}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-white/50 hover:text-white hover:border-white/30 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 p-3 min-h-0">
          <AgentTerminal agent={agent} />
        </div>
      </div>
    </div>
  );
}
