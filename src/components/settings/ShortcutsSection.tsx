import { useMemo, useState } from "react";
import {
  Layers,
  PanelTop,
  Bot,
  Info,
  Clipboard,
  Compass,
  RotateCcw,
} from "lucide-react";

import { defaultShortcuts, useSettingsStore } from "../../stores/settings-store";
import { ShortcutCapture } from "./ShortcutCapture";
import { parseShortcut, serializeShortcut } from "../../lib/shortcuts";

interface ShortcutItem {
  action: string;
  label: string;
  /** Range shortcut — handler extracts only the modifier prefix. */
  rangeMode?: boolean;
}

interface ShortcutGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: "navigation",
    label: "Navigation",
    icon: Compass,
    items: [
      { action: "openFinkSpace", label: "Open FinkSpace" },
      { action: "openFinkSwarm", label: "Open FinkSwarm" },
    ],
  },
  {
    id: "workspaces",
    label: "Workspaces",
    icon: Layers,
    items: [
      { action: "newWorkspace", label: "New workspace tab" },
      { action: "closeWorkspace", label: "Close workspace" },
      { action: "switchWorkspace1to9", label: "Switch to workspace 1\u20139", rangeMode: true },
      { action: "nextWorkspace", label: "Next workspace" },
      { action: "previousWorkspace", label: "Previous workspace" },
    ],
  },
  {
    id: "panes",
    label: "Panes",
    icon: PanelTop,
    items: [
      { action: "newSession", label: "New session" },
      { action: "splitHorizontal", label: "Split horizontal" },
      { action: "splitVertical", label: "Split vertical" },
      { action: "closePane", label: "Close active pane" },
      { action: "nextPane", label: "Next pane" },
      { action: "previousPane", label: "Previous pane" },
    ],
  },
  {
    id: "clipboard",
    label: "Clipboard",
    icon: Clipboard,
    items: [
      { action: "copy", label: "Copy selection" },
      { action: "paste", label: "Paste from clipboard" },
    ],
  },
  {
    id: "ai",
    label: "AI Features",
    icon: Bot,
    items: [
      { action: "aiAssistance", label: "AI assistance" },
    ],
  },
];

/** Build a map of action → label for all known actions (used for conflict tooltips). */
const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  SHORTCUT_GROUPS.flatMap((g) => g.items.map((i) => [i.action, i.label])),
);

/**
 * Produce the set of concrete keystroke signatures a binding would trigger on.
 * Two bindings conflict iff their trigger sets intersect.
 *
 * For a non-range binding "Alt+T" → {"Alt+T"}.
 * For a range binding "Alt+1" → {"Alt+1","Alt+2",...,"Alt+9"} (modifier + any digit).
 */
function triggerSignatures(action: string, binding: string): string[] {
  if (!binding) return [];
  const isRange =
    SHORTCUT_GROUPS.flatMap((g) => g.items).find((i) => i.action === action)
      ?.rangeMode ?? false;
  const parsed = parseShortcut(binding);
  if (!parsed.key) return [];
  if (isRange) {
    return Array.from({ length: 9 }, (_, i) =>
      serializeShortcut({ ...parsed, key: String(i + 1) }),
    );
  }
  return [serializeShortcut(parsed)];
}

export function ShortcutsSection() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const shortcuts = settings.shortcuts ?? {};

  // Build: for each action → the other action it conflicts with (if any).
  const conflictMap = useMemo(() => {
    // Map from trigger signature → list of actions that handle it.
    const bucket = new Map<string, Set<string>>();
    for (const [action, binding] of Object.entries(shortcuts)) {
      for (const sig of triggerSignatures(action, binding)) {
        const set = bucket.get(sig) ?? new Set<string>();
        set.add(action);
        bucket.set(sig, set);
      }
    }
    const map: Record<string, string | null> = {};
    for (const [, actions] of bucket) {
      if (actions.size < 2) continue;
      const arr = Array.from(actions);
      for (const a of arr) {
        if (map[a]) continue; // keep first-found conflict label
        const other = arr.find((x) => x !== a);
        if (other) map[a] = ACTION_LABELS[other] ?? other;
      }
    }
    return map;
  }, [shortcuts]);

  const setBinding = (action: string, value: string) => {
    updateSetting("shortcuts", { ...shortcuts, [action]: value });
  };

  const resetAll = () => {
    updateSetting("shortcuts", { ...defaultShortcuts });
    setConfirmingReset(false);
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-primary mb-1">
            Keyboard Shortcuts
          </h2>
          <p className="text-sm text-secondary">
            Click any shortcut to rebind it. Press Escape to cancel, Backspace
            to clear.
          </p>
        </div>
        {confirmingReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Reset all to defaults?</span>
            <button
              onClick={resetAll}
              className="px-2 py-1 rounded text-xs bg-red-500/20 border border-red-500/50 text-red-300 hover:bg-red-500/30"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="px-2 py-1 rounded text-xs border border-surface-border text-white/60 hover:bg-surface-light"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingReset(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs border border-surface-border text-white/60 hover:bg-surface-light hover:text-white/90 shrink-0"
          >
            <RotateCcw size={12} />
            Reset all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {SHORTCUT_GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div
              key={group.id}
              className="rounded-lg border border-surface-border overflow-hidden"
            >
              {/* Group Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-light/50">
                <div className="flex items-center gap-2">
                  <Icon size={16} className="text-white/50" />
                  <span className="text-sm font-semibold text-primary">
                    {group.label}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full border border-surface-border text-secondary">
                  {group.items.length}
                </span>
              </div>

              {/* Shortcuts */}
              {group.items.map((item, idx) => (
                <div
                  key={item.action}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx < group.items.length - 1
                      ? "border-b border-surface-border/30"
                      : ""
                  }`}
                >
                  <span className="text-sm text-white/80">{item.label}</span>
                  <ShortcutCapture
                    value={shortcuts[item.action] ?? ""}
                    defaultValue={defaultShortcuts[item.action] ?? ""}
                    onChange={(v) => setBinding(item.action, v)}
                    conflictWith={conflictMap[item.action] ?? null}
                    rangeMode={item.rangeMode}
                  />
                </div>
              ))}
            </div>
          );
        })}

        {/* Footer info */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-surface-border/50 text-secondary">
          <Info size={14} className="shrink-0" />
          <span className="text-xs">
            Shortcuts shown match your current platform. Bindings are stored
            portably — Ctrl maps to ⌘ on macOS automatically.
          </span>
        </div>
      </div>
    </div>
  );
}
