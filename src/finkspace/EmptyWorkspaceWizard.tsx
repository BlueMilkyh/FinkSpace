import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  Minus,
  Sliders,
  X,
  Zap,
  Bot,
  Users,
  Grid3x3,
  Terminal as TerminalIcon,
  Sparkles,
  Gem,
  MousePointer2,
} from "lucide-react";
import { useWorkspaceStore } from "./workspace-store";
import { useSettingsStore } from "../stores/settings-store";
import { TERMINAL_TYPES } from "../types";
import { CdInput } from "../components/CdInput";

const CUSTOM_LAYOUT_ID = "custom";
const MAX_CUSTOM_ROWS = 6;
const MAX_CUSTOM_COLS = 8;

interface LayoutTemplate {
  id: string; // matches an id in TERMINAL_LAYOUTS
  count: number;
  rows: number;
  cols: number;
  label: string;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  { id: "1", count: 1, rows: 1, cols: 1, label: "Single" },
  { id: "2h", count: 2, rows: 1, cols: 2, label: "2 Sessions" },
  { id: "2-2", count: 4, rows: 2, cols: 2, label: "4 Sessions" },
  { id: "3-3", count: 6, rows: 2, cols: 3, label: "6 Sessions" },
  { id: "4-4", count: 8, rows: 2, cols: 4, label: "8 Sessions" },
  { id: "5-5", count: 10, rows: 2, cols: 5, label: "10 Sessions" },
  { id: "4-4-4", count: 12, rows: 3, cols: 4, label: "12 Sessions" },
  { id: "7-7", count: 14, rows: 2, cols: 7, label: "14 Sessions" },
];

interface QuickPreset {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  layoutId: string;
  agents: { ttId: string; count: number }[];
}

const QUICK_PRESETS: QuickPreset[] = [
  {
    id: "solo",
    label: "Solo Claude",
    description: "Single focused session",
    icon: Bot,
    layoutId: "1",
    agents: [{ ttId: "claude", count: 1 }],
  },
  {
    id: "pair",
    label: "Claude Pair",
    description: "Two side by side",
    icon: Users,
    layoutId: "2h",
    agents: [{ ttId: "claude", count: 2 }],
  },
  {
    id: "squad",
    label: "Claude Squad",
    description: "Quad agent grid",
    icon: Grid3x3,
    layoutId: "2-2",
    agents: [{ ttId: "claude", count: 4 }],
  },
  {
    id: "code-shell",
    label: "Code + Shell",
    description: "Claude beside a terminal",
    icon: TerminalIcon,
    layoutId: "2h",
    // The shell type is resolved at click time using the platform's default.
    agents: [
      { ttId: "claude", count: 1 },
      { ttId: "__shell__", count: 1 },
    ],
  },
  {
    id: "mixed-stack",
    label: "Mixed Stack",
    description: "Half AI, half manual",
    icon: Grid3x3,
    layoutId: "2-2",
    agents: [
      { ttId: "claude", count: 2 },
      { ttId: "__shell__", count: 2 },
    ],
  },
  {
    id: "hex-swarm",
    label: "Hex Swarm",
    description: "Six agents, two rows",
    icon: Grid3x3,
    layoutId: "3-3",
    agents: [{ ttId: "claude", count: 6 }],
  },
  {
    id: "octo",
    label: "Octo",
    description: "Eight agents in 2×4",
    icon: Grid3x3,
    layoutId: "4-4",
    agents: [{ ttId: "claude", count: 8 }],
  },
  {
    id: "ai-trio",
    label: "AI Trio",
    description: "Claude, Codex, Gemini",
    icon: Sparkles,
    layoutId: "3",
    agents: [
      { ttId: "claude", count: 1 },
      { ttId: "codex", count: 1 },
      { ttId: "gemini", count: 1 },
    ],
  },
  {
    id: "ai-arena",
    label: "AI Arena",
    description: "All four AI CLIs",
    icon: Gem,
    layoutId: "2-2",
    agents: [
      { ttId: "claude", count: 1 },
      { ttId: "codex", count: 1 },
      { ttId: "gemini", count: 1 },
      { ttId: "cursor", count: 1 },
    ],
  },
  {
    id: "codex-pair",
    label: "Codex Pair",
    description: "Two Codex sessions",
    icon: Sparkles,
    layoutId: "2h",
    agents: [{ ttId: "codex", count: 2 }],
  },
  {
    id: "cursor-pair",
    label: "Cursor Pair",
    description: "Two Cursor sessions",
    icon: MousePointer2,
    layoutId: "2h",
    agents: [{ ttId: "cursor", count: 2 }],
  },
];

