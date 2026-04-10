import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { Swarm, SwarmMessage } from "./types";
import { ROLE_META } from "./types";
import { broadcastUserMessage } from "./manager";

interface SwarmConsoleProps {
  swarm: Swarm;
}

export function SwarmConsole({ swarm }: SwarmConsoleProps) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [swarm.messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await broadcastUserMessage(swarm.id, text);
  };

  return (
    <div className="flex flex-col h-full bg-surface-light border-l border-surface-border">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
          <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-white/60">
            Console
          </div>
        </div>
        <div className="text-[10px] font-mono text-white/30">
          {swarm.messages.length} msgs
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {swarm.messages.length === 0 && (
          <div className="text-[11px] text-white/30 text-center mt-8">
            No messages yet. Agents will post here as they coordinate.
          </div>
        )}
        {swarm.messages.map((m) => (
          <MessageBubble key={m.id} msg={m} swarm={swarm} />
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-surface-border flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the swarm..."
          className="flex-1 px-3 py-2 rounded-lg bg-surface border border-surface-border focus:border-accent-orange focus:outline-none text-xs text-white placeholder:text-white/30"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-orange text-white disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, swarm }: { msg: SwarmMessage; swarm: Swarm }) {
  const sender = swarm.config.agents.find((a) => a.id === msg.fromAgentId);
  const isSystem = msg.fromAgentId === "system";
  const isUser = msg.fromAgentId === "user";

  if (isSystem) {
    return (
      <div className="text-[10px] font-mono text-white/40 italic text-center">
        {msg.text}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col gap-1 items-end">
        <div className="text-[9px] uppercase tracking-widest font-bold text-accent-orange/80">
          You
        </div>
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-accent-orange/15 border border-accent-orange/30 text-xs text-white leading-relaxed">
          {msg.text}
        </div>
      </div>
    );
  }

  const color = sender ? ROLE_META[sender.role].color : "#9b59b6";
  const label =
    sender?.role === "custom" && sender?.customRole
      ? sender.customRole.toUpperCase()
      : sender
        ? ROLE_META[sender.role].label
        : "UNKNOWN";

  const target = msg.toAgentId
    ? ` → ${truncate(msg.toAgentId, 8)}`
    : " → ALL";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div
          className="text-[9px] uppercase tracking-widest font-bold"
          style={{ color }}
        >
          {label}
        </div>
        <div className="text-[9px] font-mono text-white/30">{target}</div>
      </div>
      <div
        className="max-w-[92%] px-3 py-2 rounded-lg text-xs text-white/90 leading-relaxed"
        style={{
          background: color + "12",
          border: `1px solid ${color}33`,
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}
