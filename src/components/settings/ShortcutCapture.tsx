import { useEffect, useRef, useState } from "react";
import { RotateCcw, X, AlertTriangle } from "lucide-react";
import {
  formatShortcutFromEvent,
  isModifierOnly,
  isSafeShortcut,
  parseShortcut,
  serializeShortcut,
  shortcutToParts,
} from "../../lib/shortcuts";

interface ShortcutCaptureProps {
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
  /** Label of any other action this binding conflicts with, or null. */
  conflictWith?: string | null;
  /**
   * Range mode for `switchWorkspace1to9`: capture only modifier + digit,
   * display replaces the digit with "1..9".
   */
  rangeMode?: boolean;
}

export function ShortcutCapture({
  value,
  defaultValue,
  onChange,
  conflictWith,
  rangeMode,
}: ShortcutCaptureProps) {
  const [listening, setListening] = useState(false);
  const [livePreview, setLivePreview] = useState<string>("");
  const [warning, setWarning] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const isModified = value !== defaultValue;

  // Capture keystrokes while in listening mode
  useEffect(() => {
    if (!listening) return;
    setLivePreview("");

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Cancel
      if (e.key === "Escape") {
        setListening(false);
        setLivePreview("");
        return;
      }

      // Clear binding with Backspace/Delete (no modifiers)
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        onChange("");
        setListening(false);
        setLivePreview("");
        return;
      }

      // Modifier-only press → just update live preview
      if (isModifierOnly(e)) {
        const preview = serializeShortcut({
          ctrl: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
          key: "",
        });
        setLivePreview(preview);
        return;
      }

      // Full keystroke → build shortcut
      const shortcut = formatShortcutFromEvent(e);
      if (!shortcut) return;

      // Range mode: require a digit 1-9
      if (rangeMode) {
        const parsed = parseShortcut(shortcut);
        if (!/^[1-9]$/.test(parsed.key)) {
          setWarning("Press a modifier + 1–9 for this action.");
          return;
        }
      }

      // Bare-key safety check — warn but allow
      if (!isSafeShortcut(shortcut)) {
        setWarning(
          `"${shortcut}" has no modifier. This will interfere with typing. Press again to confirm, or Escape to cancel.`,
        );
        // Arm a "press again to confirm" one-shot on the root element
        const confirmOnce = (ev: KeyboardEvent) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.key === "Escape") {
            setListening(false);
            setWarning(null);
            setLivePreview("");
            window.removeEventListener("keydown", confirmOnce, true);
            return;
          }
          const again = formatShortcutFromEvent(ev);
          if (again === shortcut) {
            onChange(shortcut);
            setListening(false);
            setWarning(null);
            setLivePreview("");
            window.removeEventListener("keydown", confirmOnce, true);
          }
        };
        window.removeEventListener("keydown", handler, true);
        window.addEventListener("keydown", confirmOnce, true);
        return;
      }

      onChange(shortcut);
      setListening(false);
      setLivePreview("");
      setWarning(null);
    };

    window.addEventListener("keydown", handler, true);

    // Click-outside cancels
    const clickAway = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setListening(false);
        setLivePreview("");
        setWarning(null);
      }
    };
    window.addEventListener("mousedown", clickAway, true);

    return () => {
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("mousedown", clickAway, true);
    };
  }, [listening, onChange, rangeMode]);

  // Render helpers
  const displayParts = (() => {
    if (listening) {
      return livePreview ? shortcutToParts(livePreview) : [];
    }
    if (!value) return [];
    if (rangeMode) {
      // Replace the stored digit with "1..9" for display
      const parsed = parseShortcut(value);
      const modsOnly = serializeShortcut({ ...parsed, key: "" });
      const parts = shortcutToParts(modsOnly);
      parts.push("1..9");
      return parts;
    }
    return shortcutToParts(value);
  })();

  const conflictBorder = conflictWith
    ? "border-red-500/60"
    : "border-surface-border";

  return (
    <div className="flex items-center gap-2" ref={rootRef}>
      {warning && (
        <span
          className="flex items-center gap-1 text-[10px] text-amber-400 max-w-[220px]"
          title={warning}
        >
          <AlertTriangle size={12} className="shrink-0" />
          <span className="truncate">{warning}</span>
        </span>
      )}

      <button
        type="button"
        onClick={() => setListening(true)}
        title={
          conflictWith
            ? `Conflicts with: ${conflictWith}`
            : listening
              ? "Press a key combination, or Escape to cancel"
              : "Click to rebind"
        }
        className={`group flex items-center gap-1 min-h-[28px] px-1.5 py-0.5 rounded border ${conflictBorder} bg-surface hover:bg-surface-light transition-colors ${
          listening ? "ring-1 ring-accent-orange/60 animate-pulse" : ""
        }`}
      >
        {displayParts.length > 0 ? (
          displayParts.map((part, i) => (
            <kbd
              key={i}
              className="inline-flex items-center justify-center min-w-[24px] h-5 px-1 rounded bg-surface-light/60 text-[11px] font-mono text-white/80"
            >
              {part}
            </kbd>
          ))
        ) : listening ? (
          <span className="text-[11px] text-white/50 px-1">Press keys…</span>
        ) : (
          <span className="text-[11px] text-white/30 px-1">+ Add shortcut</span>
        )}
      </button>

      {/* Clear */}
      {value && !listening && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear binding"
          className="p-0.5 rounded text-white/30 hover:text-white/70 hover:bg-surface-light"
        >
          <X size={14} />
        </button>
      )}

      {/* Reset per row */}
      {isModified && !listening && (
        <button
          type="button"
          onClick={() => onChange(defaultValue)}
          title={`Reset to default (${defaultValue})`}
          className="p-0.5 rounded text-white/30 hover:text-white/70 hover:bg-surface-light"
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}
