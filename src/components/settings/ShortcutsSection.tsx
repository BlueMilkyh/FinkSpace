import { Layers, PanelTop, Bot, Info, Clipboard, Compass } from "lucide-react";

import { useSettingsStore } from "../../stores/settings-store";

interface ShortcutGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: { action: string; label: string }[];
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
      { action: "switchWorkspace1to9", label: "Switch to workspace 1\u20139" },
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

function KeyBadge({ keys }: { keys: string }) {
  // Split combo like "Ctrl+Shift+W" into individual badges
  const parts = keys.split("+");
  return (
    <div className="flex items-center gap-1">
      {parts.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-surface-border bg-surface text-xs font-mono text-white/70"
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}

export function ShortcutsSection() {
  const { settings } = useSettingsStore();

  return (
    <div>
      <h2 className="text-lg font-semibold text-primary mb-1">Keyboard Shortcuts</h2>
      <p className="text-sm text-secondary mb-6">
        Reference frequently used shortcuts for workspace and pane actions.
      </p>

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
                  <KeyBadge keys={settings.shortcuts?.[item.action] ?? ""} />
                </div>
              ))}
            </div>
          );
        })}

        {/* Footer info */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-surface-border/50 text-secondary">
          <Info size={14} className="shrink-0" />
          <span className="text-xs">Shortcuts shown match your current platform.</span>
        </div>
      </div>
    </div>
  );
}
