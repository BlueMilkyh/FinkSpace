import { useEffect, useRef } from "react";
import { Bot, Terminal, SquareTerminal } from "lucide-react";
import type { TerminalType } from "../types";
import { TERMINAL_TYPES } from "../types";

const iconMap: Record<string, React.ElementType> = {
  Bot,
  Terminal,
  SquareTerminal,
};

interface ContextMenuProps {
  x: number;
  y: number;
  onSelect: (terminalType: TerminalType) => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onSelect, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 260);
  const adjustedY = Math.min(y, window.innerHeight - TERMINAL_TYPES.length * 44 - 40);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-surface-light border border-surface-border rounded-lg shadow-2xl py-1 min-w-[240px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-white/40 uppercase tracking-wide">
        Add Agent
      </div>
      {TERMINAL_TYPES.map((tt) => {
        const Icon = iconMap[tt.icon] ?? Terminal;
        return (
          <button
            key={tt.id}
            onClick={() => onSelect(tt)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Icon size={16} className="text-white/50 shrink-0" />
            <span className="font-medium">{tt.name}</span>
          </button>
        );
      })}
    </div>
  );
}
