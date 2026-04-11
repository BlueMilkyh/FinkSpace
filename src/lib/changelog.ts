export type ChangeType = "added" | "fixed" | "improved" | "changed" | "removed";
export type ProductTag = "FinkSpace" | "FinkSwarm" | "Both";

export interface ChangeItem {
  type: ChangeType;
  text: string;
  product?: ProductTag;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  product: ProductTag;
  highlights?: string;
  changes: ChangeItem[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.2.2",
    date: "2026-04-11",
    product: "Both",
    highlights: "FinkSwarm console improvements & scroll fix",
    changes: [
      { type: "improved", text: "SwarmConsole no longer auto-scrolls when user has scrolled up — messages arrive without hijacking scroll position", product: "FinkSwarm" },
      { type: "improved", text: "SwarmConsole: per-agent targeting, message detail modal, copy-to-clipboard, role-numbered labels (BUILDER 1, BUILDER 2…)", product: "FinkSwarm" },
      { type: "fixed", text: "scrollIntoView was walking up the DOM and scrolling the whole window on startup", product: "FinkSwarm" },
    ],
  },
  {
    version: "0.2.1",
    date: "2026-04-08",
    product: "FinkSpace",
    highlights: "App icon fix for packaged builds",
    changes: [
      { type: "fixed", text: "App icon was missing in production builds — now imported as a Vite ES module asset instead of a runtime path reference", product: "FinkSpace" },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-04-07",
    product: "Both",
    highlights: "FinkSwarm launch + major FinkSpace improvements",
    changes: [
      { type: "added", text: "FinkSwarm — multi-agent orchestration with star topology (Coordinator + Builders / Scouts / Reviewers)", product: "FinkSwarm" },
      { type: "added", text: "SwarmWizard: configure mission, agents, knowledge base, and CLI per agent", product: "FinkSwarm" },
      { type: "added", text: "SwarmDashboard: live agent status, role badges, per-agent terminal modals", product: "FinkSwarm" },
      { type: "added", text: "SwarmGraph: visual topology of active agents and their communication", product: "FinkSwarm" },
      { type: "added", text: "SwarmConsole: real-time broadcast log with protocol-marker routing", product: "FinkSwarm" },
      { type: "improved", text: "Workspace tabs now support drag-and-drop reordering via @dnd-kit", product: "FinkSpace" },
      { type: "improved", text: "Agent grid layout engine supports arbitrary split configurations", product: "FinkSpace" },
      { type: "added", text: "Keyboard shortcut system fully customisable — all bindings editable in Settings → Shortcuts", product: "FinkSpace" },
      { type: "added", text: "API Keys section in Settings", product: "FinkSpace" },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03-20",
    product: "FinkSpace",
    highlights: "Initial release",
    changes: [
      { type: "added", text: "Terminal workspace grid — spawn multiple AI coding agents (Claude Code, Codex, Gemini, Aider…) side by side", product: "FinkSpace" },
      { type: "added", text: "PTY backend via Tauri (spawn, write, kill, resize) — native terminal emulation with xterm.js WebGL renderer", product: "FinkSpace" },
      { type: "added", text: "Multiple workspaces with draggable tabs", product: "FinkSpace" },
      { type: "added", text: "Built-in Kanban board for project tracking", product: "FinkSpace" },
      { type: "added", text: "Settings panel: appearance, shortcuts, AI agents, CLI, terminal, API keys", product: "FinkSpace" },
      { type: "added", text: "Auto-updater with progress toast", product: "FinkSpace" },
    ],
  },
];
