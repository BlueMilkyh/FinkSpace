import { useState } from "react";
import { Bot, Terminal, SquareTerminal, X } from "lucide-react";
import type { Agent, TerminalType } from "../types";
import { TERMINAL_TYPES } from "../types";
import { AgentHeader } from "./AgentHeader";
import { TerminalView } from "./TerminalView";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useSettingsStore } from "../stores/settings-store";

const iconMap: Record<string, React.ElementType> = {
  Bot,
  Terminal,
  SquareTerminal,
};

interface AgentTileProps {
  agent: Agent;
  workspaceId: string;
  isVisible: boolean;
  onClose: () => void;
  dragHandleProps?: Record<string, unknown>;
}

export function AgentTile({ agent, workspaceId, isVisible, onClose, dragHandleProps }: AgentTileProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const addAgent = useWorkspaceStore((s) => s.addAgent);
  const activateAgent = useWorkspaceStore((s) => s.activateAgent);
  const defaultWorkDir = useSettingsStore((s) => s.settings.defaultWorkDir);

  const handleSplit = () => {
    const tt = TERMINAL_TYPES.find((t) => t.id === agent.terminalType) ?? TERMINAL_TYPES[0];
    const workspace = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId);
    const agents = workspace?.agents ?? [];
    const count = agents.filter((a) => a.terminalType === tt.id).length;
    const name = count === 0 ? tt.name : `${tt.name} ${count + 1}`;
    const workDir = workspace?.workDir || defaultWorkDir;
    addAgent({ workspaceId, name, workDir, terminalType: tt });
  };

  const handleSelectTerminal = (tt: TerminalType) => {
    const workspace = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId);
    const agents = workspace?.agents ?? [];
    const count = agents.filter((a) => a.terminalType === tt.id).length;
    const name = count === 0 ? tt.name : `${tt.name} ${count + 1}`;
    const workDir = workspace?.workDir || defaultWorkDir;
    activateAgent(agent.id, { workspaceId, name, workDir, terminalType: tt });
  };

  // Pending agent — show terminal type picker
  if (agent.status === "pending") {
    return (
      <div
        data-agent-id={agent.id}
        className="flex flex-col h-full rounded-lg overflow-hidden border border-white/10"
        style={{ backgroundColor: "var(--color-terminal-bg)" }}
      >
        <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10">
          <span className="text-xs text-white/40">{agent.name}</span>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-red-500/30 text-white/30 hover:text-red-400 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <span className="text-sm text-white/40">Select a terminal</span>
          <div className="flex flex-wrap justify-center gap-2">
            {TERMINAL_TYPES.map((tt) => {
              const Icon = iconMap[tt.icon] ?? Terminal;
              return (
                <button
                  key={tt.id}
                  onClick={() => handleSelectTerminal(tt)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 text-white/50 hover:text-white/90 transition-all min-w-[90px]"
                >
                  <Icon size={20} />
                  <span className="text-[11px] font-medium text-center">{tt.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-agent-id={agent.id}
      className={`flex flex-col h-full rounded-lg overflow-hidden border transition-all ${
        isMaximized ? "fixed inset-2 z-50" : ""
      }`}
      style={{
        borderColor: agent.color + "40",
        backgroundColor: "var(--color-terminal-bg)",
      }}
    >
      <AgentHeader
        agent={agent}
        onClose={onClose}
        onMaximize={() => setIsMaximized(!isMaximized)}
        onSplitHorizontal={handleSplit}
        onSplitVertical={handleSplit}
        dragHandleProps={dragHandleProps}
      />
      <div className="flex-1 overflow-hidden">
        <TerminalView
          agentId={agent.id}
          command={agent.command}
          args={agent.args}
          cwd={agent.workDir}
          color={agent.color}
          isVisible={isVisible}
        />
      </div>
    </div>
  );
}
