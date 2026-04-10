import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Swarm,
  SwarmAgent,
  SwarmAgentCli,
  SwarmAgentRole,
  SwarmAgentStatus,
  SwarmConfig,
  SwarmMessage,
  SwarmStatus,
} from "./types";
import { SWARM_PRESETS } from "./types";
import { AGENT_COLORS, getNextColor } from "../lib/colors";

export type WizardStep = 0 | 1 | 2 | 3 | 4;

interface SwarmStore {
  swarms: Swarm[];
  activeSwarmId: string | null;

  // Draft (wizard) state — not persisted.
  draft: SwarmConfig | null;
  draftStep: WizardStep;

  // Lifecycle
  beginDraft: () => void;
  cancelDraft: () => void;
  setDraftStep: (step: WizardStep) => void;
  updateDraft: (patch: Partial<SwarmConfig>) => void;
  applyPreset: (presetId: string) => void;
  setCliForAll: (cli: SwarmAgentCli) => void;
  launchDraft: () => string | null; // returns new swarm id

  // Swarm mutations
  setActiveSwarm: (id: string | null) => void;
  removeSwarm: (id: string) => void;
  renameSwarm: (id: string, name: string) => void;
  setSwarmStatus: (id: string, status: SwarmStatus) => void;

  addAgent: (swarmId: string) => void;
  updateAgent: (
    swarmId: string,
    agentId: string,
    patch: Partial<SwarmAgent>,
  ) => void;
  removeAgent: (swarmId: string, agentId: string) => void;
  setAgentStatus: (
    swarmId: string,
    agentId: string,
    status: SwarmAgentStatus,
  ) => void;

  appendMessage: (msg: Omit<SwarmMessage, "id" | "createdAt">) => void;
  clearMessages: (swarmId: string) => void;
}

function id() {
  return crypto.randomUUID();
}

function emptyConfig(): SwarmConfig {
  return {
    name: "New Swarm",
    workDir: "",
    prompt: "",
    knowledge: [],
    agents: agentsFromPreset("s5"),
  };
}

function makeAgent(
  role: SwarmAgentRole,
  cli: SwarmAgentCli,
  idx: number,
): SwarmAgent {
  return {
    id: id(),
    role,
    cli,
    autoApprove: true,
    status: "pending",
    color: AGENT_COLORS[idx % AGENT_COLORS.length],
  };
}

function agentsFromPreset(presetId: string): SwarmAgent[] {
  const p = SWARM_PRESETS.find((sp) => sp.id === presetId) ?? SWARM_PRESETS[0];
  const out: SwarmAgent[] = [];
  let i = 0;
  for (let k = 0; k < p.coordinators; k++) out.push(makeAgent("coordinator", "claude", i++));
  for (let k = 0; k < p.builders; k++) out.push(makeAgent("builder", "claude", i++));
  for (let k = 0; k < p.scouts; k++) out.push(makeAgent("scout", "claude", i++));
  for (let k = 0; k < p.reviewers; k++) out.push(makeAgent("reviewer", "claude", i++));
  return out;
}

