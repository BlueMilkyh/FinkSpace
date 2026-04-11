import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, Move, X } from "lucide-react";
import type { Swarm, SwarmAgent, SwarmAgentRole } from "./types";
import { ROLE_META, CLI_META, getAgentLabel } from "./types";
import { terminateAgent } from "./manager";

// ─── Tunables ──────────────────────────────────────────────────────────

const CARD_W = 210;
const CARD_H = 92;
const H_GAP = 40;
const V_GAP = 110;
const WORLD_PAD = 120;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

const DRAG_THRESHOLD = 4; // px before a mousedown becomes a drag

// ─── Layout ────────────────────────────────────────────────────────────

// Row assignment per role, matching the requested layout:
//   row 0 → coordinator (on top)
//   row 1 → builder + reviewer + custom (middle)
//   row 2 → scout (bottom)
const ROLE_ROW: Record<SwarmAgentRole, number> = {
  coordinator: 0,
  builder: 1,
  reviewer: 1,
  custom: 1,
  scout: 2,
};

interface NodePos {
  x: number;
  y: number;
}

function computeInitialLayout(agents: SwarmAgent[]): Record<string, NodePos> {
  // Bucket agents into rows.
  const rows: SwarmAgent[][] = [[], [], []];
  for (const a of agents) rows[ROLE_ROW[a.role] ?? 1].push(a);

  // Widest row drives the world width so everything is centred.
  const widest = Math.max(1, ...rows.map((r) => r.length));
  const worldW = widest * CARD_W + (widest - 1) * H_GAP + WORLD_PAD * 2;

  const positions: Record<string, NodePos> = {};
  rows.forEach((row, rowIdx) => {
    const rowW = row.length * CARD_W + (row.length - 1) * H_GAP;
    const startX = (worldW - rowW) / 2;
    const y = WORLD_PAD + rowIdx * (CARD_H + V_GAP);
    row.forEach((agent, i) => {
      positions[agent.id] = {
        x: startX + i * (CARD_W + H_GAP),
        y,
      };
    });
  });

  return positions;
}

function computeWorldSize(positions: Record<string, NodePos>) {
  let maxX = 0;
  let maxY = 0;
  for (const { x, y } of Object.values(positions)) {
    maxX = Math.max(maxX, x + CARD_W);
    maxY = Math.max(maxY, y + CARD_H);
  }
  return {
    w: Math.max(maxX + WORLD_PAD, 800),
    h: Math.max(maxY + WORLD_PAD, 520),
  };
}

// ─── Component ─────────────────────────────────────────────────────────

interface SwarmGraphProps {
  swarm: Swarm;
  onSelectAgent?: (agent: SwarmAgent) => void;
}

