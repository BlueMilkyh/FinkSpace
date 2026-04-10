// ─── FinkSwarm Types ────────────────────────────────────────────────────
//
// A "swarm" is a coordinated team of CLI-backed AI agents working against
// a shared mission prompt inside a common working directory. Each agent is
// a real PTY process (same infrastructure used by FinkSpace) with an
// assigned role in a star topology: a Coordinator at the hub and Builder /
// Scout / Reviewer / Custom workers on the spokes.
//
// Coordination happens via protocol markers emitted by the agents on
// stdout — see swarm-manager.ts for the routing logic.

export type SwarmAgentRole =
  | "coordinator"
  | "builder"
  | "scout"
  | "reviewer"
  | "custom";

export type SwarmAgentCli =
  | "claude"
  | "codex"
  | "gemini"
  | "opencode"
  | "cursor";

export type SwarmAgentStatus =
  | "pending"
  | "running"
  | "idle"
  | "exited"
  | "error";

export type SwarmStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "error";

export interface SwarmAgent {
  id: string;
  role: SwarmAgentRole;
  customRole?: string; // populated when role === "custom"
  cli: SwarmAgentCli;
  autoApprove: boolean;
  status: SwarmAgentStatus;
  color: string;
}

export interface SwarmKnowledgeFile {
  id: string;
  path: string; // absolute path
  name: string;
  kind: "pdf" | "image" | "text" | "other";
}

export interface SwarmConfig {
  name: string;
  workDir: string;
  prompt: string;
  knowledge: SwarmKnowledgeFile[];
  agents: SwarmAgent[];
}

export interface SwarmMessage {
  id: string;
  swarmId: string;
  fromAgentId: string; // "user" | "system" | SwarmAgent.id
  toAgentId?: string; // undefined = broadcast / all
  text: string;
  createdAt: number;
}

export interface Swarm {
  id: string;
  config: SwarmConfig;
  status: SwarmStatus;
  createdAt: number;
  messages: SwarmMessage[];
}

// ─── Presets (the 5 / 10 / 15 / 20 / 50 buttons in the wizard) ──────────

export interface SwarmPreset {
  id: string;
  total: number;
  coordinators: number;
  builders: number;
  scouts: number;
  reviewers: number;
}

export const SWARM_PRESETS: SwarmPreset[] = [
  { id: "s5", total: 5, coordinators: 1, builders: 2, scouts: 1, reviewers: 1 },
  { id: "s10", total: 10, coordinators: 1, builders: 5, scouts: 2, reviewers: 2 },
  { id: "s15", total: 15, coordinators: 1, builders: 8, scouts: 3, reviewers: 3 },
  { id: "s20", total: 20, coordinators: 2, builders: 10, scouts: 4, reviewers: 4 },
  { id: "s50", total: 50, coordinators: 3, builders: 30, scouts: 8, reviewers: 9 },
];

// ─── Role metadata for UI (colors, labels, short missions) ──────────────

export interface RoleMeta {
  label: string;
  color: string;
  description: string;
}

export const ROLE_META: Record<SwarmAgentRole, RoleMeta> = {
  coordinator: {
    label: "COORDINATOR",
    color: "#f1c40f",
    description:
      "Plan the mission, split work into tasks, route peer messages, and decide when the swarm is done.",
  },
  builder: {
    label: "BUILDER",
    color: "#3498db",
    description: "Write and edit code to complete assigned tasks.",
  },
  scout: {
    label: "SCOUT",
    color: "#2ecc71",
    description:
      "Read the codebase and docs, gather facts, answer questions raised by the builders.",
  },
  reviewer: {
    label: "REVIEWER",
    color: "#e67e22",
    description:
      "Audit changes, run tests, surface issues before work is declared done.",
  },
  custom: {
    label: "CUSTOM",
    color: "#9b59b6",
    description: "User-defined role — see customRole field.",
  },
};

// ─── CLI metadata: command + auto-approve flag mapping ──────────────────

export interface CliMeta {
  label: string;
  command: string;
  autoApproveArgs: string[]; // extra args applied when agent.autoApprove is true
}

export const CLI_META: Record<SwarmAgentCli, CliMeta> = {
  claude: {
    label: "Claude",
    command: "claude",
    // `--permission-mode bypassPermissions` sets the same "do anything"
    // state as --dangerously-skip-permissions, but WITHOUT Claude's
    // first-launch "Bypass Permissions mode" warning dialog. That
    // dialog is hardcoded to the --dangerously-skip-permissions path
    // and can't be pre-accepted via config.
    autoApproveArgs: ["--permission-mode", "bypassPermissions"],
  },
  codex: {
    label: "Codex",
    command: "codex",
    autoApproveArgs: ["--full-auto"],
  },
  gemini: {
    label: "Gemini",
    command: "gemini",
    autoApproveArgs: ["--yolo"],
  },
  opencode: {
    label: "OpenCode",
    command: "opencode",
    autoApproveArgs: [],
  },
  cursor: {
    label: "Cursor",
    command: "cursor-agent",
    autoApproveArgs: [],
  },
};

export const SWARM_CLIS: SwarmAgentCli[] = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor",
];
