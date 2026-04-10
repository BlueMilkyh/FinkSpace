import { useEffect, useState } from "react";
import { Plus, X, Network } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useWorkspaceStore } from "./workspace-store";
import { useNotificationStore } from "./notifications-store";
import { useNavigationStore } from "../stores/navigation-store";
import { useSwarmStore } from "../finkswarm/store";
import { stopSwarm } from "../finkswarm/manager";
import { InlineEdit } from "../components/InlineEdit";
import { TabContextMenu } from "./TabContextMenu";
import type { Workspace } from "../types";
import type { Swarm } from "../finkswarm/types";

interface TabContextMenuState {
  workspaceId: string;
  x: number;
  y: number;
}

export function WorkspaceTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkspaceStore((s) => s.switchWorkspace);
  const activeView = useNavigationStore((s) => s.activeView);
  const setActiveView = useNavigationStore((s) => s.setActiveView);
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const setWorkspaceColor = useWorkspaceStore((s) => s.setWorkspaceColor);
  const reorderWorkspaces = useWorkspaceStore((s) => s.reorderWorkspaces);
  const clearWorkspaceNotifications = useNotificationStore((s) => s.clearWorkspace);

  const swarms = useSwarmStore((s) => s.swarms);
  const activeSwarmId = useSwarmStore((s) => s.activeSwarmId);
  const setActiveSwarm = useSwarmStore((s) => s.setActiveSwarm);
  const removeSwarmFromStore = useSwarmStore((s) => s.removeSwarm);
  const beginSwarmDraft = useSwarmStore((s) => s.beginDraft);

  // Clear notifications for the active workspace whenever the user is viewing it
  // in the terminal. Covers every switch path: clicks, keyboard shortcuts, remount.
  useEffect(() => {
    if (activeView === "terminal") {
      clearWorkspaceNotifications(activeWorkspaceId);
    }
  }, [activeWorkspaceId, activeView, clearWorkspaceNotifications]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<TabContextMenuState | null>(null);

  // 6px activation distance so clicks still register — drag only starts on an actual drag motion.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = workspaces.findIndex((w) => w.id === active.id);
    const toIndex = workspaces.findIndex((w) => w.id === over.id);
    if (fromIndex === -1 || toIndex === -1) return;
    reorderWorkspaces(fromIndex, toIndex);
  };

  return (
    <div className="flex items-center gap-1 px-2 h-full" data-tauri-drag-region>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={workspaces.map((w) => w.id)}
          strategy={horizontalListSortingStrategy}
        >
          {workspaces.map((w) => (
            <SortableTab
              key={w.id}
              workspace={w}
              isActive={activeView === "terminal" && w.id === activeWorkspaceId}
              canClose={workspaces.length > 1}
              isEditing={editingId === w.id}
              onSelect={() => {
                switchWorkspace(w.id);
                setActiveView("terminal");
                clearWorkspaceNotifications(w.id);
              }}
              onContextMenu={(x, y) => setCtxMenu({ workspaceId: w.id, x, y })}
              onRename={(name) => renameWorkspace(w.id, name)}
              onStartEdit={() => setEditingId(w.id)}
              onStopEdit={() => setEditingId(null)}
              onRemove={() => removeWorkspace(w.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={addWorkspace}
        title="New workspace"
        className="p-1.5 rounded hover:bg-surface-light text-white/30 hover:text-white/60 transition-colors"
      >
        <Plus size={16} />
      </button>

      {swarms.length > 0 && (
        <div className="w-px h-5 bg-surface-border mx-1" />
      )}
      {swarms.map((s) => (
        <SwarmTab
          key={s.id}
          swarm={s}
          isActive={activeView === "swarm" && s.id === activeSwarmId}
          onSelect={() => {
            setActiveSwarm(s.id);
            setActiveView("swarm");
          }}
          onRemove={() => {
            stopSwarm(s.id).finally(() => removeSwarmFromStore(s.id));
          }}
        />
      ))}
      <button
        onClick={() => {
          beginSwarmDraft();
          setActiveView("swarm");
        }}
        title="New swarm"
        className="p-1.5 rounded hover:bg-cyan-400/10 text-white/30 hover:text-cyan-300 transition-colors flex items-center gap-0.5"
      >
        <Network size={14} />
        <Plus size={10} className="-ml-0.5" />
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
            workspaceId={w.id}
            onRename={(name) => renameWorkspace(w.id, name)}
            onColorChange={(color) => setWorkspaceColor(w.id, color)}
            onClose={() => setCtxMenu(null)}
          />
        );
      })()}
    </div>
  );
}

