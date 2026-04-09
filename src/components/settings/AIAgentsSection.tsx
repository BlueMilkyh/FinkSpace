import { Bot } from "lucide-react";
import { useSettingsStore } from "../../stores/settings-store";

interface AgentOption {
  id: string;
  name: string;
  description: string;
  command: string;
}

const AI_AGENTS: AgentOption[] = [
  { id: "claude", name: "Claude", description: "Anthropic Claude Code CLI", command: "claude" },
  { id: "codex", name: "Codex", description: "OpenAI Codex CLI", command: "codex" },
  { id: "gemini", name: "Gemini", description: "Google Gemini CLI (headless mode)", command: "gemini" },
  { id: "opencode", name: "OpenCode", description: "OpenCode TUI agent", command: "opencode" },
  { id: "cursor", name: "Cursor", description: "Cursor Agent CLI", command: "agent" },
  { id: "droid", name: "Droid", description: "Factory Droid — #1 on Terminal-Bench", command: "droid" },
  { id: "copilot", name: "Copilot", description: "GitHub Copilot CLI", command: "copilot" },
  { id: "aider", name: "Aider", description: "Aider AI pair programming", command: "aider" },
];

export function AIAgentsSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Bot size={22} className="text-white/70" />
        <h2 className="text-lg font-semibold text-primary">AI Agents</h2>
      </div>
      <p className="text-sm text-secondary mb-6">
        Choose the default coding agent CLI used when running tasks.
      </p>

      <div className="rounded-lg border border-surface-border overflow-hidden">
        <div className="px-4 py-3 bg-surface-light/50">
          <h3 className="text-sm font-semibold text-primary">Default Agent</h3>
          <p className="text-xs text-secondary mt-0.5">
            This agent is pre-selected when you run a task from the Kanban board. You can always change it per-task in the run dialog.
          </p>
        </div>
        <div className="flex flex-col">
          {AI_AGENTS.map((agent) => {
            const isSelected = settings.defaultAgent === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => updateSetting("defaultAgent", agent.id)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-surface-border/50 last:border-b-0 transition-colors text-left ${
                  isSelected
                    ? "bg-accent-blue/5 ring-1 ring-inset ring-accent-blue/40"
                    : "hover:bg-surface-light/30"
                }`}
              >
                {/* Radio */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "border-accent-blue"
                      : "border-white/20"
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-blue" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-white/70"}`}>
                    {agent.name}
                  </span>
                  <p className="text-xs text-secondary">{agent.description}</p>
                </div>

                {/* Command */}
                <code className="text-xs text-white/20 font-mono flex-shrink-0">
                  {agent.command}
                </code>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
