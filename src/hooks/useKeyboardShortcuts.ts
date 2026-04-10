import { useEffect } from "react";
import { useWorkspaceStore } from "../finkspace/workspace-store";
import { useSettingsStore } from "../stores/settings-store";
import { useNavigationStore } from "../stores/navigation-store";
import { killAgent, writeToAgent } from "../lib/tauri-bridge";
import { copySelection, hasSelection } from "../lib/terminal-manager";
import { TERMINAL_TYPES } from "../types";
import { isMac } from "../lib/platform";
import { matchesShortcut, parseShortcut } from "../lib/shortcuts";

/** Focus an agent's terminal by finding its xterm textarea */
function focusAgentTerminal(agentId: string) {
  // AgentTile renders a TerminalView with a container div; find the xterm textarea inside
  // We use a small delay so the DOM can update after state changes
  setTimeout(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>(".xterm textarea.xterm-helper-textarea");
    // Each terminal container has a unique agentId – we walk up from textarea to find
    // the tile with the matching agent. But since we don't have a data-attribute, we
    // rely on the workspace store's focusedAgentId being set, and just focus in order.
    // Better approach: set data-agent-id on container.
    // For now, trigger focus via the store and let the AgentTile handle it.
    useWorkspaceStore.getState().setFocusedAgent(agentId);

    // Find the terminal container with this agentId using data attribute
    const container = document.querySelector(`[data-agent-id="${agentId}"] textarea.xterm-helper-textarea`) as HTMLTextAreaElement | null;
    if (container) {
      container.focus();
    } else {
      // Fallback: try all textareas
      textareas.forEach((ta) => ta.blur());
    }
  }, 10);
}