/** Resolve a preset agent's display name (handles the __shell__ placeholder). */
function presetAgentName(ttId: string): string {
  if (ttId === "__shell__") {
    const t = TERMINAL_TYPES.find((t) => t.id !== "claude") ?? TERMINAL_TYPES[0];
    return t?.name ?? "Shell";
  }
  return TERMINAL_TYPES.find((t) => t.id === ttId)?.name ?? ttId;
}

function presetBreakdown(preset: QuickPreset): string {
  return preset.agents
    .map((a) => `${a.count}× ${presetAgentName(a.ttId)}`)
    .join(", ");
}

function presetSlots(preset: QuickPreset): number {
  const tpl = LAYOUT_TEMPLATES.find((t) => t.id === preset.layoutId);
  return tpl?.count ?? preset.agents.reduce((s, a) => s + a.count, 0);
}

interface EmptyWorkspaceWizardProps {
  workspaceId: string;
}

export function EmptyWorkspaceWizard({ workspaceId }: EmptyWorkspaceWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [layoutId, setLayoutId] = useState<string>("3-3");
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});

  const workDir = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.workDir ?? "",
  );
  const setWorkspaceDir = useWorkspaceStore((s) => s.setWorkspaceDir);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const addAgent = useWorkspaceStore((s) => s.addAgent);
  const addPendingAgent = useWorkspaceStore((s) => s.addPendingAgent);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const workspaceCount = useWorkspaceStore((s) => s.workspaces.length);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const defaultWorkDir = useSettingsStore((s) => s.settings.defaultWorkDir);
  const persistedCustomRows = useSettingsStore((s) => s.settings.customLayoutRows);

  // Local draft for custom layout — only persisted on launch
  const [customRows, setCustomRows] = useState<number[]>(
    persistedCustomRows && persistedCustomRows.length > 0 ? persistedCustomRows : [2, 2],
  );

  const isCustom = layoutId === CUSTOM_LAYOUT_ID;
  const selectedTemplate =
    LAYOUT_TEMPLATES.find((t) => t.id === layoutId) ?? LAYOUT_TEMPLATES[3];
  const totalSlots = isCustom
    ? customRows.reduce((a, b) => a + b, 0)
    : selectedTemplate.count;
  const usedSlots = Object.values(agentCounts).reduce((a, b) => a + b, 0);

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Working Directory",
    });
    if (selected && typeof selected === "string") {
      setWorkspaceDir(workspaceId, selected);
      const folderName =
        selected.split(/[\\/]/).filter(Boolean).pop() ?? selected;
      renameWorkspace(workspaceId, folderName);
    }
  };

  const setCount = (id: string, value: number) => {
    setAgentCounts((prev) => {
      const next = { ...prev, [id]: Math.max(0, value) };
      // Cap total to totalSlots
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      if (total > totalSlots) {
        next[id] -= total - totalSlots;
      }
      return next;
    });
  };

  const incCount = (id: string) => {
    if (usedSlots >= totalSlots) return;
    setCount(id, (agentCounts[id] ?? 0) + 1);
  };

  const decCount = (id: string) => {
    setCount(id, (agentCounts[id] ?? 0) - 1);
  };

  const setAllForType = (id: string) => {
    const current = agentCounts[id] ?? 0;
    const remainingForOthers = usedSlots - current;
    const target = totalSlots - remainingForOthers;
    setAgentCounts((prev) => ({ ...prev, [id]: target }));
  };

  const selectAll = () => {
    // 1 of each first; if room left, fill the first type with the remainder
    const counts: Record<string, number> = {};
    let remaining = totalSlots;
    for (const tt of TERMINAL_TYPES) {
      if (remaining <= 0) break;
      counts[tt.id] = 1;
      remaining--;
    }
    if (remaining > 0 && TERMINAL_TYPES.length > 0) {
      counts[TERMINAL_TYPES[0].id] = (counts[TERMINAL_TYPES[0].id] ?? 0) + remaining;
    }
    setAgentCounts(counts);
  };

  const oneEach = () => {
    const counts: Record<string, number> = {};
    let remaining = totalSlots;
    for (const tt of TERMINAL_TYPES) {
      if (remaining <= 0) break;
      counts[tt.id] = 1;
      remaining--;
    }
    setAgentCounts(counts);
  };

  const fillEvenly = () => {
    const counts: Record<string, number> = {};
    const n = TERMINAL_TYPES.length;
    if (n === 0) return;
    const per = Math.floor(totalSlots / n);
    let remainder = totalSlots - per * n;
    for (const tt of TERMINAL_TYPES) {
      counts[tt.id] = per + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
    }
    setAgentCounts(counts);
  };

  const handleCancel = () => {
    if (workspaceCount > 1) removeWorkspace(workspaceId);
  };

  const runQuickPreset = (preset: QuickPreset) => {
    updateSetting("terminalLayout", preset.layoutId);
    const dir = workDir || defaultWorkDir;

    // Resolve the platform's default shell terminal type for the "__shell__" placeholder.
    const shellType =
      TERMINAL_TYPES.find((t) => t.id !== "claude") ?? TERMINAL_TYPES[0];

    let spawned = 0;
    for (const { ttId, count } of preset.agents) {
      const tt =
        ttId === "__shell__"
          ? shellType
          : TERMINAL_TYPES.find((t) => t.id === ttId);
      if (!tt) continue;
      for (let i = 0; i < count; i++) {
        const idxLabel = count === 1 ? "" : ` ${i + 1}`;
        addAgent({
          workspaceId,
          name: tt.name + idxLabel,
          workDir: dir,
          terminalType: tt,
        });
        spawned++;
      }
    }

    // Fill any remaining slots in the layout with pending agents.
    const tpl = LAYOUT_TEMPLATES.find((t) => t.id === preset.layoutId);
    const slots = tpl?.count ?? spawned;
    for (let i = spawned; i < slots; i++) {
      addPendingAgent(workspaceId);
    }
  };

  const launch = (skipAgents: boolean) => {
    if (isCustom) {
      const cleaned = customRows
        .filter((n) => n >= 1)
        .map((n) => Math.min(MAX_CUSTOM_COLS, Math.max(1, Math.floor(n))));
      if (cleaned.length === 0) return;
      updateSetting("customLayoutRows", cleaned);
    }
    updateSetting("terminalLayout", layoutId);
    const dir = workDir || defaultWorkDir;

    if (skipAgents) {
      for (let i = 0; i < totalSlots; i++) {
        addPendingAgent(workspaceId);
      }
      return;
    }

    // Spawn requested agents
    let spawned = 0;
    for (const tt of TERMINAL_TYPES) {
      const count = agentCounts[tt.id] ?? 0;
      for (let i = 0; i < count; i++) {
        const idxLabel = count === 1 ? "" : ` ${i + 1}`;
        addAgent({
          workspaceId,
          name: tt.name + idxLabel,
          workDir: dir,
          terminalType: tt,
        });
        spawned++;
      }
    }
    // Fill remaining slots with pending agents
    for (let i = spawned; i < totalSlots; i++) {
      addPendingAgent(workspaceId);
    }
  };

  // ── Step 1: Configure Layout ─────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="absolute inset-0 flex flex-col p-6 overflow-auto">
        <ProgressBar step={1} />
        <header className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-white">Configure Layout</h1>
          <p className="text-sm text-white/50 mt-1">
            Select a template and working directory.
          </p>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl w-full mx-auto">
          {/* Working directory */}
          <section className="flex flex-col gap-3">
            <SectionLabel>Working Directory</SectionLabel>
            <button
              onClick={handleBrowse}
              className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-surface-border bg-surface-light hover:bg-surface-lighter cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen size={16} className="text-white/40 shrink-0" />
                <span className="text-sm font-mono text-white/70 truncate">
                  {workDir || "No folder selected"}
                </span>
              </div>
              <span className="text-[10px] tracking-widest font-semibold uppercase text-white/60 px-2 py-1 rounded bg-white/5 border border-surface-border shrink-0">
                Browse
              </span>
            </button>

            {/* Mini cd shell — navigate folders without the picker */}
            <CdInput
              cwd={workDir}
              onChange={(newDir) => {
                setWorkspaceDir(workspaceId, newDir);
                const folderName =
                  newDir.split(/[\\/]/).filter(Boolean).pop() ?? newDir;
                renameWorkspace(workspaceId, folderName);
              }}
            />

            <p className="text-[11px] uppercase tracking-wider text-white/30">
              Browse, or type <span className="font-mono text-white/50">cd ..</span> /{" "}
              <span className="font-mono text-white/50">cd src</span> to navigate.
            </p>

            {/* Selected layout preview / custom editor */}
            <div className="mt-2 p-4 rounded-lg border border-surface-border bg-surface-light">
              {isCustom ? (
                <CustomLayoutEditor rows={customRows} setRows={setCustomRows} />
              ) : (
                <div className="flex items-center gap-4">
                  <LayoutPreview rows={selectedTemplate.rows} cols={selectedTemplate.cols} large />
                  <div>
                    <div className="text-base font-semibold text-white">
                      {selectedTemplate.count} Terminal{selectedTemplate.count > 1 ? "s" : ""}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {selectedTemplate.rows} row{selectedTemplate.rows > 1 ? "s" : ""}
                      {" × "}
                      {selectedTemplate.cols} column{selectedTemplate.cols > 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </section>

          {/* Layout templates */}
          <section className="flex flex-col gap-3">
            <SectionLabel>Layout Templates</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {LAYOUT_TEMPLATES.map((tpl) => {
                const isSelected = tpl.id === layoutId;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setLayoutId(tpl.id)}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "border-accent-orange bg-accent-orange/10"
                        : "border-surface-border bg-surface-light hover:border-white/20 hover:bg-surface-lighter"
                    }`}
                  >
                    <LayoutPreview rows={tpl.rows} cols={tpl.cols} />
                    <span
                      className={`text-xs font-medium ${
                        isSelected ? "text-accent-orange" : "text-white/60"
                      }`}
                    >
                      {tpl.label}
                    </span>
                  </button>
                );
              })}
              {/* Custom layout — opens editor in preview area */}
              <button
                onClick={() => setLayoutId(CUSTOM_LAYOUT_ID)}
                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                  isCustom
                    ? "border-accent-orange bg-accent-orange/10"
                    : "border-surface-border bg-surface-light hover:border-white/20 hover:bg-surface-lighter"
                }`}
              >
                {isCustom ? (
                  <FlexLayoutPreview rows={customRows} size={42} />
                ) : (
                  <div className="w-[42px] h-[42px] flex items-center justify-center">
                    <Sliders size={20} className="text-white/50" />
                  </div>
                )}
                <span
                  className={`text-xs font-medium ${
                    isCustom ? "text-accent-orange" : "text-white/60"
                  }`}
                >
                  Custom
                </span>
              </button>
            </div>
          </section>
        </div>

        {/* Quick presets — horizontal scroller of one-click workspace recipes. */}
        <section className="mt-6 max-w-5xl w-full mx-auto">
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Zap size={11} className="text-accent-orange" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40">
              Presets
            </span>
          </div>
          <div className="quick-presets-scroll flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
            {QUICK_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const slots = presetSlots(preset);
              const breakdown = presetBreakdown(preset);
              return (
                <button
                  key={preset.id}
                  onClick={() => runQuickPreset(preset)}
                  className="group snap-start shrink-0 w-[200px] text-left flex flex-col gap-1.5 p-3.5 rounded-xl border border-surface-border bg-surface-light hover:border-accent-orange/60 hover:bg-accent-orange/5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">
                      {preset.label}
                    </span>
                    <div className="w-7 h-7 rounded-md bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center group-hover:bg-accent-orange/20 transition-colors">
                      <Icon size={13} className="text-accent-orange" />
                    </div>
                  </div>
                  <span className="text-[11px] text-white/40">
                    {slots} Session{slots > 1 ? "s" : ""}
                  </span>
                  <span className="text-[11px] font-mono text-accent-orange/80 truncate" title={breakdown}>
                    {breakdown}
                  </span>
                  <span className="text-[10px] text-white/30 truncate flex items-center gap-1" title={workDir || "current folder"}>
                    <FolderOpen size={9} className="shrink-0" />
                    {workDir
                      ? workDir.split(/[\\/]/).filter(Boolean).pop()
                      : "current folder"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <footer className="flex items-center justify-between mt-4 max-w-5xl w-full mx-auto">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm uppercase tracking-wider font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => setStep(2)}
            className="px-5 py-2.5 rounded-lg bg-accent-orange text-white text-sm font-semibold uppercase tracking-wider hover:brightness-110 transition-all"
          >
            Configure Agents
          </button>
        </footer>
      </div>
    );
  }

  // ── Step 2: AI Agent Fleet ───────────────────────────────────────────
  return (
    <div className="absolute inset-0 flex flex-col p-6 overflow-auto">
      <ProgressBar step={2} />
      <header className="text-center mb-5">
        <h1 className="text-2xl font-semibold text-white">AI Agent Fleet</h1>
        <p className="text-sm text-white/50 mt-1">
          Provision agents for your {totalSlots} terminal session
          {totalSlots > 1 ? "s" : ""}.
        </p>
      </header>

      <div className="flex items-center justify-center gap-2 mb-4">
        <QuickButton onClick={selectAll}>Select All</QuickButton>
        <QuickButton onClick={oneEach}>1 Each</QuickButton>
        <QuickButton onClick={fillEvenly}>Fill Evenly</QuickButton>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-5xl w-full mx-auto">
        {/* Agent list */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          {TERMINAL_TYPES.map((tt) => {
            const count = agentCounts[tt.id] ?? 0;
            const checked = count > 0;
            return (
              <div
                key={tt.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-surface-border bg-surface-light hover:bg-surface-lighter transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setCount(tt.id, e.target.checked ? 1 : 0)}
                  className="w-4 h-4 rounded accent-accent-orange cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white/90">{tt.name}</div>
                  <div className="text-[11px] text-white/40 lowercase">{tt.id}</div>
                </div>
                <button
                  onClick={() => setAllForType(tt.id)}
                  className="px-2 py-1 text-[10px] tracking-wider font-semibold uppercase text-white/60 rounded bg-white/5 border border-surface-border hover:bg-white/10 transition-colors"
                >
                  All {totalSlots}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => decCount(tt.id)}
                    disabled={count === 0}
                    className="w-7 h-7 flex items-center justify-center rounded border border-surface-border bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-8 text-center text-sm font-mono text-white/80">
                    {count}
                  </span>
                  <button
                    onClick={() => incCount(tt.id)}
                    disabled={usedSlots >= totalSlots}
                    className="w-7 h-7 flex items-center justify-center rounded border border-surface-border bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fleet utilization */}
        <aside className="flex flex-col gap-3 p-4 rounded-lg border border-surface-border bg-surface-light h-fit">
          <SectionLabel>Fleet Utilization</SectionLabel>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white leading-none">{usedSlots}</span>
            <span className="text-sm text-white/40">/ {totalSlots} slots</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-accent-orange transition-all"
              style={{
                width: `${Math.min(100, (usedSlots / totalSlots) * 100)}%`,
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  usedSlots > 0 ? "bg-accent-orange" : "bg-white/30"
                }`}
              />
              {usedSlots === 0
                ? "No agents selected"
                : `${usedSlots} agent${usedSlots > 1 ? "s" : ""} selected`}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  usedSlots === totalSlots ? "bg-accent-green" : "bg-white/30"
                }`}
              />
              {usedSlots === totalSlots
                ? "Optimal slot density"
                : `${totalSlots - usedSlots} slot${
                    totalSlots - usedSlots > 1 ? "s" : ""
                  } remaining`}
            </div>
          </div>
        </aside>
      </div>

      <footer className="flex items-center justify-between mt-6 max-w-5xl w-full mx-auto">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm uppercase tracking-wider font-semibold text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => launch(true)}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/80 transition-colors uppercase tracking-wider font-semibold"
          >
            Skip Agents
          </button>
          <button
            onClick={() => launch(false)}
            disabled={usedSlots === 0}
            className="px-5 py-2.5 rounded-lg bg-accent-orange text-white text-sm font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Launch Workspace
          </button>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">
      {children}
    </div>
  );
}

function QuickButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-md border border-surface-border bg-surface-light hover:bg-surface-lighter text-[11px] font-semibold uppercase tracking-wider text-white/70 transition-colors"
    >
      {children}
    </button>
  );
}

function ProgressBar({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      <div className="h-1 w-16 rounded-full bg-accent-orange" />
      <div
        className={`h-1 w-16 rounded-full ${
          step === 2 ? "bg-accent-orange" : "bg-white/10"
        }`}
      />
    </div>
  );
}

/** Mini grid preview using rows × cols */
function LayoutPreview({
  rows,
  cols,
  large = false,
}: {
  rows: number;
  cols: number;
  large?: boolean;
}) {
  const size = large ? 56 : 42;
  return (
    <div
      className="grid bg-white/5 rounded p-1"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: 2,
        width: size,
        height: size,
      }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} className="rounded-sm bg-white/30" />
      ))}
    </div>
  );
}

