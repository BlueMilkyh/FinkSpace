import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { ColorPicker } from "./ColorPicker";

interface TabContextMenuProps {
  x: number;
  y: number;
  name: string;
  color: string;
  onRename: (name: string) => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
}

export function TabContextMenu({
  x,
  y,
  name,
  color,
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

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 160);

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
