import { useState } from "react";
import type { Agent } from "../types";
import { TERMINAL_TYPES } from "../types";
import { AgentHeader } from "./AgentHeader";
import { TerminalView } from "./TerminalView";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useSettingsStore } from "../stores/settings-store";

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