export const useSwarmStore = create<SwarmStore>()(
  persist(
    (set, get) => ({
      swarms: [],
      activeSwarmId: null,
      draft: null,
      draftStep: 0,

      // ── Wizard ───────────────────────────────────────────────────
      beginDraft: () => set({ draft: emptyConfig(), draftStep: 0 }),

      cancelDraft: () => set({ draft: null, draftStep: 0 }),

      setDraftStep: (step) => set({ draftStep: step }),

      updateDraft: (patch) =>
        set((state) => ({
          draft: state.draft ? { ...state.draft, ...patch } : state.draft,
        })),

      applyPreset: (presetId) =>
        set((state) => {
          if (!state.draft) return state;
          // Preserve current CLI-for-all if all agents currently share one.
          const sharedCli =
            state.draft.agents.length > 0 &&
            state.draft.agents.every(
              (a) => a.cli === state.draft!.agents[0].cli,
            )
              ? state.draft.agents[0].cli
              : "claude";
          const agents = agentsFromPreset(presetId).map((a) => ({
            ...a,
            cli: sharedCli,
          }));
          return { draft: { ...state.draft, agents } };
        }),

      setCliForAll: (cli) =>
        set((state) => {
          if (!state.draft) return state;
          return {
            draft: {
              ...state.draft,
              agents: state.draft.agents.map((a) => ({ ...a, cli })),
            },
          };
        }),

      launchDraft: () => {
        const { draft } = get();
        if (!draft) return null;
        const swarmId = id();
        const swarm: Swarm = {
          id: swarmId,
          config: {
            ...draft,
            agents: draft.agents.map((a) => ({ ...a, status: "pending" })),
          },
          status: "running",
          createdAt: Date.now(),
          messages: [
            {
              id: id(),
              swarmId,
              fromAgentId: "system",
              text: `Swarm "${draft.name}" launched with ${draft.agents.length} agents.`,
              createdAt: Date.now(),
            },
          ],
        };
        set((state) => ({
          swarms: [...state.swarms, swarm],
          activeSwarmId: swarmId,
          draft: null,
          draftStep: 0,
        }));
        return swarmId;
      },

      // ── Swarm CRUD ───────────────────────────────────────────────
      setActiveSwarm: (id) => set({ activeSwarmId: id }),

      removeSwarm: (targetId) =>
        set((state) => {
          const swarms = state.swarms.filter((s) => s.id !== targetId);
          return {
            swarms,
            activeSwarmId:
              state.activeSwarmId === targetId
                ? (swarms[0]?.id ?? null)
                : state.activeSwarmId,
          };
        }),

      renameSwarm: (targetId, name) =>
        set((state) => ({
          swarms: state.swarms.map((s) =>
            s.id === targetId ? { ...s, config: { ...s.config, name } } : s,
          ),
        })),

      setSwarmStatus: (targetId, status) =>
        set((state) => ({
          swarms: state.swarms.map((s) =>
            s.id === targetId ? { ...s, status } : s,
          ),
        })),

      // ── Agent mutations (work on draft OR live swarm) ────────────
      addAgent: (swarmId) =>
        set((state) => {
          // Draft case
          if (swarmId === "__draft__" && state.draft) {
            return {
              draft: {
                ...state.draft,
                agents: [
                  ...state.draft.agents,
                  makeAgent("builder", "claude", state.draft.agents.length),
                ],
              },
            };
          }
          return {
            swarms: state.swarms.map((s) =>
              s.id === swarmId
                ? {
                    ...s,
                    config: {
                      ...s.config,
                      agents: [
                        ...s.config.agents,
                        makeAgent("builder", "claude", s.config.agents.length),
                      ],
                    },
                  }
                : s,
            ),
          };
        }),

      updateAgent: (swarmId, agentId, patch) =>
        set((state) => {
          if (swarmId === "__draft__" && state.draft) {
            return {
              draft: {
                ...state.draft,
                agents: state.draft.agents.map((a) =>
                  a.id === agentId ? { ...a, ...patch } : a,
                ),
              },
            };
          }
          return {
            swarms: state.swarms.map((s) =>
              s.id === swarmId
                ? {
                    ...s,
                    config: {
                      ...s.config,
                      agents: s.config.agents.map((a) =>
                        a.id === agentId ? { ...a, ...patch } : a,
                      ),
                    },
                  }
                : s,
            ),
          };
        }),

      removeAgent: (swarmId, agentId) =>
        set((state) => {
          if (swarmId === "__draft__" && state.draft) {
            return {
              draft: {
                ...state.draft,
                agents: state.draft.agents.filter((a) => a.id !== agentId),
              },
            };
          }
          return {
            swarms: state.swarms.map((s) =>
              s.id === swarmId
                ? {
                    ...s,
                    config: {
                      ...s.config,
                      agents: s.config.agents.filter((a) => a.id !== agentId),
                    },
                  }
                : s,
            ),
          };
        }),

      setAgentStatus: (swarmId, agentId, status) =>
        set((state) => ({
          swarms: state.swarms.map((s) =>
            s.id === swarmId
              ? {
                  ...s,
                  config: {
                    ...s.config,
                    agents: s.config.agents.map((a) =>
                      a.id === agentId ? { ...a, status } : a,
                    ),
                  },
                }
              : s,
          ),
        })),

      appendMessage: (msg) =>
        set((state) => ({
          swarms: state.swarms.map((s) =>
            s.id === msg.swarmId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      ...msg,
                      id: id(),
                      createdAt: Date.now(),
                    },
                  ],
                }
              : s,
          ),
        })),

      clearMessages: (swarmId) =>
        set((state) => ({
          swarms: state.swarms.map((s) =>
            s.id === swarmId ? { ...s, messages: [] } : s,
          ),
        })),
    }),
    {
      name: "finkspace-swarms",
      partialize: (state) => ({
        swarms: state.swarms,
        activeSwarmId: state.activeSwarmId,
      }),
      merge: (persisted, current) => {
        const ps = persisted as Partial<SwarmStore>;
        // On reload, mark all swarms back to draft so the user must re-launch
        // (same safety pattern as workspace-store — we don't own live PTYs).
        const swarms = (ps.swarms ?? []).map((s) => ({
          ...s,
          status: "draft" as SwarmStatus,
          config: {
            ...s.config,
            agents: s.config.agents.map((a) => ({
              ...a,
              status: "pending" as SwarmAgentStatus,
            })),
          },
        }));
        return {
          ...current,
          swarms,
          activeSwarmId: ps.activeSwarmId ?? current.activeSwarmId,
        };
      },
    },
  ),
);

// Helper reused by UI
export { getNextColor };
