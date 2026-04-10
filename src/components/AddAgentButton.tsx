import { Plus, Bot, Terminal, SquareTerminal, FolderOpen, Sparkles, Gem, Wand2, Cpu, MousePointer2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { TERMINAL_TYPES } from "../types";
import { useWorkspaceStore } from "../stores/workspace-store";
import { useNavigationStore } from "../stores/navigation-store";
import { CdInput } from "./CdInput";
import type { TerminalType } from "../types";

const iconMap: Record<string, React.ElementType> = {
  Bot,
  Terminal,
  SquareTerminal,
  Sparkles,
  Gem,
  Wand2,
  Cpu,
  MousePointer2,
};

interface AddAgentButtonProps {
  onSelect: (terminalType: TerminalType) => void;
  workspaceId: string;
}

export function AddAgentButton({ onSelect, workspaceId }: AddAgentButtonProps) {
  const setWorkspaceDir = useWorkspaceStore((s) => s.setWorkspaceDir);
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
  const workDir = useWorkspaceStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.workDir ?? "",
  );
  const setActiveView = useNavigationStore((s) => s.setActiveView);

  const handleOpenFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Open Project Folder",
    });
    if (selected && typeof selected === "string") {
      setWorkspaceDir(workspaceId, selected);
      const folderName = selected.split(/[\\/]/).filter(Boolean).pop() ?? selected;
      renameWorkspace(workspaceId, folderName);
      setActiveView("terminal");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 max-w-lg w-full">
      {/* Open Folder / Project */}
      <div className="flex flex-col items-stretch gap-3 w-full">
        <button
          onClick={handleOpenFolder}
          className="group flex flex-col items-center gap-3 w-full p-8 rounded-xl border-2 border-dashed border-white/10 hover:border-accent-orange/40 hover:bg-accent-orange/5 transition-all"
        >
          <div className="w-14 h-14 rounded-full bg-white/5 group-hover:bg-accent-orange/10 flex items-center justify-center transition-colors">
            <FolderOpen size={28} className="text-white/40 group-hover:text-accent-orange transition-colors" />
          </div>
          <div className="text-center">
            <span className="text-base font-medium text-white/70 group-hover:text-white/90 transition-colors">
              Open Project
            </span>
            {workDir ? (
              <p className="text-xs text-white/30 mt-1 font-mono truncate max-w-xs">{workDir}</p>
            ) : (
              <p className="text-xs text-white/25 mt-1">Select a folder to get started</p>
            )}
          </div>
        </button>

        {/* Mini terminal: navigate with cd commands without picking a folder */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[10px] uppercase tracking-wider text-white/25">or navigate</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
        <CdInput
          cwd={workDir}
          onChange={(newCwd) => {
            setWorkspaceDir(workspaceId, newCwd);
            const folderName = newCwd.split(/[\\/]/).filter(Boolean).pop() ?? newCwd;
            renameWorkspace(workspaceId, folderName);
          }}
        />
      </div>

      {/* Agent selection */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex items-center gap-2 text-white/30">
          <Plus size={16} />
          <span className="text-sm font-medium">Add an agent</span>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {TERMINAL_TYPES.map((tt) => {
            const Icon = iconMap[tt.icon] ?? Terminal;
            return (
              <button
                key={tt.id}
                onClick={() => onSelect(tt)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-white/5 hover:border-white/20 hover:bg-white/5 text-white/50 hover:text-white/90 transition-all min-w-[110px]"
              >
                <Icon size={24} />
                <span className="text-xs font-medium text-center">{tt.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-white/20">
          Right-click anywhere to add more agents later
        </p>
      </div>
    </div>
  );
}
