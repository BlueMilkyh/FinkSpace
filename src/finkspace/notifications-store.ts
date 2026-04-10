import { create } from "zustand";
import { useWorkspaceStore } from "./workspace-store";
import { useNavigationStore } from "../stores/navigation-store";

/**
 * After a user clears a notification (by visiting the workspace), we suppress
 * re-notification for the same agent for this long. Without this, a long-running
 * process that produces intermittent output re-fires idle notifications every
 * few seconds, making the badge "come back" right after the user dismissed it.
 */
const SUPPRESSION_MS = 15_000;

interface NotificationStore {
  /** agentId → workspaceId where the agent has a pending "became idle" notification */
  agentAlerts: Record<string, string>;
  /** agentId → timestamp (ms) before which we won't re-notify for this agent */
  suppressedUntil: Record<string, number>;

  markAgentIdle: (agentId: string, workspaceId: string) => void;
  clearAgent: (agentId: string) => void;
  clearWorkspace: (workspaceId: string) => void;
  getWorkspaceCount: (workspaceId: string) => number;
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  agentAlerts: {},
  suppressedUntil: {},

  markAgentIdle: (agentId, workspaceId) => {
    set((state) => {
      // Honor suppression window set by a recent clear for this agent
      const until = state.suppressedUntil[agentId];
      if (until && Date.now() < until) return state;
      if (state.agentAlerts[agentId] === workspaceId) return state;
      return {
        agentAlerts: { ...state.agentAlerts, [agentId]: workspaceId },
      };
    });
  },

  clearAgent: (agentId) => {
    set((state) => {
      const hadAlert = agentId in state.agentAlerts;
      const nextAlerts = hadAlert ? { ...state.agentAlerts } : state.agentAlerts;
      if (hadAlert) delete (nextAlerts as Record<string, string>)[agentId];
      return {
        agentAlerts: nextAlerts,
        suppressedUntil: {
          ...state.suppressedUntil,
          [agentId]: Date.now() + SUPPRESSION_MS,
        },
      };
    });
  },

  clearWorkspace: (workspaceId) => {
    set((state) => {
      const nextAlerts: Record<string, string> = {};
      const clearedAgentIds: string[] = [];
      for (const [agentId, wsId] of Object.entries(state.agentAlerts)) {
        if (wsId === workspaceId) {
          clearedAgentIds.push(agentId);
        } else {
          nextAlerts[agentId] = wsId;
        }
      }
      // Also suppress any agent belonging to this workspace — even ones without
      // a current alert — so a fresh idle cycle right after the user visited
      // doesn't immediately pop a new badge on the tab they just focused.
      const wsState = useWorkspaceStore.getState();
      const workspace = wsState.workspaces.find((w) => w.id === workspaceId);
      const now = Date.now();
      const nextSuppressed = { ...state.suppressedUntil };
      if (workspace) {
        for (const a of workspace.agents) {
          nextSuppressed[a.id] = now + SUPPRESSION_MS;
        }
      }
      for (const id of clearedAgentIds) {
        nextSuppressed[id] = now + SUPPRESSION_MS;
      }
      return {
        agentAlerts: nextAlerts,
        suppressedUntil: nextSuppressed,
      };
    });
  },

  getWorkspaceCount: (workspaceId) => {
    const alerts = get().agentAlerts;
    let n = 0;
    for (const wsId of Object.values(alerts)) {
      if (wsId === workspaceId) n++;
    }
    return n;
  },
}));

/** Call from anywhere (e.g. terminal-manager) to raise an idle notification for an agent. */
export function notifyAgentIdle(agentId: string) {
  const wsState = useWorkspaceStore.getState();
  const workspace = wsState.workspaces.find((w) =>
    w.agents.some((a) => a.id === agentId),
  );
  if (!workspace) return;
  // Don't notify for the workspace the user is currently on. We intentionally
  // don't check activeView here — if they've got this workspace active, a
  // blinking badge is noise even if they popped open settings or the swarm.
  if (workspace.id === wsState.activeWorkspaceId) {
    const navState = useNavigationStore.getState();
    // Only "home" is a clear "I left the workspace view" signal — home is a
    // landing page, not an overlay. In every other view the active workspace
    // is still the user's primary context.
    if (navState.activeView !== "home") return;
  }
  useNotificationStore.getState().markAgentIdle(agentId, workspace.id);
}