export function SwarmGraph({ swarm, onSelectAgent }: SwarmGraphProps) {
  const agents = swarm.config.agents;

  // Per-agent world-space positions. Recomputed whenever the agent set
  // changes (additions/removals get auto-placed into the tiered layout),
  // but a user who has dragged cards retains their custom positions.
  const [positions, setPositions] = useState<Record<string, NodePos>>(() =>
    computeInitialLayout(agents),
  );
  useEffect(() => {
    setPositions((prev) => {
      const base = computeInitialLayout(agents);
      const next: Record<string, NodePos> = {};
      for (const a of agents) {
        next[a.id] = prev[a.id] ?? base[a.id];
      }
      return next;
    });
  }, [agents]);

  const world = useMemo(() => computeWorldSize(positions), [positions]);

  // ─── Viewport transform (pan + zoom) ─────────────────────────────────
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<NodePos>({ x: 0, y: 0 });

  // Fit the world to the viewport on first mount and whenever the agent
  // count changes drastically (so adding 50 agents doesn't leave the
  // graph offscreen).
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (vw === 0 || vh === 0) return;
    const s = Math.min(vw / world.w, vh / world.h, 1);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s));
    setZoom(z);
    setPan({
      x: (vw - world.w * z) / 2,
      y: (vh - world.h * z) / 2,
    });
  }, [world.w, world.h]);

  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel zoom anchored at the cursor so the point under the mouse stays put.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setZoom((z) => {
        const nextZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor));
        const ratio = nextZ / z;
        setPan((p) => ({
          x: mx - (mx - p.x) * ratio,
          y: my - (my - p.y) * ratio,
        }));
        return nextZ;
      });
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // ─── Pan: drag empty canvas ──────────────────────────────────────────
  const panStateRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const onBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    panStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsPanning(true);
  };
  const onBackgroundPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = panStateRef.current;
    if (!st) return;
    setPan({
      x: st.panX + (e.clientX - st.startX),
      y: st.panY + (e.clientY - st.startY),
    });
  };
  const onBackgroundPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    panStateRef.current = null;
    setIsPanning(false);
  };

  // ─── Card drag + click (shared pointer handler) ──────────────────────
  const cardDragRef = useRef<{
    agentId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const handleCardPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    agent: SwarmAgent,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    const p = positions[agent.id] ?? { x: 0, y: 0 };
    cardDragRef.current = {
      agentId: agent.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
      moved: false,
    };
  };
  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = cardDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setPositions((prev) => ({
      ...prev,
      [drag.agentId]: {
        x: drag.origX + dx / zoom,
        y: drag.origY + dy / zoom,
      },
    }));
  };
  const handleCardPointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
    agent: SwarmAgent,
  ) => {
    const drag = cardDragRef.current;
    try {
      (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    cardDragRef.current = null;
    if (drag && !drag.moved) {
      // No meaningful movement → treat as click.
      onSelectAgent?.(agent);
    }
  };

  // ─── Edges: star topology from first coordinator ─────────────────────
  const hub = useMemo(
    () => agents.find((a) => a.role === "coordinator") ?? agents[0],
    [agents],
  );

  const isRunning = swarm.status === "running";

  // Highlight edges with recent traffic — but only while the swarm is
  // actually running. When draft/completed/error we want a calm graph
  // with no pulse/glow/flowing packets.
  const hotEdges = useMemo(() => {
    if (!isRunning) return new Set<string>();
    const last = swarm.messages.slice(-6);
    const hot = new Set<string>();
    for (const m of last) {
      if (m.fromAgentId === "system" || m.fromAgentId === "user") continue;
      if (!m.toAgentId || m.toAgentId === "all") {
        for (const a of agents) {
          if (a.id !== m.fromAgentId) hot.add(edgeKey(m.fromAgentId, a.id));
        }
      } else {
        hot.add(edgeKey(m.fromAgentId, m.toAgentId));
      }
    }
    return hot;
  }, [swarm.messages, agents, isRunning]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div
      ref={viewportRef}
      className="relative h-full w-full overflow-hidden bg-surface select-none"
      onPointerDown={onBackgroundPointerDown}
      onPointerMove={onBackgroundPointerMove}
      onPointerUp={onBackgroundPointerUp}
      onPointerCancel={onBackgroundPointerUp}
      style={{ cursor: isPanning ? "grabbing" : "grab" }}
    >
      {/* Subtle dot-grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* World — transformed by pan/zoom */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: world.w,
          height: world.h,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Edge layer */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={world.w}
          height={world.h}
        >
          {hub &&
            agents.map((a, idx) => {
              if (a.id === hub.id) return null;
              const from = positions[hub.id];
              const to = positions[a.id];
              if (!from || !to) return null;
              const x1 = from.x + CARD_W / 2;
              const y1 = from.y + CARD_H;
              const x2 = to.x + CARD_W / 2;
              const y2 = to.y;
              // Vertical bezier so lines feel hierarchical.
              const my = (y1 + y2) / 2;
              const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
              const isHot = hotEdges.has(edgeKey(hub.id, a.id));
              const lineColor = isHot
                ? ROLE_META[a.role].color
                : "rgba(255,255,255,0.14)";
              const dotColor = ROLE_META[a.role].color;
              const pathId = `swarm-edge-${a.id}`;
              // Stagger each packet so they don't all start at the top
              // together — gives the network a natural flowing feel.
              const begin = `${-(idx * 0.37).toFixed(2)}s`;
              return (
                <g key={`edge-${a.id}`}>
                  <path
                    id={pathId}
                    d={d}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={isHot ? 2 : 1.2}
                    strokeDasharray={isHot ? "none" : "4 6"}
                    className={isHot ? "swarm-edge-pulse" : undefined}
                  />
                  {/* Flowing data packet — only while the swarm is
                      running. Three concentric circles give a soft halo
                      + bright core, like a signal running down the wire. */}
                  {isRunning && (
                    <g>
                      <animateMotion
                        dur="2.6s"
                        repeatCount="indefinite"
                        begin={begin}
                        rotate="auto"
                      >
                        <mpath href={`#${pathId}`} />
                      </animateMotion>
                      <circle r="8" fill={dotColor} opacity="0.14" />
                      <circle r="4" fill={dotColor} opacity="0.55" />
                      <circle r="1.8" fill="#ffffff" />
                    </g>
                  )}
                </g>
              );
            })}
        </svg>

        {/* Agent cards */}
        {agents.map((a) => {
          const p = positions[a.id];
          if (!p) return null;
          return (
            <AgentCard
              key={a.id}
              agent={a}
              swarmId={swarm.id}
              label={getAgentLabel(a, agents)}
              x={p.x}
              y={p.y}
              onPointerDown={(e) => handleCardPointerDown(e, a)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={(e) => handleCardPointerUp(e, a)}
            />
          );
        })}
      </div>

      {/* HUD: zoom controls.
          Stop pointerdown propagation so the viewport's pan handler doesn't
          call `setPointerCapture` on a HUD click — capture would swallow the
          button's pointerup and kill its onClick. */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-surface-border bg-surface-light/80 backdrop-blur px-1.5 py-1 text-white/60 text-xs"
      >
        <button
          onClick={() =>
            setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * 0.85)))
          }
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 hover:text-white"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <div className="px-2 font-mono text-[11px] text-white/70">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() =>
            setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * 1.15)))
          }
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 hover:text-white"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button
          onClick={fit}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/5 hover:text-white"
          title="Fit to view"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={() => setPositions(computeInitialLayout(agents))}
          className="h-7 px-2 flex items-center gap-1 rounded hover:bg-white/5 hover:text-white text-[10px] uppercase tracking-wider font-semibold"
          title="Reset layout"
        >
          <Move size={12} /> Reset
        </button>
      </div>

      {/* Hint strip */}
      <div className="absolute bottom-4 right-4 text-[10px] uppercase tracking-widest text-white/30 font-semibold">
        drag canvas · scroll to zoom · click a card
      </div>
    </div>
  );
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// ─── Card ──────────────────────────────────────────────────────────────

