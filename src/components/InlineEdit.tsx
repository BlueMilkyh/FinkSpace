import { useState, useRef, useEffect } from "react";

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onStopEdit: () => void;
}

export function InlineEdit({
  value,
  onSave,
  className = "",
  isEditing,
  onStartEdit,
  onStopEdit,
}: InlineEditProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, value]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    onStopEdit();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onStopEdit();
        }}
        className={`bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-white outline-none focus:border-white/40 ${className}`}
        style={{ minWidth: "60px", width: `${Math.max(editValue.length, 6)}ch` }}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      className={`cursor-default ${className}`}
    >
      {value}
    </span>
  );
}
