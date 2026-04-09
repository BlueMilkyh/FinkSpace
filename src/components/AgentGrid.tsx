import { useState, useCallback, useMemo, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelGroupHandle } from "react-resizable-panels";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { useWorkspaceStore } from "../stores/workspace-store";
import { AgentTile } from "./AgentTile";
import { AddAgentButton } from "./AddAgentButton";
import { ContextMenu } from "./ContextMenu";
import { killAgent } from "../lib/tauri-bridge";
import { useSettingsStore } from "../stores/settings-store";
import { TERMINAL_LAYOUTS } from "../types";
import type { TerminalType, Agent } from "../types";

/** Split agents into rows based on layout definition */
function splitIntoRows(agents: Agent[], rows: number[]): Agent[][] {
  const result: Agent[][] = [];
  let idx = 0;
  for (const colCount of rows) {
    result.push(agents.slice(idx, idx + colCount));
    idx += colCount;
  }
  if (idx < agents.length) {
    const remaining = agents.slice(idx);
    const lastCols = rows[rows.length - 1] || 2;
    for (let i = 0; i < remaining.length; i += lastCols) {
      result.push(remaining.slice(i, i + lastCols));
    }
  }
  return result;
}

/** Auto-split agents into rows */
function autoSplitRows(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 3) return [count];
  if (count === 4) return [2, 2];
  if (count === 5) return [3, 2];
  if (count === 6) return [3, 3];
  const rows: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const perRow = remaining > 4 ? Math.min(4, Math.ceil(remaining / 2)) : remaining;
    rows.push(perRow);
    remaining -= perRow;
  }
  return rows;
}

function ResizeHandle({
  direction,
  onReset,
}: {
  direction: "horizontal" | "vertical";
  onReset?: () => void;
}) {
  return (
    <PanelResizeHandle
      className={`group relative flex items-center justify-center ${
        direction === "vertical" ? "h-1.5 cursor-row-resize" : "w-1.5 cursor-col-resize"
      }`}
      onDoubleClick={onReset}
    >
      <div
        className={`rounded-full bg-white/10 group-hover:bg-white/30 group-active:bg-accent-orange/60 transition-colors ${
          direction === "vertical" ? "w-8 h-0.5" : "h-8 w-0.5"
        }`}
      />
    </PanelResizeHandle>
  );
}

