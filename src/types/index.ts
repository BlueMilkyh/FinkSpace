export type AgentStatus = "running" | "idle" | "exited" | "error" | "pending";

export interface TerminalType {
  id: string;
  name: string;
  icon: string;
  command: string;
  args: string[];
  description: string;
}

// Platform-specific terminal types are built at runtime
import { getPlatform } from "../lib/platform";

const WINDOWS_TERMINALS: TerminalType[] = [
  { id: "claude", name: "Claude Code", icon: "Bot", command: "claude", args: [], description: "Anthropic Claude Code CLI" },
  { id: "powershell", name: "PowerShell", icon: "Terminal", command: "powershell.exe", args: ["-NoLogo"], description: "Windows PowerShell" },
  { id: "cmd", name: "Command Prompt", icon: "SquareTerminal", command: "cmd.exe", args: [], description: "Windows CMD" },
  { id: "bash", name: "Git Bash", icon: "Terminal", command: "C:\\Program Files\\Git\\bin\\bash.exe", args: ["--login"], description: "Git Bash" },
  { id: "wsl", name: "WSL", icon: "Terminal", command: "wsl.exe", args: [], description: "Windows Subsystem for Linux" },
];

const MACOS_TERMINALS: TerminalType[] = [
  { id: "claude", name: "Claude Code", icon: "Bot", command: "claude", args: [], description: "Anthropic Claude Code CLI" },
  { id: "zsh", name: "Zsh", icon: "Terminal", command: "/bin/zsh", args: ["--login"], description: "Default macOS shell" },
  { id: "bash", name: "Bash", icon: "Terminal", command: "/bin/bash", args: ["--login"], description: "Bash shell" },
  { id: "fish", name: "Fish", icon: "Terminal", command: "fish", args: [], description: "Fish shell" },
];

const LINUX_TERMINALS: TerminalType[] = [
  { id: "claude", name: "Claude Code", icon: "Bot", command: "claude", args: [], description: "Anthropic Claude Code CLI" },
  { id: "bash", name: "Bash", icon: "Terminal", command: "/bin/bash", args: ["--login"], description: "Bash shell" },
  { id: "zsh", name: "Zsh", icon: "Terminal", command: "/bin/zsh", args: ["--login"], description: "Zsh shell" },
  { id: "fish", name: "Fish", icon: "Terminal", command: "fish", args: [], description: "Fish shell" },
];

export function getTerminalTypes(): TerminalType[] {
  const p = getPlatform();
  if (p === "macos") return MACOS_TERMINALS;
  if (p === "linux") return LINUX_TERMINALS;
  return WINDOWS_TERMINALS;
}

// Kept for backward compat — returns current platform's types
export let TERMINAL_TYPES: TerminalType[] = WINDOWS_TERMINALS;

export function refreshTerminalTypes() {
  TERMINAL_TYPES = getTerminalTypes();
}

export interface TerminalLayout {
  id: string;
  name: string;
  rows: number[]; // columns per row, e.g. [2, 3] = 2 top, 3 bottom
}

export const TERMINAL_LAYOUTS: TerminalLayout[] = [
  { id: "auto", name: "Auto", rows: [] },
  { id: "1", name: "Single", rows: [1] },
  { id: "2h", name: "2 Columns", rows: [2] },
  { id: "2v", name: "2 Rows", rows: [1, 1] },
  { id: "3", name: "3 Columns", rows: [3] },
  { id: "1-2", name: "1 + 2", rows: [1, 2] },
  { id: "2-1", name: "2 + 1", rows: [2, 1] },
  { id: "2-2", name: "2 x 2", rows: [2, 2] },
  { id: "2-3", name: "2 + 3", rows: [2, 3] },
  { id: "3-2", name: "3 + 2", rows: [3, 2] },
  { id: "3-3", name: "3 x 3", rows: [3, 3] },
  { id: "1-3", name: "1 + 3", rows: [1, 3] },
  { id: "3-1", name: "3 + 1", rows: [3, 1] },
];

export interface Agent {
  id: string;
  name: string;
  color: string;
  status: AgentStatus;
  workDir: string;
  terminalType: string;
  command: string;
  args: string[];
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  workDir: string; // root folder for this workspace
  agents: Agent[];
}

// ── Kanban ──────────────────────────────────────────────

export type KanbanPriority = "none" | "low" | "medium" | "high" | "urgent";

export interface KanbanLabel {
  id: string;
  name: string;
  color: string; // hex color
}

export const DEFAULT_LABELS: KanbanLabel[] = [
  { id: "bug", name: "Bug", color: "#e74c3c" },
  { id: "feature", name: "Feature", color: "#3498db" },
  { id: "improvement", name: "Improvement", color: "#2ecc71" },
  { id: "docs", name: "Docs", color: "#9b59b6" },
  { id: "urgent", name: "Urgent", color: "#e67e22" },
  { id: "design", name: "Design", color: "#1abc9c" },
];

export interface KanbanChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  priority: KanbanPriority;
  dueDate: string | null; // ISO date string
  checklist: KanbanChecklistItem[];
  createdAt: string; // ISO timestamp
}

export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

export interface KanbanBoard {
  id: string;
  name: string;
  columns: KanbanColumn[];
  labels: KanbanLabel[];
}

export interface AgentOutputEvent {
  id: string;
  data: string; // base64 encoded
}

export interface AgentExitedEvent {
  id: string;
  code: number | null;
}
