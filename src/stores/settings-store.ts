import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SettingsSection =
  | "appearance"
  | "shortcuts"
  | "ai-agents"
  | "cli"
  | "terminal"
  | "api-keys";

interface Settings {
  // Appearance
  theme: "dark" | "light" | "black";
  accentColor: string;
  uiScale: number;

  // Terminal
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  cursorStyle: "block" | "underline" | "bar";
  scrollback: number;
  terminalLayout: string; // layout preset id, e.g. "auto", "2-3", "2-2", or "custom"
  customLayoutRows: number[]; // used when terminalLayout === "custom"

  // AI Agents / Defaults
  defaultAgent: string;
  defaultWorkDir: string;
  defaultTerminalType: string;
  claudeModelFlag: string;

  // Shortcuts
  shortcuts: Record<string, string>;

  // API Keys
  anthropicApiKey: string;
}

interface SettingsStore {
  settings: Settings;
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const defaultShortcuts: Record<string, string> = {
  // Navigation
  openFinkSpace: "Ctrl+Shift+1",
  openFinkSwarm: "Ctrl+Shift+2",
  // Workspaces
  newWorkspace: "Ctrl+T",
  closeWorkspace: "Ctrl+Shift+W",
  switchWorkspace1to9: "Ctrl+1-9",
  nextWorkspace: "Ctrl+Shift+]",
  previousWorkspace: "Ctrl+Shift+[",
  // Panes
  newSession: "Ctrl+N",
  splitHorizontal: "Ctrl+D",
  splitVertical: "Ctrl+Shift+D",
  closePane: "Ctrl+W",
  nextPane: "Ctrl+]",
  previousPane: "Ctrl+[",
  // AI Features
  aiAssistance: "Ctrl+K",
  // Clipboard
  copy: "Ctrl+Shift+C",
  paste: "Ctrl+Shift+V",
  // General
  toggleSettings: "Ctrl+,",
};

const defaultSettings: Settings = {
  theme: "dark",
  accentColor: "#e67e22",
  uiScale: 100,

  fontSize: 13,
  fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
  cursorBlink: true,
  cursorStyle: "block",
  scrollback: 5000,
  terminalLayout: "auto",
  customLayoutRows: [2, 2],

  defaultAgent: "claude",
  defaultWorkDir: "",  // Set dynamically after platform init
  defaultTerminalType: "system-default",
  claudeModelFlag: "",

  shortcuts: defaultShortcuts,

  anthropicApiKey: "",
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      activeSection: "appearance",
      setActiveSection: (section) => set({ activeSection: section }),
      updateSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, [key]: value },
        })),
    }),
    {
      name: "finkspace-settings",
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<{ settings: Partial<Settings> }>;
        return {
          ...current,
          settings: {
            ...defaultSettings,
            ...(persistedState.settings ?? {}),
            // Always ensure shortcuts has all keys
            shortcuts: {
              ...defaultShortcuts,
              ...(persistedState.settings?.shortcuts ?? {}),
            },
          },
        };
      },
    },
  ),
);