/** Preview that supports non-uniform rows (e.g. [2, 3, 4]). */
function FlexLayoutPreview({ rows, size }: { rows: number[]; size: number }) {
  const gap = 2;
  if (rows.length === 0) return <div style={{ width: size, height: size }} />;
  const rowH = (size - gap * (rows.length - 1)) / rows.length;
  const cells: { x: number; y: number; w: number; h: number }[] = [];
  rows.forEach((cols, ri) => {
    if (cols < 1) return;
    const colW = (size - gap * (cols - 1)) / cols;
    const y = ri * (rowH + gap);
    for (let ci = 0; ci < cols; ci++) {
      cells.push({ x: ci * (colW + gap), y, w: colW, h: rowH });
    }
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          rx={1.5}
          className="fill-white/40"
        />
      ))}
    </svg>
  );
}

/** Inline editor for the custom layout — variable rows, variable cols per row. */
function CustomLayoutEditor({
  rows,
  setRows,
}: {
  rows: number[];
  setRows: (rows: number[]) => void;
}) {
  const totalSlots = rows.reduce((a, b) => a + b, 0);

  const setCol = (rowIdx: number, value: number) => {
    const next = [...rows];
    next[rowIdx] = Math.min(MAX_CUSTOM_COLS, Math.max(1, value));
    setRows(next);
  };
  const addRow = () => {
    if (rows.length >= MAX_CUSTOM_ROWS) return;
    setRows([...rows, 2]);
  };
  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header with live preview */}
      <div className="flex items-center gap-3">
        <FlexLayoutPreview rows={rows} size={56} />
        <div>
          <div className="text-base font-semibold text-white">
            {totalSlots} Terminal{totalSlots !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-white/50 mt-0.5">
            {rows.length} row{rows.length !== 1 ? "s" : ""} · [{rows.join(", ")}]
          </div>
        </div>
      </div>

      {/* Per-row column editors */}
      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
        {rows.map((cols, ri) => (
          <div key={ri} className="flex items-center gap-2 text-xs">
            <span className="text-white/40 w-12 shrink-0">Row {ri + 1}</span>
            <button
              onClick={() => setCol(ri, cols - 1)}
              disabled={cols <= 1}
              className="w-6 h-6 flex items-center justify-center rounded border border-surface-border bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Minus size={11} />
            </button>
            <span className="w-7 text-center font-mono text-sm text-white/80">{cols}</span>
            <button
              onClick={() => setCol(ri, cols + 1)}
              disabled={cols >= MAX_CUSTOM_COLS}
              className="w-6 h-6 flex items-center justify-center rounded border border-surface-border bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={11} />
            </button>
            <span className="text-white/30 text-[10px]">cols</span>
            <button
              onClick={() => removeRow(ri)}
              disabled={rows.length <= 1}
              className="ml-auto w-6 h-6 flex items-center justify-center rounded text-white/40 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Remove row"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        disabled={rows.length >= MAX_CUSTOM_ROWS}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-white/15 hover:border-white/30 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-[11px] uppercase tracking-wider font-semibold text-white/50 transition-colors"
      >
        <Plus size={12} /> Add Row
      </button>
    </div>
  );
}