interface AgentCardProps {
  agent: SwarmAgent;
  swarmId: string;
  label: string;
  x: number;
  y: number;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}

function AgentCard({
  agent,
  swarmId,
  label,
  x,
  y,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: AgentCardProps) {
  const meta = ROLE_META[agent.role];
  const color = meta.color;

  const statusColor =
    agent.status === "running"
      ? "#2ecc71"
      : agent.status === "idle"
        ? "#f1c40f"
        : agent.status === "error"
          ? "#e74c3c"
          : agent.status === "exited"
            ? "#7f8c8d"
            : "#95a5a6";

  const statusText =
    agent.status === "pending" ? "Waiting" : agent.status;

  // Only show the kill affordance for agents that still own a live PTY.
  const isLive = agent.status === "running" || agent.status === "idle";

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group absolute flex flex-col justify-between rounded-lg px-3 py-2.5 cursor-pointer transition-shadow hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
      style={{
        left: x,
        top: y,
        width: CARD_W,
        height: CARD_H,
        background: "rgba(10,14,22,0.92)",
        border: `1px solid ${color}66`,
        boxShadow: `0 0 0 1px ${color}22, 0 6px 20px rgba(0,0,0,0.35)`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className="text-[11px] font-bold tracking-wider truncate"
          style={{ color }}
        >
          {label}
        </div>
        <div
          className="flex items-center gap-1 text-[9px] uppercase tracking-wider"
          style={{ color: statusColor }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusColor }}
          />
          {statusText}
        </div>
      </div>
      <div className="text-[11px] text-white/75 truncate font-medium">
        {CLI_META[agent.cli].label} agent
      </div>
      <div className="text-[10px] text-white/40 truncate">
        {agent.status === "running"
          ? "Running CLI session"
          : agent.status === "pending"
            ? "Waiting for launch"
            : agent.status === "exited"
              ? "Session ended"
              : "—"}
      </div>

      {/* Per-agent kill button — only live agents. Stop propagation so
          the card's drag/select pointer handlers don't fire. */}
      {isLive && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (
              !confirm(
                `Kill ${label}? Its CLI process will be terminated immediately.`,
              )
            ) {
              return;
            }
            terminateAgent(swarmId, agent, "killed by user.").catch(() => {});
          }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full border border-red-400/50 bg-red-500/20 text-red-200 opacity-0 group-hover:opacity-100 hover:bg-red-500/40 hover:text-white flex items-center justify-center transition-opacity"
          title="Kill this agent"
          aria-label={`Kill ${label}`}
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