/** Wrapper that makes an agent tile sortable via its drag handle */
function SortableAgentTile({
  agent,
  workspaceId,
  isVisible,
  onClose,
}: {
  agent: Agent;
  workspaceId: string;
  isVisible: boolean;
  onClose: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    height: "100%",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <AgentTile
        agent={agent}
        workspaceId={workspaceId}
        isVisible={isVisible}
        onClose={onClose}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/** Drag overlay shown while dragging */
function DragOverlayContent({ agent }: { agent: Agent }) {
  return (
    <div
      className="rounded-lg border overflow-hidden shadow-2xl"
      style={{
        borderColor: agent.color + "80",
        backgroundColor: "var(--color-terminal-bg)",
        width: 320,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{
          backgroundColor: agent.color + "30",
          borderBottom: `2px solid ${agent.color}`,
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: "#2ecc71" }}
        />
        <span className="text-sm font-medium text-white/90">{agent.name}</span>
      </div>
      <div className="h-16 bg-black/20" />
    </div>
  );
}

export function AgentGrid() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const addAgent = useWorkspaceStore((s) => s.addAgent);
  const removeAgent = useWorkspaceStore((s) => s.removeAgent);
  const reorderAgents = useWorkspaceStore((s) => s.reorderAgents);

  const defaultWorkDir = useSettingsStore((s) => s.settings.defaultWorkDir);
  const terminalLayout = useSettingsStore((s) => s.settings.terminalLayout);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);

  const activeLayout = useMemo(
    () => TERMINAL_LAYOUTS.find((l) => l.id === terminalLayout),
    [terminalLayout],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleAddAgent = useCallback(
    (terminalType: TerminalType, workspaceId: string) => {
      const workspace = workspaces.find((w) => w.id === workspaceId);
      const agents = workspace?.agents ?? [];
      const count = agents.filter((a) => a.terminalType === terminalType.id).length;
      const name = count === 0 ? terminalType.name : `${terminalType.name} ${count + 1}`;
      const workDir = workspace?.workDir || defaultWorkDir;
      addAgent({ workspaceId, name, workDir, terminalType });
      setContextMenu(null);
    },
    [workspaces, addAgent, defaultWorkDir],
  );

  const handleCloseAgent = async (workspaceId: string, agentId: string) => {
    try {
      await killAgent(agentId);
    } catch {
      // Agent may already be dead
    }
    removeAgent(workspaceId, agentId);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      const agent = ws?.agents.find((a) => a.id === event.active.id);
      setActiveAgent(agent ?? null);
    },
    [workspaces, activeWorkspaceId],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveAgent(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ws = workspaces.find((w) => w.id === activeWorkspaceId);
      if (!ws) return;

      const fromIndex = ws.agents.findIndex((a) => a.id === active.id);
      const toIndex = ws.agents.findIndex((a) => a.id === over.id);
      if (fromIndex === -1 || toIndex === -1) return;

      reorderAgents(activeWorkspaceId, fromIndex, toIndex);
    },
    [workspaces, activeWorkspaceId, reorderAgents],
  );

  return (
    <div className="h-full relative" onContextMenu={handleContextMenu}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId;
          const agents = workspace.agents;

          if (agents.length === 0) {
            return (
              <div
                key={workspace.id}
                className="absolute inset-0 flex items-center justify-center p-2 transition-opacity duration-150 ease-in-out"
                style={{
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                  zIndex: isActive ? 1 : 0,
                }}
              >
                <AddAgentButton
                  onSelect={(tt) => handleAddAgent(tt, workspace.id)}
                  workspaceId={workspace.id}
                />
              </div>
            );
          }

          // Determine row layout
          const useCustomLayout = activeLayout && activeLayout.rows.length > 0;
          const rowDef = useCustomLayout ? activeLayout.rows : autoSplitRows(agents.length);
          const agentRows = splitIntoRows(agents, rowDef);

          // Single agent — no resize handles or drag needed
          if (agents.length === 1) {
            return (
              <div
                key={workspace.id}
                className="absolute inset-0 p-1.5 transition-opacity duration-150 ease-in-out"
                style={{
                  opacity: isActive ? 1 : 0,
                  pointerEvents: isActive ? "auto" : "none",
                  zIndex: isActive ? 1 : 0,
                }}
              >
                <AgentTile
                  agent={agents[0]}
                  workspaceId={workspace.id}
                  isVisible={isActive}
                  onClose={() => handleCloseAgent(workspace.id, agents[0].id)}
                />
              </div>
            );
          }

          // Multiple agents — sortable + resizable
          return (
            <div
              key={workspace.id}
              className="absolute inset-0 p-1.5 transition-opacity duration-150 ease-in-out"
              style={{
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
                zIndex: isActive ? 1 : 0,
              }}
            >
              <SortableContext
                items={agents.map((a) => a.id)}
                strategy={rectSortingStrategy}
              >
                <ResizableRows
                  workspaceId={workspace.id}
                  agentRows={agentRows}
                  isVisible={isActive}
                  onCloseAgent={(agentId) => handleCloseAgent(workspace.id, agentId)}
                />
              </SortableContext>
            </div>
          );
        })}

        <DragOverlay dropAnimation={null}>
          {activeAgent && <DragOverlayContent agent={activeAgent} />}
        </DragOverlay>
      </DndContext>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onSelect={(tt) => handleAddAgent(tt, activeWorkspaceId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/** Vertical PanelGroup wrapper with double-click-to-reset on row handles */
function ResizableRows({
  workspaceId,
  agentRows,
  isVisible,
  onCloseAgent,
}: {
  workspaceId: string;
  agentRows: Agent[][];
  isVisible: boolean;
  onCloseAgent: (agentId: string) => void;
}) {
  const ref = useRef<ImperativePanelGroupHandle>(null);
  const rowCount = agentRows.length;
  const resetRows = useCallback(() => {
    ref.current?.setLayout(agentRows.map(() => 100 / rowCount));
  }, [agentRows, rowCount]);

  return (
    <PanelGroup ref={ref} direction="vertical" autoSaveId={`ws-${workspaceId}-rows`}>
      {agentRows.map((rowAgents, rowIdx) => (
        <AgentRow
          key={`row-${rowIdx}-${rowAgents.map((a) => a.id).join("-")}`}
          rowIdx={rowIdx}
          rowCount={rowCount}
          agents={rowAgents}
          workspaceId={workspaceId}
          isVisible={isVisible}
          onCloseAgent={onCloseAgent}
          onResetRows={resetRows}
        />
      ))}
    </PanelGroup>
  );
}

/** A single row of resizable agent panels */
function AgentRow({
  rowIdx,
  rowCount,
  agents,
  workspaceId,
  isVisible,
  onCloseAgent,
  onResetRows,
}: {
  rowIdx: number;
  rowCount: number;
  agents: Agent[];
  workspaceId: string;
  isVisible: boolean;
  onCloseAgent: (agentId: string) => void;
  onResetRows: () => void;
}) {
  const ref = useRef<ImperativePanelGroupHandle>(null);
  const colCount = agents.length;
  const resetCols = useCallback(() => {
    ref.current?.setLayout(agents.map(() => 100 / colCount));
  }, [agents, colCount]);

  return (
    <>
      <Panel defaultSize={100 / rowCount} minSize={10}>
        {agents.length === 1 ? (
          <div className="h-full p-0.5">
            <SortableAgentTile
              agent={agents[0]}
              workspaceId={workspaceId}
              isVisible={isVisible}
              onClose={() => onCloseAgent(agents[0].id)}
            />
          </div>
        ) : (
          <PanelGroup ref={ref} direction="horizontal" autoSaveId={`ws-${workspaceId}-row${rowIdx}`}>
            {agents.map((agent, colIdx) => (
              <AgentCol
                key={agent.id}
                colIdx={colIdx}
                colCount={colCount}
                agent={agent}
                workspaceId={workspaceId}
                isVisible={isVisible}
                onClose={() => onCloseAgent(agent.id)}
                onResetCols={resetCols}
              />
            ))}
          </PanelGroup>
        )}
      </Panel>
      {rowIdx < rowCount - 1 && <ResizeHandle direction="vertical" onReset={onResetRows} />}
    </>
  );
}

/** A single column (agent) within a row */
function AgentCol({
  colIdx,
  colCount,
  agent,
  workspaceId,
  isVisible,
  onClose,
  onResetCols,
}: {
  colIdx: number;
  colCount: number;
  agent: Agent;
  workspaceId: string;
  isVisible: boolean;
  onClose: () => void;
  onResetCols: () => void;
}) {
  return (
    <>
      <Panel defaultSize={100 / colCount} minSize={10}>
        <div className="h-full p-0.5">
          <SortableAgentTile
            agent={agent}
            workspaceId={workspaceId}
            isVisible={isVisible}
            onClose={onClose}
          />
        </div>
      </Panel>
      {colIdx < colCount - 1 && <ResizeHandle direction="horizontal" onReset={onResetCols} />}
    </>
  );
}
