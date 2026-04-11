import { useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  ArrowRight,
  Type,
  FolderOpen,
  MessageSquare,
  BookOpen,
  Users,
  Zap,
  X,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileType,
  File as FileIcon,
  ChevronDown,
  EyeOff,
  Eye,
  Plus,
  Crown,
  Wrench,
  Search,
  Sparkles,
} from "lucide-react";
import { useSwarmStore, type WizardStep } from "./store";
import { useNavigationStore } from "../stores/navigation-store";
import {
  CLI_META,
  ROLE_META,
  SWARM_CLIS,
  SWARM_PRESETS,
  getAgentLabel,
  type SwarmAgent,
  type SwarmAgentCli,
  type SwarmAgentRole,
  type SwarmKnowledgeFile,
} from "./types";
import { CdInput } from "../components/CdInput";
import { startSwarm } from "./manager";

const STEP_LABELS: { label: string; icon: React.ElementType }[] = [
  { label: "NAME", icon: Type },
  { label: "DIRECTORY", icon: FolderOpen },
  { label: "PROMPT", icon: MessageSquare },
  { label: "KNOWLEDGE", icon: BookOpen },
  { label: "AGENTS", icon: Users },
];

const ROLE_ICONS: Record<SwarmAgentRole, React.ElementType> = {
  coordinator: Crown,
  builder: Wrench,
  scout: Search,
  reviewer: Eye,
  custom: Sparkles,
};

function inferKind(path: string): SwarmKnowledgeFile["kind"] {
  const ext = path.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(ext))
    return "image";
  if (["txt", "md", "json", "yml", "yaml", "ts", "tsx", "js", "jsx", "py", "rs", "go", "toml"].includes(ext))
    return "text";
  return "other";
}

