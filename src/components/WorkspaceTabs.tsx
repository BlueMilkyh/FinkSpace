import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useNavigationStore } from "../stores/navigation-store";
import { InlineEdit } from "./InlineEdit";
import { TabContextMenu } from "./TabContextMenu";

interface TabContextMenuState {
  workspaceId: string;
  x: number;
  y: number;
}

export function WorkspaceTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const setActiveView = useNavigationStore((s) => s.setActiveView);
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const setWorkspaceColor = useWorkspaceStore((s) => s.setWorkspaceColor);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<TabContextMenuState | null>(null);

  return (
    <div className="flex items-center gap-1 px-2 h-full" data-tauri-drag-region>
      {workspaces.map((w) => {
        const isActive = w.id === activeWorkspaceId;
        return (
          <button
            key={w.id}
            onClick={() => { switchWorkspace(w.id); setActiveView("terminal"); }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCtxMenu({ workspaceId: w.id, x: e.clientX, y: e.clientY });
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-sm font-medium transition-all duration-200 ease-out ${
              isActive
                ? "text-white"
                : "text-white/60 hover:text-white/90"
            }`}
            style={{
              backgroundColor: isActive ? w.color + "30" : w.color + "10",
              borderTop: `2px solid ${isActive ? w.color : w.color + "40"}`,
              borderLeft: `1px solid ${isActive ? w.color + "40" : "transparent"}`,
              borderRight: `1px solid ${isActive ? w.color + "40" : "transparent"}`,
              transform: isActive ? "translateY(0)" : "translateY(1px)",
            }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: w.color }}
            />
            <InlineEdit
              value={w.name}
              onSave={(name) => renameWorkspace(w.id, name)}
              isEditing={editingId === w.id}
              onStartEdit={() => setEditingId(w.id)}
              onStopEdit={() => setEditingId(null)}
              className="text-sm"
            />
            <span className="text-xs text-white/30">({w.agents.length})</span>
            {workspaces.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeWorkspace(w.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
              >
                <X size={12} />
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={addWorkspace}
        className="p-1.5 rounded hover:bg-surface-light text-white/30 hover:text-white/60 transition-colors"
      >
        <Plus size={16} />
      </button>

      {ctxMenu && (() => {
        const w = workspaces.find((ws) => ws.id === ctxMenu.workspaceId);
        if (!w) return null;
        return (
          <TabContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            name={w.name}
            color={w.color}
            onRename={(name) => renameWorkspace(w.id, name)}
            onColorChange={(color) => setWorkspaceColor(w.id, color)}
            onClose={() => setCtxMenu(null)}
          />
        );
      })()}
    </div>
  );
}
