import {
  Palette,
  Keyboard,
  Bot,
  Terminal,
  SquareTerminal,
  Key,
} from "lucide-react";
import {
  useSettingsStore,
  type SettingsSection,
} from "../stores/settings-store";
import { AppearanceSection } from "./settings/AppearanceSection";
import { ShortcutsSection } from "./settings/ShortcutsSection";
import { AIAgentsSection } from "./settings/AIAgentsSection";
import { CLISection } from "./settings/CLISection";
import { TerminalSection } from "./settings/TerminalSection";
import { APIKeysSection } from "./settings/APIKeysSection";

const NAV_ITEMS: { id: SettingsSection; label: string; description: string; icon: React.ElementType }[] = [
  { id: "appearance", label: "Appearance", description: "Theme and display", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", description: "Keyboard settings", icon: Keyboard },
  { id: "ai-agents", label: "AI Agents", description: "Default coding agent", icon: Bot },
  { id: "cli", label: "CLI", description: "FinkSpace command", icon: Terminal },
  { id: "terminal", label: "Terminal", description: "Shell settings", icon: SquareTerminal },
  { id: "api-keys", label: "API Keys", description: "Create and manage keys", icon: Key },
];

const SECTION_COMPONENTS: Record<SettingsSection, React.FC> = {
  appearance: AppearanceSection,
  shortcuts: ShortcutsSection,
  "ai-agents": AIAgentsSection,
  cli: CLISection,
  terminal: TerminalSection,
  "api-keys": APIKeysSection,
};

export function SettingsPanel() {
  const { activeSection, setActiveSection } = useSettingsStore();

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <div className="h-full flex">
      {/* Sidebar */}
      <div className="w-56 bg-surface flex flex-col border-r border-surface-border">
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-surface-border">
          <h1 className="text-base font-semibold text-white">Settings</h1>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-2 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-surface-light text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-surface-light/50"
                }`}
              >
                <Icon size={16} className={isActive ? "text-accent-orange" : "text-white/40"} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-xs text-white/30">{item.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-border">
          <span className="text-xs text-white/20">FinkSpace v0.1.0</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-surface-light overflow-auto">
        <div className="max-w-2xl mx-auto p-8">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
