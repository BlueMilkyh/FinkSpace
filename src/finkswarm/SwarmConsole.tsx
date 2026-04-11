import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Radio, Send, Users, X } from "lucide-react";
import type { Swarm, SwarmAgent, SwarmMessage } from "./types";
import { ROLE_META, getAgentLabel } from "./types";
import { broadcastUserMessage } from "./manager";

interface SwarmConsoleProps {
  swarm: Swarm;
}

export function SwarmConsole({ swarm }: SwarmConsoleProps) {
  const [draft, setDraft] = useState("");
  // `null` → broadcast to all agents; otherwise a specific agent id.
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetOpen, setTargetOpen] = useState(false);
  // Currently-focused message for the detail modal, or null for no modal.
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const targetBtnRef = useRef<HTMLButtonElement>(null);
  const targetMenuRef = useRef<HTMLDivElement>(null);

  // If the selected target gets removed (e.g. swarm reconfigured), fall back
  // to broadcast so we never silently message into the void.
  useEffect(() => {
    if (targetId && !swarm.config.agents.some((a) => a.id === targetId)) {
      setTargetId(null);
    }
  }, [swarm.config.agents, targetId]);

  // Click-outside closes the target menu.
  useEffect(() => {
    if (!targetOpen) return;
    const onDown = (e: MouseEvent) => {
      const btn = targetBtnRef.current;
      const menu = targetMenuRef.current;
      const t = e.target as Node;
      if (btn?.contains(t) || menu?.contains(t)) return;
      setTargetOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [targetOpen]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  // Auto-scroll to bottom when new messages arrive — but only by directly
  // setting scrollTop on the local container. `scrollIntoView` walks up the
  // DOM and can scroll ancestor elements (including <html>), which was
  // yanking the whole window down ~0.5s after startup while this view was
  // still hidden behind the Home screen.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [swarm.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await broadcastUserMessage(swarm.id, text, targetId ?? undefined);
  };

  const agentCount = swarm.config.agents.length;
  const targetAgent = targetId
    ? swarm.config.agents.find((a) => a.id === targetId) ?? null
    : null;
  const focusedMessage = focusedMessageId
    ? swarm.messages.find((m) => m.id === focusedMessageId) ?? null
    : null;

  // Close the detail modal with Escape.
  useEffect(() => {
    if (!focusedMessageId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusedMessageId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedMessageId]);

  // Index agents by id so we can resolve `toAgentId` → readable label cheaply.
  const agentById = useMemo(() => {
    const map = new Map<string, SwarmAgent>();
    for (const a of swarm.config.agents) map.set(a.id, a);
    return map;
  }, [swarm.config.agents]);

  // Precomputed per-role-numbered labels (`BUILDER 1`, `BUILDER 2`, …) so
  // the message list and dropdown don't each recompute them per render.
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of swarm.config.agents) {
      map.set(a.id, getAgentLabel(a, swarm.config.agents));
    }
    return map;
  }, [swarm.config.agents]);

  return (
    <div className="flex flex-col h-full bg-[#0a0c12] border-l border-surface-border">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-light/40">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-5 h-5 rounded bg-accent-orange/15 border border-accent-orange/40">
            <Radio size={11} className="text-accent-orange" />
            <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/70">
            Console
          </div>
          <div className="text-[10px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
            {swarm.messages.length}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-white/40">
          <Users size={10} />
          {agentCount} agents
        </div>
      </div>

      {/* ─── Scrollback ──────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-4"
      >
        {swarm.messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 mt-12 px-6">
            <div className="w-10 h-10 rounded-full bg-accent-orange/5 border border-accent-orange/20 flex items-center justify-center">
              <Radio size={14} className="text-accent-orange/60" />
            </div>
            <div className="text-[11px] text-white/40 text-center leading-relaxed">
              No messages yet.
              <br />
              <span className="text-white/25">
                Agents will post here as they coordinate.
              </span>
            </div>
          </div>
        )}
        {swarm.messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            agentById={agentById}
            labelById={labelById}
            onOpen={() => setFocusedMessageId(m.id)}
          />
        ))}
      </div>

      {/* ─── Composer ────────────────────────────────────── */}
      <div className="relative p-3 border-t border-surface-border bg-surface-light/30">
        {/* Target dropdown menu — anchored above the composer */}
        {targetOpen && (
          <div
            ref={targetMenuRef}
            className="absolute bottom-[calc(100%-4px)] left-3 z-20 w-[240px] max-h-[280px] overflow-y-auto rounded-xl bg-surface border border-surface-border shadow-2xl shadow-black/60 p-1"
          >
            <TargetOption
              active={targetId === null}
              color="#ff8c28"
              label="All Agents"
              sublabel={`Broadcast · ${agentCount} recipients`}
              onClick={() => {
                setTargetId(null);
                setTargetOpen(false);
              }}
              icon={<Radio size={11} />}
            />
            <div className="h-px bg-white/5 my-1" />
            {swarm.config.agents.map((a) => {
              const meta = ROLE_META[a.role];
              const label = labelById.get(a.id) ?? meta.label;
              return (
                <TargetOption
                  key={a.id}
                  active={targetId === a.id}
                  color={meta.color}
                  label={label}
                  sublabel={`${a.cli} · ${a.status} · ${a.id.slice(0, 6)}`}
                  onClick={() => {
                    setTargetId(a.id);
                    setTargetOpen(false);
                  }}
                  icon={
                    <span className="text-[10px] font-bold">
                      {label.charAt(0)}
                    </span>
                  }
                />
              );
            })}
            {swarm.config.agents.length === 0 && (
              <div className="px-3 py-4 text-[11px] text-white/30 text-center">
                No agents in this swarm yet.
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pl-1.5 pr-1 py-1 rounded-xl bg-surface border border-surface-border focus-within:border-accent-orange/60 transition-colors">
          <button
            ref={targetBtnRef}
            onClick={() => setTargetOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-lg border whitespace-nowrap transition-colors hover:brightness-110"
            style={
              targetAgent
                ? {
                    color: ROLE_META[targetAgent.role].color,
                    background: ROLE_META[targetAgent.role].color + "18",
                    borderColor: ROLE_META[targetAgent.role].color + "55",
                  }
                : {
                    color: "#ff8c28",
                    background: "rgba(255, 140, 40, 0.10)",
                    borderColor: "rgba(255, 140, 40, 0.40)",
                  }
            }
            title="Choose who receives this message"
          >
            {targetAgent ? (
              <span className="text-[10px] font-bold">
                {(labelById.get(targetAgent.id) ?? "?").charAt(0)}
              </span>
            ) : (
              <Radio size={10} />
            )}
            <span className="max-w-[110px] truncate">
              {targetAgent
                ? (labelById.get(targetAgent.id) ?? "UNKNOWN")
                : "All Agents"}
            </span>
            <ChevronDown
              size={10}
              className={`transition-transform ${targetOpen ? "rotate-180" : ""}`}
            />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              targetAgent
                ? `Message ${labelById.get(targetAgent.id) ?? ""}…`
                : "Message the swarm…"
            }
            className="flex-1 bg-transparent outline-none text-[12px] text-white placeholder:text-white/25 min-w-0"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent-orange text-white disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            <Send size={13} />
          </button>
        </div>
        <div className="text-[9px] font-mono text-white/25 text-center mt-1.5 tracking-wider uppercase">
          {targetAgent
            ? "Enter to send · Direct message"
            : "Enter to broadcast · Shared with every agent"}
        </div>
      </div>

      {focusedMessage && (
        <MessageDetailModal
          msg={focusedMessage}
          agentById={agentById}
          labelById={labelById}
          onClose={() => setFocusedMessageId(null)}
        />
      )}
    </div>
  );
}

// ─── Message renderers ───────────────────────────────────

function MessageBubble({
  msg,
  agentById,
  labelById,
  onOpen,
}: {
  msg: SwarmMessage;
  agentById: Map<string, SwarmAgent>;
  labelById: Map<string, string>;
  onOpen: () => void;
}) {
  const isSystem = msg.fromAgentId === "system";
  const isUser = msg.fromAgentId === "user";
  const sender = agentById.get(msg.fromAgentId);

  if (isSystem) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2 px-2 group cursor-pointer text-left"
        title="Click for details"
      >
        <div className="flex-1 h-px bg-white/5 group-hover:bg-white/10 transition-colors" />
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors truncate max-w-[70%]">
          {msg.text}
        </div>
        <div className="flex-1 h-px bg-white/5 group-hover:bg-white/10 transition-colors" />
      </button>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col gap-1.5 items-end px-1">
        <div className="flex items-center gap-2">
          <div className="text-[9px] font-mono text-white/30">
            {formatTime(msg.createdAt)}
          </div>
          <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-accent-orange/90">
            You
          </div>
          <div className="w-6 h-6 rounded-lg bg-accent-orange/20 border border-accent-orange/40 flex items-center justify-center text-[10px] font-bold text-accent-orange">
            U
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="max-w-[85%] px-3 py-2 rounded-xl rounded-tr-sm bg-accent-orange/15 border border-accent-orange/35 text-[12px] text-white leading-relaxed whitespace-pre-wrap break-words text-left cursor-pointer hover:bg-accent-orange/20 hover:border-accent-orange/55 transition-colors"
          title="Click for details"
        >
          {msg.text}
        </button>
      </div>
    );
  }

  const color = sender ? ROLE_META[sender.role].color : "#9b59b6";
  const label = sender
    ? (labelById.get(sender.id) ?? ROLE_META[sender.role].label)
    : "UNKNOWN";

  const targetAgent = msg.toAgentId ? agentById.get(msg.toAgentId) : null;
  const targetLabel = msg.toAgentId
    ? targetAgent
      ? (labelById.get(targetAgent.id) ?? ROLE_META[targetAgent.role].label)
      : truncate(msg.toAgentId, 8)
    : "BROADCAST";
  const targetColor = targetAgent
    ? ROLE_META[targetAgent.role].color
    : "#ffffff";

  return (
    <div
      onClick={onOpen}
      className="flex flex-col gap-1.5 px-1 group cursor-pointer"
      title="Click for details"
    >
      {/* Header row: avatar + label + arrow + target + timestamp */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{
            background: color + "22",
            border: `1px solid ${color}55`,
            color,
          }}
        >
          {label.charAt(0)}
        </div>
        <div
          className="text-[10px] uppercase tracking-[0.15em] font-bold"
          style={{ color }}
        >
          {label}
        </div>
        <div className="text-[9px] font-mono text-white/25">→</div>
        <div
          className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
          style={{
            color: targetColor,
            background: targetColor + "10",
            border: `1px solid ${targetColor}25`,
          }}
        >
          {targetLabel}
        </div>
        <div className="flex-1" />
        <div className="text-[9px] font-mono text-white/25">
          {formatTime(msg.createdAt)}
        </div>
      </div>

      {/* Content block — terminal-ish: mono, preserved whitespace, left stripe in role color */}
      <div
        className="relative rounded-lg overflow-hidden transition-colors"
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          border: `1px solid ${color}22`,
        }}
      >
        {/* Left accent stripe */}
        <div
          className="absolute top-0 bottom-0 left-0 w-[3px] transition-opacity"
          style={{ background: color, opacity: 0.55 }}
        />
        <pre className="pl-3 pr-3 py-2.5 font-mono text-[11px] leading-[1.55] text-white/85 group-hover:text-white whitespace-pre-wrap break-words m-0 line-clamp-6">
          {msg.text}
        </pre>
      </div>
    </div>
  );
}