interface SortableTabProps {
  workspace: Workspace;
  isActive: boolean;
  canClose: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onContextMenu: (x: number, y: number) => void;
  onRename: (name: string) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onRemove: () => void;
}

function SortableTab({
  workspace: w,
  isActive,
  canClose,
  isEditing,
  onSelect,
  onContextMenu,
  onRename,
  onStartEdit,
  onStopEdit,
  onRemove,
}: SortableTabProps) {
  // Count of agents in this workspace that became idle since last viewed.
  // Selector returns a primitive so Zustand's equality check keeps renders tight.
  const notificationCount = useNotificationStore((s) => {
    let n = 0;
    for (const wsId of Object.values(s.agentAlerts)) {
      if (wsId === w.id) n++;
    }
    return n;
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: w.id, disabled: isEditing });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: isActive ? w.color + "30" : w.color + "10",
    borderTop: `2px solid ${isActive ? w.color : w.color + "40"}`,
    borderLeft: `1px solid ${isActive ? w.color + "40" : "transparent"}`,
    borderRight: `1px solid ${isActive ? w.color + "40" : "transparent"}`,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e.clientX, e.clientY);
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-sm font-medium transition-colors duration-200 ease-out cursor-pointer select-none ${
        isActive ? "text-white" : "text-white/60 hover:text-white/90"
      }`}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: w.color }}
      />
      <InlineEdit
        value={w.name}
        onSave={onRename}
        isEditing={isEditing}
        onStartEdit={onStartEdit}
        onStopEdit={onStopEdit}
        className="text-sm"
      />
      <span className="text-xs text-white/30">({w.agents.length})</span>
      {notificationCount > 0 && !isActive && (
        <span
          title={`${notificationCount} agent${notificationCount > 1 ? "s" : ""} finished`}
          className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent-orange text-[10px] font-semibold text-black flex items-center justify-center"
        >
          {notificationCount}
        </span>
      )}
      {canClose && (
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
        >
          <X size={12} />
        </span>
      )}
    </div>
  );
}

// ─── Swarm tab ─────────────────────────────────────────────────────────

interface SwarmTabProps {
  swarm: Swarm;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}

function SwarmTab({ swarm, isActive, onSelect, onRemove }: SwarmTabProps) {
  // Match the cyan accent FinkSwarm gets on the home card.
  const accent = "#22d3ee";
  const style: React.CSSProperties = {
    backgroundColor: isActive ? accent + "22" : accent + "0c",
    borderTop: `2px solid ${isActive ? accent : accent + "40"}`,
    borderLeft: `1px solid ${isActive ? accent + "40" : "transparent"}`,
    borderRight: `1px solid ${isActive ? accent + "40" : "transparent"}`,
  };

  return (
    <div
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md text-sm font-medium transition-colors duration-200 ease-out cursor-pointer select-none ${
        isActive ? "text-white" : "text-white/60 hover:text-white/90"
      }`}
    >
      <Network size={12} style={{ color: accent }} />
      <span className="text-sm">{swarm.config.name}</span>
      <span className="text-xs text-white/30">
        ({swarm.config.agents.length})
      </span>
      <span
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Delete swarm "${swarm.config.name}"?`)) onRemove();
        }}
        className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60"
      >
        <X size={12} />
      </span>
    </div>
  );
}
