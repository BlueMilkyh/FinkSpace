import { useState } from "react";
import { X, Maximize2, Columns2, Rows2, GripVertical } from "lucide-react";
import type { Agent } from "../types";
import { useWorkspaceStore } from "../stores/workspace-store";
import { InlineEdit } from "./InlineEdit";
import { TabContextMenu } from "./TabContextMenu";

interface AgentHeaderProps {
  agent: Agent;
  onClose: () => void;
  onMaximize: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  dragHandleProps?: Record<string, unknown>;
}

const statusDotColor: Record<string, string> = {
  running: "#2ecc71",
  idle: "#f1c40f",
  exited: "#95a5a6",
  error: "#e74c3c",
};

export function AgentHeader({
  agent,
  onClose,
  onMaximize,
  onSplitHorizontal,
  onSplitVertical,
  dragHandleProps,
}: AgentHeaderProps) {
  const renameAgent = useWorkspaceStore((s) => s.renameAgent);
  const setAgentColor = useWorkspaceStore((s) => s.setAgentColor);
  const [isEditing, setIsEditing] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <div
        className="flex items-center justify-between px-3 py-1.5 select-none"
        style={{ backgroundColor: agent.color + "20", borderBottom: `2px solid ${agent.color}` }}
        onMouseDown={(e) => {
          if (!isEditing) e.preventDefault();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing text-white/25 hover:text-white/60 transition-colors"
            >
              <GripVertical size={14} />
            </div>
          )}
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: statusDotColor[agent.status] }}
          />
          <InlineEdit
            value={agent.name}
            onSave={(name) => renameAgent(agent.id, name)}
            isEditing={isEditing}
            onStartEdit={() => setIsEditing(true)}
            onStopEdit={() => setIsEditing(false)}
            className="text-sm font-medium text-white/90"
          />
          <span className="text-xs text-white/40">{agent.workDir}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onSplitHorizontal && (
            <button
              onClick={onSplitHorizontal}
              title="Split horizontal"
              className="p-1 rounded hover:bg-white/10 text-white/35 hover:text-white/90 transition-colors"
            >
              <Columns2 size={14} />
            </button>
          )}
          {onSplitVertical && (
            <button
              onClick={onSplitVertical}
              title="Split vertical"
              className="p-1 rounded hover:bg-white/10 text-white/35 hover:text-white/90 transition-colors"
            >
              <Rows2 size={14} />
            </button>
          )}
          <button
            onClick={onMaximize}
            title="Maximize"
            className="p-1 rounded hover:bg-white/10 text-white/35 hover:text-white/90 transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1 rounded hover:bg-red-500/30 text-white/35 hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {ctxMenu && (
        <TabContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          name={agent.name}
          color={agent.color}
          onRename={(name) => renameAgent(agent.id, name)}
          onColorChange={(color) => setAgentColor(agent.id, color)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}