// ─── Message detail modal ────────────────────────────────

function MessageDetailModal({
  msg,
  agentById,
  labelById,
  onClose,
}: {
  msg: SwarmMessage;
  agentById: Map<string, SwarmAgent>;
  labelById: Map<string, string>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isSystem = msg.fromAgentId === "system";
  const isUser = msg.fromAgentId === "user";
  const sender = agentById.get(msg.fromAgentId);

  const senderColor = isUser
    ? "#ff8c28"
    : isSystem
      ? "#9ca3af"
      : sender
        ? ROLE_META[sender.role].color
        : "#9b59b6";
  const senderLabel = isUser
    ? "You"
    : isSystem
      ? "System"
      : sender
        ? labelById.get(sender.id) ?? ROLE_META[sender.role].label
        : "Unknown";
  const senderSub = isUser
    ? "User input"
    : isSystem
      ? "Swarm event"
      : sender
        ? `${ROLE_META[sender.role].label.toLowerCase()} · ${sender.cli} · ${sender.status}`
        : msg.fromAgentId;

  const targetAgent = msg.toAgentId ? agentById.get(msg.toAgentId) : null;
  const targetLabel = msg.toAgentId
    ? targetAgent
      ? labelById.get(targetAgent.id) ?? ROLE_META[targetAgent.role].label
      : truncate(msg.toAgentId, 12)
    : isUser || !isSystem
      ? "All Agents (broadcast)"
      : null;
  const targetColor = targetAgent
    ? ROLE_META[targetAgent.role].color
    : "#ffffff";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore clipboard permission errors */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[680px] max-h-[80vh] rounded-xl border border-surface-border bg-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b border-surface-border"
          style={{ background: senderColor + "08" }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[14px] font-bold shrink-0"
            style={{
              background: senderColor + "22",
              border: `1px solid ${senderColor}55`,
              color: senderColor,
            }}
          >
            {senderLabel.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] uppercase tracking-[0.15em] font-bold truncate"
              style={{ color: senderColor }}
            >
              {senderLabel}
            </div>
            <div className="text-[10px] font-mono text-white/40 truncate">
              {senderSub}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-surface-border text-white/50 hover:text-white hover:border-white/30 transition-colors shrink-0"
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border text-[10px] font-mono">
          {targetLabel && (
            <>
              <div className="text-white/30 uppercase tracking-wider">To</div>
              <div
                className="px-2 py-0.5 rounded uppercase tracking-wider font-semibold"
                style={{
                  color: targetColor,
                  background: targetColor + "10",
                  border: `1px solid ${targetColor}25`,
                }}
              >
                {targetLabel}
              </div>
              <div className="w-px h-3 bg-white/10" />
            </>
          )}
          <div className="text-white/30 uppercase tracking-wider">Sent</div>
          <div className="text-white/70">{formatFullTime(msg.createdAt)}</div>
          <div className="flex-1" />
          <div className="text-white/25">
            {msg.text.length.toLocaleString()} chars
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div
            className="relative rounded-lg overflow-hidden"
            style={{
              background: "rgba(0, 0, 0, 0.35)",
              border: `1px solid ${senderColor}22`,
            }}
          >
            <div
              className="absolute top-0 bottom-0 left-0 w-[3px]"
              style={{ background: senderColor, opacity: 0.55 }}
            />
            <pre className="pl-4 pr-4 py-3 font-mono text-[12px] leading-[1.6] text-white/90 whitespace-pre-wrap break-words m-0">
              {msg.text}
            </pre>
          </div>

          {!isSystem && !isUser && sender && (
            <div className="mt-4 rounded-lg border border-surface-border bg-black/30 p-3">
              <div className="text-[9px] uppercase tracking-[0.15em] font-semibold text-white/40 mb-2">
                Sender details
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px] font-mono">
                <div className="text-white/40">Role</div>
                <div className="text-white/80">
                  {sender.role === "custom" && sender.customRole
                    ? sender.customRole
                    : ROLE_META[sender.role].label}
                </div>
                <div className="text-white/40">CLI</div>
                <div className="text-white/80">{sender.cli}</div>
                <div className="text-white/40">Status</div>
                <div className="text-white/80">{sender.status}</div>
                <div className="text-white/40">Agent ID</div>
                <div className="text-white/60 truncate">{sender.id}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-surface-border">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-[11px] uppercase tracking-wider font-semibold text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy text"}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-accent-orange text-white text-[11px] font-semibold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Target dropdown option row ──────────────────────────

function TargetOption({
  active,
  color,
  label,
  sublabel,
  onClick,
  icon,
}: {
  active: boolean;
  color: string;
  label: string;
  sublabel: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: color + "22",
          border: `1px solid ${color}55`,
          color,
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[11px] uppercase tracking-wider font-bold truncate"
          style={{ color }}
        >
          {label}
        </div>
        <div className="text-[9px] font-mono text-white/40 truncate">
          {sublabel}
        </div>
      </div>
      {active && (
        <Check size={12} className="text-accent-orange shrink-0" />
      )}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mo = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}:${ss}`;
}