export function SwarmWizard() {
  const draft = useSwarmStore((s) => s.draft);
  const step = useSwarmStore((s) => s.draftStep);
  const setStep = useSwarmStore((s) => s.setDraftStep);
  const updateDraft = useSwarmStore((s) => s.updateDraft);
  const cancelDraft = useSwarmStore((s) => s.cancelDraft);
  const launchDraft = useSwarmStore((s) => s.launchDraft);
  const applyPreset = useSwarmStore((s) => s.applyPreset);
  const setCliForAll = useSwarmStore((s) => s.setCliForAll);
  const addAgent = useSwarmStore((s) => s.addAgent);
  const updateAgent = useSwarmStore((s) => s.updateAgent);
  const removeAgent = useSwarmStore((s) => s.removeAgent);
  const swarms = useSwarmStore((s) => s.swarms);
  const goHome = useNavigationStore((s) => s.goHome);

  if (!draft) return null;

  const canNext = (() => {
    switch (step) {
      case 0:
        return draft.name.trim().length > 0;
      case 1:
        return draft.workDir.trim().length > 0;
      case 2:
        return draft.prompt.trim().length > 0;
      case 3:
        return true;
      case 4:
        return draft.agents.length > 0;
    }
  })();

  const handleNext = () => {
    if (step < 4) setStep(((step + 1) as WizardStep));
  };
  const handleBack = () => {
    if (step > 0) setStep(((step - 1) as WizardStep));
  };

  const handleLaunch = async () => {
    const id = launchDraft();
    if (!id) return;
    const launched = useSwarmStore.getState().swarms.find((s) => s.id === id);
    if (launched) {
      startSwarm(launched).catch((e) => {
        console.error("startSwarm failed", e);
        const store = useSwarmStore.getState();
        store.setSwarmStatus(id, "error");
        store.appendMessage({
          swarmId: id,
          fromAgentId: "system",
          text: `Swarm failed to start: ${String(e)}`,
        });
      });
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-surface overflow-auto">
      {/* Progress strip */}
      <div className="flex items-center justify-center gap-6 pt-10 pb-6 px-6">
        {STEP_LABELS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <button
              key={s.label}
              onClick={() => {
                // Allow jumping back to any previous step.
                if (i <= step) setStep((i as WizardStep));
              }}
              className={`flex items-center gap-2 text-xs font-semibold tracking-wider transition-colors ${
                isActive
                  ? "text-accent-orange"
                  : isDone
                    ? "text-accent-orange/60 hover:text-accent-orange"
                    : "text-white/30"
              }`}
            >
              <div
                className={`w-6 h-6 rounded flex items-center justify-center border ${
                  isActive
                    ? "border-accent-orange/60 bg-accent-orange/10"
                    : isDone
                      ? "border-accent-orange/30"
                      : "border-surface-border"
                }`}
              >
                <Icon size={12} />
              </div>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step content */}
      <div
        className={`flex-1 flex justify-center px-6 pb-10 ${
          step === 4 ? "items-start pt-2" : "items-center"
        }`}
      >
        <div className={`w-full ${step === 4 ? "max-w-4xl" : "max-w-2xl"}`}>
          {step === 0 && (
            <StepContainer
              icon={Type}
              title="Name your swarm"
              subtitle="Give your swarm a short, descriptive name to identify it in your workspace."
            >
              <input
                autoFocus
                type="text"
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder="API Security"
                className="w-full px-5 py-4 rounded-lg bg-surface-light border border-surface-border focus:border-accent-orange/50 focus:outline-none text-center text-lg font-medium text-white placeholder:text-white/30 transition-colors"
              />
            </StepContainer>
          )}

          {step === 1 && (
            <StepContainer
              icon={FolderOpen}
              title="Choose a directory"
              subtitle="Select the project folder your swarm agents will work in."
            >
              <button
                onClick={async () => {
                  const selected = await open({
                    directory: true,
                    multiple: false,
                    title: "Select Swarm Working Directory",
                  });
                  if (selected && typeof selected === "string") {
                    updateDraft({ workDir: selected });
                  }
                }}
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-lg bg-surface-light border border-surface-border hover:border-accent-orange/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FolderOpen size={18} className="text-accent-orange/80 shrink-0" />
                  <span className="text-sm font-mono text-white/80 truncate">
                    {draft.workDir || "Select a folder…"}
                  </span>
                </div>
                <span className="text-[10px] tracking-widest uppercase font-semibold text-white/60 px-2 py-1 rounded bg-white/5 border border-surface-border shrink-0">
                  Browse
                </span>
              </button>

              <div className="mt-4">
                <CdInput
                  cwd={draft.workDir}
                  onChange={(newDir) => updateDraft({ workDir: newDir })}
                />
              </div>

              <p className="text-[11px] uppercase tracking-wider text-white/30 mt-3 text-center">
                Use the browser above or jump with terminal-style navigation commands.
              </p>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              icon={MessageSquare}
              title="Swarm prompt"
              subtitle="Describe what you want this swarm to build or fix. This is shared with all agents as their mission brief."
            >
              <div className="relative">
                <textarea
                  autoFocus
                  value={draft.prompt}
                  onChange={(e) => updateDraft({ prompt: e.target.value })}
                  placeholder="What should this swarm accomplish? Agents will read this as their mission brief."
                  rows={8}
                  className="w-full px-5 py-4 rounded-lg bg-surface-light border border-accent-orange/20 focus:border-accent-orange/60 focus:outline-none text-white placeholder:text-white/30 resize-none transition-colors"
                />
                <div className="absolute bottom-3 right-4 text-[10px] text-white/30 font-mono">
                  {draft.prompt.length} chars
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-accent-orange/70 bg-accent-orange/5 border border-accent-orange/20 rounded-lg px-3 py-2">
                <Sparkles size={11} />
                Shared with all agents so they can coordinate and stay aligned.
              </div>
            </StepContainer>
          )}

          {step === 3 && (
            <StepContainer
              icon={BookOpen}
              title="Supporting knowledge"
              subtitle="Optionally attach files to give your swarm extra context — specs, logs, PDFs, images, etc."
            >
              <button
                onClick={async () => {
                  const selected = await open({
                    directory: false,
                    multiple: true,
                    title: "Attach knowledge files",
                  });
                  if (!selected) return;
                  const list = Array.isArray(selected) ? selected : [selected];
                  const existing = draft.knowledge.map((k) => k.path);
                  const toAdd: SwarmKnowledgeFile[] = list
                    .filter((p) => !existing.includes(p))
                    .map((path) => ({
                      id: crypto.randomUUID(),
                      path,
                      name: path.split(/[\\/]/).filter(Boolean).pop() ?? path,
                      kind: inferKind(path),
                    }));
                  updateDraft({ knowledge: [...draft.knowledge, ...toAdd] });
                }}
                className="w-full flex flex-col items-center justify-center gap-3 py-10 rounded-lg border-2 border-dashed border-white/15 hover:border-accent-orange/40 hover:bg-accent-orange/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center">
                  <UploadCloud size={20} className="text-accent-orange" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">
                    Add context files
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5">
                    Attach PDFs, logs, specs, or images to give your swarm a shared brain.
                  </div>
                </div>
              </button>

              {draft.knowledge.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                  {draft.knowledge.map((k) => {
                    const Icon =
                      k.kind === "pdf"
                        ? FileType
                        : k.kind === "image"
                          ? ImageIcon
                          : k.kind === "text"
                            ? FileText
                            : FileIcon;
                    return (
                      <div
                        key={k.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-light border border-surface-border"
                      >
                        <Icon size={14} className="text-accent-orange/70 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/90 truncate">{k.name}</div>
                          <div className="text-[10px] font-mono text-white/30 truncate">
                            {k.path}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            updateDraft({
                              knowledge: draft.knowledge.filter((x) => x.id !== k.id),
                            })
                          }
                          className="w-6 h-6 flex items-center justify-center rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </StepContainer>
          )}

          {step === 4 && (
            <AgentRosterStep
              draft={draft}
              applyPreset={applyPreset}
              setCliForAll={setCliForAll}
              addAgent={() => addAgent("__draft__")}
              updateAgent={(id, patch) => updateAgent("__draft__", id, patch)}
              removeAgent={(id) => removeAgent("__draft__", id)}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-8 py-5 border-t border-surface-border">
        <button
          onClick={() => {
            if (step === 0) {
              // No existing swarms → clearing the draft would just re-open the
              // wizard, so navigate home instead. Otherwise drop the draft and
              // fall back to the dashboard of the existing swarms.
              cancelDraft();
              if (swarms.length === 0) goHome();
            } else {
              handleBack();
            }
          }}
          className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-white/50 hover:text-white/80 transition-colors"
        >
          {step === 0 ? (
            <>
              <ArrowLeft size={14} /> {swarms.length === 0 ? "HOME" : "CANCEL"}
            </>
          ) : (
            <>
              <ArrowLeft size={14} /> BACK
            </>
          )}
        </button>

        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-white/30">
          STEP {step + 1} OF 5 · {STEP_LABELS[step].label}
        </div>

        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent-orange text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            NEXT <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={!canNext}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent-orange text-white text-xs font-semibold uppercase tracking-wider hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Zap size={14} /> LAUNCH SWARM
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step container with centered icon + title ─────────────────────────

function StepContainer({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-14 h-14 rounded-lg bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center">
        <Icon size={24} className="text-accent-orange" />
      </div>
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-white/50 mt-1.5 leading-relaxed">{subtitle}</p>
      </div>
      <div className="w-full mt-2">{children}</div>
    </div>
  );
}

// ─── Agent roster step (screenshots 5 + 6) ──────────────────────────────

interface RosterProps {
  draft: { agents: SwarmAgent[] };
  applyPreset: (presetId: string) => void;
  setCliForAll: (cli: SwarmAgentCli) => void;
  addAgent: () => void;
  updateAgent: (id: string, patch: Partial<SwarmAgent>) => void;
  removeAgent: (id: string) => void;
}

function AgentRosterStep({
  draft,
  applyPreset,
  setCliForAll,
  addAgent,
  updateAgent,
  removeAgent,
}: RosterProps) {
  const counts = useMemo(() => {
    const c = { coordinator: 0, builder: 0, scout: 0, reviewer: 0, custom: 0 };
    for (const a of draft.agents) c[a.role]++;
    return c;
  }, [draft.agents]);

  const cliForAll: SwarmAgentCli | null = useMemo(() => {
    if (draft.agents.length === 0) return null;
    const first = draft.agents[0].cli;
    return draft.agents.every((a) => a.cli === first) ? first : null;
  }, [draft.agents]);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-14 h-14 rounded-lg bg-accent-orange/10 border border-accent-orange/30 flex items-center justify-center">
        <Users size={24} className="text-accent-orange" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Agent Roster</h1>
        <p className="text-sm text-white/50 mt-1">
          Pick a preset or customise individual agents.
        </p>
      </div>

      {/* Swarm presets */}
      <div className="w-full">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-2">
          Swarm Presets
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SWARM_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-lg border transition-all ${
                draft.agents.length === p.total
                  ? "border-accent-orange/60 bg-accent-orange/10 text-accent-orange"
                  : "border-surface-border bg-surface-light text-white/60 hover:border-white/30"
              }`}
            >
              <Users size={14} />
              <span className="text-sm font-bold">{p.total}</span>
            </button>
          ))}
        </div>
      </div>

      {/* CLI for all */}
      <div className="w-full">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-2">
          CLI Agent For All
        </div>
        <div className="grid grid-cols-5 gap-2">
          {SWARM_CLIS.map((cli) => {
            const active = cliForAll === cli;
            return (
              <button
                key={cli}
                onClick={() => setCliForAll(cli)}
                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg border transition-all ${
                  active
                    ? "border-accent-orange/60 bg-accent-orange/10 text-accent-orange"
                    : "border-surface-border bg-surface-light text-white/60 hover:border-white/30"
                }`}
              >
                <span className="text-sm font-semibold">{CLI_META[cli].label}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-60">
                  {cli}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Role summary */}
      <div className="w-full flex items-center gap-2 flex-wrap text-[10px] font-semibold">
        {(["coordinator", "builder", "scout", "reviewer", "custom"] as SwarmAgentRole[])
          .filter((r) => counts[r] > 0)
          .map((r) => {
            const Icon = ROLE_ICONS[r];
            return (
              <div
                key={r}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
                style={{
                  borderColor: ROLE_META[r].color + "55",
                  color: ROLE_META[r].color,
                  background: ROLE_META[r].color + "10",
                }}
              >
                <Icon size={10} />
                {counts[r]}{" "}
                {r === "coordinator"
                  ? counts[r] > 1
                    ? "Coordinators"
                    : "Coordinator"
                  : counts[r] > 1
                    ? r.charAt(0).toUpperCase() + r.slice(1) + "s"
                    : r.charAt(0).toUpperCase() + r.slice(1)}
              </div>
            );
          })}
        <div className="ml-auto text-[10px] uppercase tracking-widest text-white/40">
          {draft.agents.length} Total
        </div>
      </div>

      {/* Agent list */}
      <div className="w-full flex flex-col gap-2.5">
        {draft.agents.map((agent, idx) => (
          <AgentRow
            key={agent.id}
            index={idx + 1}
            agent={agent}
            allAgents={draft.agents}
            onChange={(patch) => updateAgent(agent.id, patch)}
            onRemove={() => removeAgent(agent.id)}
          />
        ))}
      </div>

      <button
        onClick={addAgent}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-lg border border-dashed border-surface-border hover:border-accent-orange/60 hover:bg-accent-orange/5 text-xs uppercase tracking-wider font-semibold text-white/50 hover:text-accent-orange transition-colors"
      >
        <Plus size={14} /> Add Agent
      </button>
    </div>
  );
}

// ─── Collapsible agent row ──────────────────────────────────────────────

function AgentRow({
  index,
  agent,
  allAgents,
  onChange,
  onRemove,
}: {
  index: number;
  agent: SwarmAgent;
  allAgents: SwarmAgent[];
  onChange: (patch: Partial<SwarmAgent>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useExpanded(false);
  const RoleIcon = ROLE_ICONS[agent.role];
  const roleColor = ROLE_META[agent.role].color;

  const label = getAgentLabel(agent, allAgents);

  return (
    <div className="flex flex-col rounded-lg border border-surface-border bg-surface-light overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4">
        <span className="text-sm font-mono text-white/30 w-6 text-right">
          {index}
        </span>
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: roleColor + "15", border: `1px solid ${roleColor}55` }}
        >
          <RoleIcon size={20} style={{ color: roleColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-bold tracking-wider"
            style={{ color: roleColor }}
          >
            {label}
          </div>
          <div className="text-xs text-white/40 lowercase mt-0.5">
            {agent.cli}
          </div>
        </div>

        <button
          title={agent.autoApprove ? "Auto-approve ON" : "Auto-approve OFF"}
          onClick={() => onChange({ autoApprove: !agent.autoApprove })}
          className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${
            agent.autoApprove
              ? "border-accent-orange/60 text-accent-orange bg-accent-orange/10"
              : "border-surface-border text-white/40 hover:text-white/70"
          }`}
        >
          {agent.autoApprove ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>

        <button
          onClick={onRemove}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-surface-border text-white/40 hover:text-red-400 hover:border-red-400/40 transition-colors"
        >
          <X size={16} />
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-surface-border text-white/40 hover:text-white/70 transition-colors"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pb-4 border-t border-surface-border pt-4">
          {/* Role picker — tile grid */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40 mb-2">
              Assigned Role
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(ROLE_META) as SwarmAgentRole[]).map((r) => {
                const active = agent.role === r;
                const color = ROLE_META[r].color;
                const Icon = ROLE_ICONS[r];
                const shortLabel =
                  r === "coordinator"
                    ? "Coord"
                    : r.charAt(0).toUpperCase() + r.slice(1);
                return (
                  <button
                    key={r}
                    onClick={() => onChange({ role: r })}
                    className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border transition-all"
                    style={{
                      color: active ? color : "rgba(255,255,255,0.55)",
                      borderColor: active ? color : "var(--color-surface-border)",
                      background: active
                        ? color + "12"
                        : "var(--color-surface-light)",
                    }}
                  >
                    <Icon size={18} />
                    <span className="text-[11px] font-semibold">
                      {shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
            {agent.role === "custom" && (
              <input
                value={agent.customRole ?? ""}
                onChange={(e) => onChange({ customRole: e.target.value })}
                placeholder="Custom role label (e.g. Security Analyst)"
                className="mt-2 w-full px-2.5 py-1.5 rounded-md bg-surface border border-surface-border focus:border-accent-orange focus:outline-none text-xs text-white placeholder:text-white/30"
              />
            )}
          </div>

          {/* CLI picker — pill row */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/40 mb-2">
              CLI Agent
            </div>
            <div className="flex flex-wrap gap-2">
              {SWARM_CLIS.map((cli) => {
                const active = agent.cli === cli;
                return (
                  <button
                    key={cli}
                    onClick={() => onChange({ cli })}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      active
                        ? "border-accent-orange bg-accent-orange/10 text-accent-orange"
                        : "border-surface-border bg-surface-light text-white/60 hover:bg-surface-lighter hover:text-white/90"
                    }`}
                  >
                    {CLI_META[cli].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tiny local hook to avoid a hook import just for useState
function useExpanded(init: boolean) {
  return useState<boolean>(init);
}

