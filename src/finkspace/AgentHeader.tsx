import { useEffect, useRef, useState } from "react";
import {
  X,
  Maximize2,
  Columns2,
  Rows2,
  GripVertical,
  MoreHorizontal,
  Bot,
  Terminal,
  SquareTerminal,
  Sparkles,
  Gem,
  Wand2,
  Cpu,
  MousePointer2,
  Check,
} from "lucide-react";
import type { Agent, TerminalType } from "../types";
import { TERMINAL_TYPES } from "../types";
import { useWorkspaceStore } from "./workspace-store";
import { InlineEdit } from "../components/InlineEdit";
import { TabContextMenu } from "./TabContextMenu";

const iconMap: Record<string, React.ElementType> = {
  Bot,
  Terminal,
  SquareTerminal,
  Sparkles,
  Gem,
  Wand2,
  Cpu,
  MousePointer2,
};

interface AgentHeaderProps {
  agent: Agent;
  onClose: () => void;
  onMaximize: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onSwitchTerminal?: (terminalType: TerminalType) => void;
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
  onSwitchTerminal,
  dragHandleProps,
}: AgentHeaderProps) {
  const renameAgent = useWorkspaceStore((s) => s.renameAgent);
  const setAgentColor = useWorkspaceStore((s) => s.setAgentColor);
  const [isEditing, setIsEditing] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [moreMenuOpen]);

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
          {onSwitchTerminal && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setMoreMenuOpen((v) => !v)}
                title="Change terminal"
                className="p-1 rounded hover:bg-white/10 text-white/35 hover:text-white/90 transition-colors"
              >
                <MoreHorizontal size={14} />
              </button>
              {moreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-50 bg-surface-light border border-surface-border rounded-lg shadow-2xl py-1 min-w-[180px]"
                >
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/30">
                    Switch terminal
                  </div>
                  {TERMINAL_TYPES.map((tt) => {
                    const Icon = iconMap[tt.icon] ?? Terminal;
                    const isActive = agent.terminalType === tt.id;
                    return (
                      <button
                        key={tt.id}
                        onClick={() => {
                          setMoreMenuOpen(false);
                          if (!isActive) onSwitchTerminal(tt);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                          isActive
                            ? "text-accent-orange bg-accent-orange/10"
                            : "text-white/75 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon size={13} />
                        <span className="flex-1 text-left">{tt.name}</span>
                        {isActive && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