export function useKeyboardShortcuts() {
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const defaultWorkDir = useSettingsStore((s) => s.settings.defaultWorkDir);
  const defaultTerminalType = useSettingsStore((s) => s.settings.defaultTerminalType);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Allow Ctrl+, and Escape everywhere, block other shortcuts in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // xterm textareas are fine – they already pass through via attachCustomKeyEventHandler
      const isXterm = target.classList.contains("xterm-helper-textarea");

      const sc = useSettingsStore.getState().settings.shortcuts ?? {};

      if (isInput && !isXterm) {
        // Always allow Escape inside inputs, plus whatever the user currently
        // has bound to toggleSettings — so the settings escape-hatch keeps
        // working even after the user rebinds it away from Ctrl+,.
        const toggleBinding = sc.toggleSettings ?? "Ctrl+,";
        if (e.key !== "Escape" && !matchesShortcut(e, toggleBinding)) return;
      }

      const { toggleSettings } = useNavigationStore.getState();

      // Toggle settings: Ctrl+,
      if (matchesShortcut(e, sc.toggleSettings ?? "Ctrl+,")) {
        e.preventDefault();
        toggleSettings();
        return;
      }

      // Copy: Ctrl+Shift+C — only if a terminal has a selection (otherwise let xterm handle it)
      if (matchesShortcut(e, sc.copy ?? "Ctrl+Shift+C")) {
        const focusedId = useWorkspaceStore.getState().focusedAgentId;
        if (focusedId && hasSelection(focusedId)) {
          e.preventDefault();
          copySelection(focusedId);
          return;
        }
      }

      // Paste: Ctrl+Shift+V → write clipboard contents to focused agent
      if (matchesShortcut(e, sc.paste ?? "Ctrl+Shift+V")) {
        const focusedId = useWorkspaceStore.getState().focusedAgentId;
        if (focusedId) {
          e.preventDefault();
          navigator.clipboard
            .readText()
            .then((text) => {
              if (text) writeToAgent(focusedId, text);
            })
            .catch(() => {});
          return;
        }
      }

      const activeView = useNavigationStore.getState().activeView;

      // Escape exits settings view
      if (e.key === "Escape" && activeView === "settings") {
        e.preventDefault();
        const { previousView } = useNavigationStore.getState();
        useNavigationStore.getState().setActiveView(previousView);
        return;
      }

      // ── Navigation (global) ──

      // Open FinkSpace: Ctrl+Shift+1
      if (matchesShortcut(e, sc.openFinkSpace ?? "Ctrl+Shift+1")) {
        e.preventDefault();
        useNavigationStore.getState().setActiveView("terminal");
        return;
      }

      // Open FinkSwarm: Ctrl+Shift+2
      if (matchesShortcut(e, sc.openFinkSwarm ?? "Ctrl+Shift+2")) {
        e.preventDefault();
        useNavigationStore.getState().setActiveView("swarm");
        return;
      }

      if (activeView !== "terminal") return;

      const {
        workspaces,
        activeWorkspaceId,
        focusedAgentId,
        addWorkspace,
        removeWorkspace,
        switchWorkspace,
        addAgent,
        removeAgent,
      } = useWorkspaceStore.getState();

      const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
      const agents = activeWs?.agents ?? [];

      // ── Workspaces ──

      // New workspace: Ctrl+T
      if (matchesShortcut(e, sc.newWorkspace ?? "Ctrl+T")) {
        e.preventDefault();
        addWorkspace();
        return;
      }

      // Close workspace: Ctrl+Shift+W
      if (matchesShortcut(e, sc.closeWorkspace ?? "Ctrl+Shift+W")) {
        e.preventDefault();
        if (workspaces.length > 1) {
          for (const agent of agents) {
            killAgent(agent.id).catch(() => {});
          }
          removeWorkspace(activeWorkspaceId);
        }
        return;
      }

      // Switch to workspace 1-9: modifier prefix from sc.switchWorkspace1to9
      // paired with Digit1..Digit9. The stored key position is a placeholder;
      // only the modifiers matter.
      {
        const wsSwitch = parseShortcut(sc.switchWorkspace1to9 ?? "Ctrl+1");
        const modMatches =
          (isMac() ? e.metaKey : e.ctrlKey) === wsSwitch.ctrl &&
          e.shiftKey === wsSwitch.shift &&
          e.altKey === wsSwitch.alt;
        if (modMatches && /^Digit[1-9]$/.test(e.code)) {
          e.preventDefault();
          const idx = parseInt(e.code.slice(5)) - 1;
          if (idx < workspaces.length) {
            switchWorkspace(workspaces[idx].id);
          }
          return;
        }
      }

      // Next workspace: Ctrl+Shift+]
      if (matchesShortcut(e, sc.nextWorkspace ?? "Ctrl+Shift+]")) {
        e.preventDefault();
        const currentIdx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        const nextIdx = (currentIdx + 1) % workspaces.length;
        switchWorkspace(workspaces[nextIdx].id);
        return;
      }

      // Previous workspace: Ctrl+Shift+[
      if (matchesShortcut(e, sc.previousWorkspace ?? "Ctrl+Shift+[")) {
        e.preventDefault();
        const currentIdx = workspaces.findIndex((w) => w.id === activeWorkspaceId);
        const prevIdx = (currentIdx - 1 + workspaces.length) % workspaces.length;
        switchWorkspace(workspaces[prevIdx].id);
        return;
      }

      // ── Panes ──

      // Helper: get default terminal type for new sessions
      const getDefaultTermType = () => {
        return (
          TERMINAL_TYPES.find((t) => t.id === defaultTerminalType) ??
          TERMINAL_TYPES.find((t) => t.id === "claude") ??
          TERMINAL_TYPES[0]
        );
      };

      const addNewAgent = () => {
        const tt = getDefaultTermType();
        const count = agents.filter((a) => a.terminalType === tt.id).length;
        const name = count === 0 ? tt.name : `${tt.name} ${count + 1}`;
        const workDir = activeWs?.workDir || defaultWorkDir;
        const newAgent = addAgent({
          workspaceId: activeWorkspaceId,
          name,
          workDir,
          terminalType: tt,
        });
        // Focus the new agent after it mounts
        setTimeout(() => focusAgentTerminal(newAgent.id), 100);
      };

      // New session: Ctrl+N
      if (matchesShortcut(e, sc.newSession ?? "Ctrl+N")) {
        e.preventDefault();
        addNewAgent();
        return;
      }

      // Split horizontal: Ctrl+D (adds a new pane)
      if (matchesShortcut(e, sc.splitHorizontal ?? "Ctrl+D")) {
        e.preventDefault();
        addNewAgent();
        return;
      }

      // Split vertical: Ctrl+Shift+D (adds a new pane)
      if (matchesShortcut(e, sc.splitVertical ?? "Ctrl+Shift+D")) {
        e.preventDefault();
        addNewAgent();
        return;
      }

      // Close active pane: Ctrl+W
      if (matchesShortcut(e, sc.closePane ?? "Ctrl+W")) {
        e.preventDefault();
        if (agents.length > 0) {
          // Close the focused agent, or the last one if none focused
          const targetId = focusedAgentId && agents.some((a) => a.id === focusedAgentId)
            ? focusedAgentId
            : agents[agents.length - 1].id;
          killAgent(targetId).catch(() => {});
          removeAgent(activeWorkspaceId, targetId);
          // Focus next available agent
          const remaining = agents.filter((a) => a.id !== targetId);
          if (remaining.length > 0) {
            focusAgentTerminal(remaining[remaining.length - 1].id);
          }
        }
        return;
      }

      // Next pane: Ctrl+]
      if (matchesShortcut(e, sc.nextPane ?? "Ctrl+]")) {
        e.preventDefault();
        if (agents.length > 1) {
          const currentIdx = agents.findIndex((a) => a.id === focusedAgentId);
          const nextIdx = (currentIdx + 1) % agents.length;
          focusAgentTerminal(agents[nextIdx].id);
        }
        return;
      }

      // Previous pane: Ctrl+[
      if (matchesShortcut(e, sc.previousPane ?? "Ctrl+[")) {
        e.preventDefault();
        if (agents.length > 1) {
          const currentIdx = agents.findIndex((a) => a.id === focusedAgentId);
          const prevIdx = (currentIdx - 1 + agents.length) % agents.length;
          focusAgentTerminal(agents[prevIdx].id);
        }
        return;
      }

      // ── AI Features ──

      // AI assistance: Ctrl+K (placeholder – future feature)
      if (matchesShortcut(e, sc.aiAssistance ?? "Ctrl+K")) {
        e.preventDefault();
        // TODO: open AI assistance panel
        return;
      }
    };

    // Use capture phase so we get the event before xterm's bubbling handlers
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [shortcuts, defaultWorkDir, defaultTerminalType]);
}
