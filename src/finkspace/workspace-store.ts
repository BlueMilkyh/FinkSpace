import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Agent, AgentStatus, TerminalType, Workspace } from "../types";
import { AGENT_COLORS, getNextColor } from "../lib/colors";

interface AddAgentOptions {
  workspaceId: string;
  name: string;
  workDir: string;
  terminalType: TerminalType;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  focusedAgentId: string | null;

  addWorkspace: () => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  setWorkspaceColor: (id: string, color: string) => void;
  setWorkspaceDir: (id: string, workDir: string) => void;
  switchWorkspace: (id: string) => void;
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void;

  addAgent: (opts: AddAgentOptions) => Agent;
  addPendingAgent: (workspaceId: string) => void;
  activateAgent: (agentId: string, opts: AddAgentOptions) => void;
  removeAgent: (workspaceId: string, agentId: string) => void;
  renameAgent: (agentId: string, name: string) => void;
  setAgentColor: (agentId: string, color: string) => void;
  switchAgentTerminal: (agentId: string, terminalType: TerminalType) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  setFocusedAgent: (agentId: string | null) => void;
  reorderAgents: (workspaceId: string, fromIndex: number, toIndex: number) => void;

  getActiveWorkspace: () => Workspace;
}

function generateId(): string {
  return crypto.randomUUID();
}

const defaultWorkspace: Workspace = {
  id: "workspace-1",
  name: "Workspace 1",
  color: AGENT_COLORS[1], // orange
  workDir: "",
  agents: [],
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [defaultWorkspace],
      activeWorkspaceId: defaultWorkspace.id,
      focusedAgentId: null,

      addWorkspace: () => {
        const id = generateId();
        const num = get().workspaces.length + 1;
        const colorIdx = get().workspaces.length % AGENT_COLORS.length;
        set((state) => ({
          workspaces: [
            ...state.workspaces,
            { id, name: `Workspace ${num}`, color: AGENT_COLORS[colorIdx], workDir: "", agents: [] },
          ],
          activeWorkspaceId: id,
        }));
      },

      removeWorkspace: (id: string) => {
        set((state) => {
          const filtered = state.workspaces.filter((w) => w.id !== id);
          if (filtered.length === 0) return state;
          return {
            workspaces: filtered,
            activeWorkspaceId:
              state.activeWorkspaceId === id
                ? filtered[0].id
                : state.activeWorkspaceId,
          };
        });
      },

      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, name } : w,
          ),
        }));
      },

      setWorkspaceColor: (id: string, color: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, color } : w,
          ),
        }));
      },

      setWorkspaceDir: (id: string, workDir: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === id ? { ...w, workDir } : w,
          ),
        }));
      },

      switchWorkspace: (id: string) => {
        set({ activeWorkspaceId: id });
      },

      addAgent: ({ workspaceId, name, workDir, terminalType }: AddAgentOptions) => {
        const agent: Agent = {
          id: generateId(),
          name,
          color: getNextColor(),
          status: "running",
          workDir,
          terminalType: terminalType.id,
          command: terminalType.command,
          args: [...terminalType.args],
        };
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, agents: [...w.agents, agent] }
              : w,
          ),
        }));
        return agent;
      },

      addPendingAgent: (workspaceId: string) => {
        const ws = get().workspaces.find((w) => w.id === workspaceId);
        const num = (ws?.agents.length ?? 0) + 1;
        const agent: Agent = {
          id: generateId(),
          name: `Agent ${num}`,
          color: getNextColor(),
          status: "pending",
          workDir: ws?.workDir || "",
          terminalType: "",
          command: "",
          args: [],
        };
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, agents: [...w.agents, agent] }
              : w,
          ),
        }));
      },

      activateAgent: (agentId: string, { workspaceId, name, workDir, terminalType }: AddAgentOptions) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  agents: w.agents.map((a) =>
                    a.id === agentId
                      ? {
                          ...a,
                          name,
                          status: "running" as AgentStatus,
                          workDir,
                          terminalType: terminalType.id,
                          command: terminalType.command,
                          args: [...terminalType.args],
                        }
                      : a,
                  ),
                }
              : w,
          ),
        }));
      },

      removeAgent: (workspaceId: string, agentId: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, agents: w.agents.filter((a) => a.id !== agentId) }
              : w,
          ),
        }));
      },

      renameAgent: (agentId: string, name: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => ({
            ...w,
            agents: w.agents.map((a) =>
              a.id === agentId ? { ...a, name } : a,
            ),
          })),
        }));
      },

      setAgentColor: (agentId: string, color: string) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => ({
            ...w,
            agents: w.agents.map((a) =>
              a.id === agentId ? { ...a, color } : a,
            ),
          })),
        }));
      },

      switchAgentTerminal: (agentId: string, terminalType: TerminalType) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => ({
            ...w,
            agents: w.agents.map((a) =>
              a.id === agentId
                ? {
                    ...a,
                    terminalType: terminalType.id,
                    command: terminalType.command,
                    args: [...terminalType.args],
                    status: "running" as AgentStatus,
                  }
                : a,
            ),
          })),
        }));
      },

      setFocusedAgent: (agentId: string | null) => {
        set({ focusedAgentId: agentId });
      },

      reorderAgents: (workspaceId: string, fromIndex: number, toIndex: number) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => {
            if (w.id !== workspaceId) return w;
            const agents = [...w.agents];
            const [moved] = agents.splice(fromIndex, 1);
            agents.splice(toIndex, 0, moved);
            return { ...w, agents };
          }),
        }));
      },

      reorderWorkspaces: (fromIndex: number, toIndex: number) => {
        set((state) => {
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= state.workspaces.length ||
            toIndex >= state.workspaces.length ||
            fromIndex === toIndex
          ) {
            return state;
          }
          const workspaces = [...state.workspaces];
          const [moved] = workspaces.splice(fromIndex, 1);
          workspaces.splice(toIndex, 0, moved);
          return { workspaces };
        });
      },

      updateAgentStatus: (agentId: string, status: AgentStatus) => {
        set((state) => {
          // No-op if nothing changed — avoids a re-render storm on every output event
          let changed = false;
          const workspaces = state.workspaces.map((w) => {
            let agentsChanged = false;
            const agents = w.agents.map((a) => {
              if (a.id === agentId && a.status !== status) {
                agentsChanged = true;
                return { ...a, status };
              }
              return a;
            });
            if (!agentsChanged) return w;
            changed = true;
            return { ...w, agents };
          });
          return changed ? { workspaces } : state;
        });
      },

      getActiveWorkspace: () => {
        const state = get();
        return (
          state.workspaces.find((w) => w.id === state.activeWorkspaceId) ??
          state.workspaces[0]
        );
      },
    }),
    {
      name: "finkspace-workspaces",
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<WorkspaceStore>;
        const workspaces = (persistedState.workspaces ?? current.workspaces).map(
          (w: Workspace) => ({
            ...w,
            workDir: w.workDir ?? "",
            // Reset running agents so fresh PTY processes are spawned; keep pending as pending
            agents: w.agents.map((a: Agent) => ({
              ...a,
              status: a.status === "pending" ? ("pending" as AgentStatus) : ("running" as AgentStatus),
            })),
          }),
        );
        return {
          ...current,
          workspaces,
          activeWorkspaceId: persistedState.activeWorkspaceId ?? current.activeWorkspaceId,
        };
      },
    },
  ),
);
