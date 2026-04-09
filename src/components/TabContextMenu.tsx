import { useEffect, useRef, useState } from "react";
import { Pencil, LayoutGrid } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { TERMINAL_LAYOUTS } from "../types";
import { useSettingsStore } from "../stores/settings-store";
import { useWorkspaceStore } from "../stores/workspace-store";

interface TabContextMenuProps {
  x: number;
  y: number;
  name: string;
  color: string;
  workspaceId?: string;
  onRename: (name: string) => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

export function TabContextMenu({
  x,
  y,
  name,
  color,
  workspaceId,
  onRename,
  onColorChange,
  onClose,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isRenaming) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  const terminalLayout = useSettingsStore((s) => s.settings.terminalLayout);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const addPendingAgent = useWorkspaceStore((s) => s.addPendingAgent);

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-surface-light border border-surface-border rounded-lg shadow-2xl py-1 min-w-[200px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {isRenaming ? (
        <div className="px-3 py-2">
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white outline-none focus:border-white/40"
          />
        </div>
      ) : (
        <button
          onClick={() => setIsRenaming(true)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Pencil size={14} />
          <span>Rename</span>
        </button>
      )}

      {workspaceId && (
        <>
          <div className="border-t border-white/10 mx-2 my-1" />

          <div className="px-3 py-2">
            <div className="flex items-center gap-1.5 mb-2">
              <LayoutGrid size={12} className="text-white/40" />
              <span className="text-xs text-white/40">Layout</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {TERMINAL_LAYOUTS.filter((l) => ["auto", "2h", "2v", "1-2", "2-1", "2-2", "3", "1-3"].includes(l.id)).map((layout) => {
                const isSelected = terminalLayout === layout.id;
                return (
                  <button
                    key={layout.id}
                    onClick={() => {
                      updateSetting("terminalLayout", layout.id);
                      // Spawn pending slots to fill the layout
                      const totalSlots = layout.rows.reduce((sum, cols) => sum + cols, 0);
                      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId);
                      const currentCount = ws?.agents.length ?? 0;
                      const toSpawn = totalSlots - currentCount;
                      if (toSpawn > 0 && workspaceId) {
                        for (let i = 0; i < toSpawn; i++) {
                          addPendingAgent(workspaceId);
                        }
                      }
                      onClose();
                    }}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded transition-colors ${
                      isSelected
                        ? "bg-accent-orange/20 text-accent-orange"
                        : "hover:bg-white/10 text-white/50 hover:text-white/80"
                    }`}
                    title={layout.name}
                  >
                    <LayoutPreview layout={layout.id} size={20} active={isSelected} />
                    <span className="text-[9px] leading-none">{layout.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="border-t border-white/10 mx-2 my-1" />

      <div className="px-3 py-2">
        <span className="text-xs text-white/40 mb-2 block">Tab Color</span>
        <ColorPicker
          selectedColor={color}
          onSelect={(c) => {
            onColorChange(c);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

/** Tiny SVG preview of a layout */
function LayoutPreview({ layout, size, active }: { layout: string; size: number; active: boolean }) {
  const color = active ? "var(--color-accent-orange, #e67e22)" : "currentColor";
  const gap = 1;

  // Define rows as arrays of column counts
  const rowDefs: Record<string, number[]> = {
    auto: [],
    "1": [1],
    "2h": [2],
    "2v": [1, 1],
    "3": [3],
    "1-2": [1, 2],
    "2-1": [2, 1],
    "2-2": [2, 2],
    "2-3": [2, 3],
    "3-2": [3, 2],
    "3-3": [3, 3],
    "1-3": [1, 3],
    "3-1": [3, 1],
  };

  const rows = rowDefs[layout] ?? [];

  if (rows.length === 0) {
    // Auto layout — show a dashed square
    return (
      <svg width={size} height={size} viewBox="0 0 20 20">
        <rect
          x="1" y="1" width="18" height="18" rx="2"
          fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 2"
          opacity={0.6}
        />
        <text x="10" y="13" textAnchor="middle" fontSize="8" fill={color} opacity={0.8}>A</text>
      </svg>
    );
  }

  const rects: { x: number; y: number; w: number; h: number }[] = [];
  const rowH = (size - gap * (rows.length - 1)) / rows.length;

  rows.forEach((cols, ri) => {
    const colW = (size - gap * (cols - 1)) / cols;
    const y = ri * (rowH + gap);
    for (let ci = 0; ci < cols; ci++) {
      rects.push({ x: ci * (colW + gap), y, w: colW, h: rowH });
    }
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects.map((r, i) => (
        <rect
          key={i}
          x={r.x} y={r.y} width={r.w} height={r.h}
          rx={1.5}
          fill={color}
          opacity={active ? 0.6 : 0.3}
        />
      ))}
    </svg>
  );
}
