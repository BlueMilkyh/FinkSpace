import { useWorkspaceStore } from "../stores/workspace-store";

export function StatusBar() {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const totalAgents = workspaces.reduce((sum, w) => sum + w.agents.length, 0);
  const runningAgents = workspaces.reduce(
    (sum, w) => sum + w.agents.filter((a) => a.status === "running").length,
    0,
  );

  return (
    <div className="flex items-center justify-between px-3 py-1 bg-surface border-t border-surface-border text-xs text-white/40">
      <div className="flex items-center gap-4">
        <span>
          {workspace?.name} - {workspace?.agents.length ?? 0} agent(s)
        </span>
        <span>
          Total: {totalAgents} | Running: {runningAgents}
        </span>
      </div>
      <span>FinkSpace v0.1.0</span>
    </div>
  );
}
