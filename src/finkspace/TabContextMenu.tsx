import { useEffect, useRef, useState } from "react";
import { Pencil, LayoutGrid, Plus, Minus, X, Check, Sliders } from "lucide-react";
import { ColorPicker } from "../components/ColorPicker";
import { TERMINAL_LAYOUTS } from "../types";
import { useSettingsStore } from "../stores/settings-store";
import { useWorkspaceStore } from "./workspace-store";

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
  const customLayoutRows = useSettingsStore((s) => s.settings.customLayoutRows);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const addPendingAgent = useWorkspaceStore((s) => s.addPendingAgent);

  // Custom layout editor state — holds the draft while user is editing.
  const [customEditorOpen, setCustomEditorOpen] = useState(false);
  const [draftRows, setDraftRows] = useState<number[]>(customLayoutRows);

  const openCustomEditor = () => {
    setDraftRows(customLayoutRows.length > 0 ? [...customLayoutRows] : [2, 2]);
    setCustomEditorOpen(true);
  };

  const applyLayoutById = (id: string, rows: number[]) => {
    updateSetting("terminalLayout", id);
    if (!workspaceId) return;
    const totalSlots = rows.reduce((sum, cols) => sum + cols, 0);
    const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === workspaceId);
    const currentCount = ws?.agents.length ?? 0;
    const toSpawn = totalSlots - currentCount;
    for (let i = 0; i < toSpawn; i++) {
      addPendingAgent(workspaceId);
    }
  };

  const applyCustom = () => {
    const cleaned = draftRows.filter((n) => n >= 1).map((n) => Math.min(8, Math.max(1, Math.floor(n))));
    if (cleaned.length === 0) return;
    updateSetting("customLayoutRows", cleaned);
    applyLayoutById("custom", cleaned);
    onClose();
  };

  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - (customEditorOpen ? 420 : 320));

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

          {customEditorOpen ? (
            <CustomLayoutEditor
              draftRows={draftRows}
              setDraftRows={setDraftRows}
              onCancel={() => setCustomEditorOpen(false)}
              onApply={applyCustom}
            />
          ) : (
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
                        applyLayoutById(layout.id, layout.rows);
                        onClose();
                      }}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded transition-colors ${
                        isSelected
                          ? "bg-accent-orange/20 text-accent-orange"
                          : "hover:bg-white/10 text-white/50 hover:text-white/80"
                      }`}
                      title={layout.name}
                    >
                      <LayoutPreview rows={layout.rows} size={20} active={isSelected} />
                      <span className="text-[9px] leading-none">{layout.name}</span>
                    </button>
                  );
                })}
                {/* Custom layout — opens inline editor */}
                <button
                  onClick={openCustomEditor}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded transition-colors ${
                    terminalLayout === "custom"
                      ? "bg-accent-orange/20 text-accent-orange"
                      : "hover:bg-white/10 text-white/50 hover:text-white/80"
                  }`}
                  title="Custom layout"
                >
                  {terminalLayout === "custom" ? (
                    <LayoutPreview rows={customLayoutRows} size={20} active />
                  ) : (
                    <Sliders size={16} />
                  )}
                  <span className="text-[9px] leading-none">Custom</span>
                </button>
              </div>
            </div>
          )}
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

/** Tiny SVG preview of a layout — accepts rows array directly. */
function LayoutPreview({
  rows,
  size,
  active,
}: {
  rows: number[];
  size: number;
  active: boolean;
}) {
  const color = active ? "var(--color-accent-orange, #e67e22)" : "currentColor";
  const gap = 1;

  if (rows.length === 0) {
    // Auto layout — dashed square with "A".
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
    if (cols < 1) return;
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

/** Inline custom-layout builder shown inside the context menu. */
function CustomLayoutEditor({
  draftRows,
  setDraftRows,
  onCancel,
  onApply,
}: {
  draftRows: number[];
  setDraftRows: (rows: number[]) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const totalSlots = draftRows.reduce((sum, n) => sum + n, 0);
  const MAX_ROWS = 6;
  const MAX_COLS = 8;

  const setCol = (rowIdx: number, value: number) => {
    const next = [...draftRows];
    next[rowIdx] = Math.min(MAX_COLS, Math.max(1, value));
    setDraftRows(next);
  };
  const addRow = () => {
    if (draftRows.length >= MAX_ROWS) return;
    setDraftRows([...draftRows, 2]);
  };
  const removeRow = (rowIdx: number) => {
    if (draftRows.length <= 1) return;
    setDraftRows(draftRows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div className="px-3 py-2 w-[230px]">
      <div className="flex items-center gap-1.5 mb-2">
        <Sliders size={12} className="text-accent-orange" />
        <span className="text-xs text-white/60">Custom Layout</span>
        <span className="ml-auto text-[10px] text-white/30">{totalSlots} slot(s)</span>
      </div>

      {/* Live preview */}
      <div className="flex items-center justify-center mb-2 p-2 bg-black/30 rounded border border-white/10">
        <LayoutPreview rows={draftRows} size={56} active />
      </div>

      {/* Per-row column editors */}
      <div className="flex flex-col gap-1 mb-2 max-h-[140px] overflow-y-auto">
        {draftRows.map((cols, ri) => (
          <div key={ri} className="flex items-center gap-1.5 text-xs">
            <span className="text-white/40 w-10">Row {ri + 1}</span>
            <button
              onClick={() => setCol(ri, cols - 1)}
              disabled={cols <= 1}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white/70"
            >
              <Minus size={10} />
            </button>
            <span className="w-5 text-center font-mono text-white/80">{cols}</span>
            <button
              onClick={() => setCol(ri, cols + 1)}
              disabled={cols >= MAX_COLS}
              className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 text-white/70"
            >
              <Plus size={10} />
            </button>
            <span className="text-white/30 text-[10px] ml-1">cols</span>
            <button
              onClick={() => removeRow(ri)}
              disabled={draftRows.length <= 1}
              className="ml-auto w-5 h-5 flex items-center justify-center rounded text-white/40 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30 transition-colors"
              title="Remove row"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        disabled={draftRows.length >= MAX_ROWS}
        className="w-full flex items-center justify-center gap-1 py-1 mb-2 rounded border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 disabled:opacity-30 text-[11px] text-white/50 transition-colors"
      >
        <Plus size={11} /> Add row
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 rounded text-[11px] text-white/60 hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-accent-orange/20 text-accent-orange hover:bg-accent-orange/30 text-[11px] font-medium transition-colors"
        >
          <Check size={11} /> Apply
        </button>
      </div>
    </div>
  );
}
