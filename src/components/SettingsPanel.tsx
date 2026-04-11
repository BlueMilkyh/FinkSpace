import { useState, useCallback } from "react";
import {
  Palette,
  Keyboard,
  Bot,
  Terminal,
  SquareTerminal,
  Key,
  ScrollText,
  RefreshCw,
  CheckCircle,
  Download,
} from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
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
import { ChangelogSection } from "./settings/ChangelogSection";

const NAV_ITEMS: { id: SettingsSection; label: string; description: string; icon: React.ElementType }[] = [
  { id: "appearance", label: "Appearance", description: "Theme and display", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", description: "Keyboard settings", icon: Keyboard },
  { id: "ai-agents", label: "AI Agents", description: "Default coding agent", icon: Bot },
  { id: "cli", label: "CLI", description: "FinkSpace command", icon: Terminal },
  { id: "terminal", label: "Terminal", description: "Shell settings", icon: SquareTerminal },
  { id: "api-keys", label: "API Keys", description: "Create and manage keys", icon: Key },
  { id: "changelog", label: "Changelog", description: "What's new", icon: ScrollText },
];

const SECTION_COMPONENTS: Record<SettingsSection, React.FC> = {
  appearance: AppearanceSection,
  shortcuts: ShortcutsSection,
  "ai-agents": AIAgentsSection,
  cli: CLISection,
  terminal: TerminalSection,
  "api-keys": APIKeysSection,
  changelog: ChangelogSection,
};

type UpdateStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

const APP_VERSION = __APP_VERSION__;

export function SettingsPanel() {
  const { activeSection, setActiveSection } = useSettingsStore();
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleCheckForUpdates = useCallback(async () => {
    setUpdateStatus("checking");
    try {
      const update = await check();
      if (update) {
        setUpdateVersion(update.version);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
        setTimeout(() => setUpdateStatus("idle"), 3000);
      }
    } catch {
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  }, []);

  const handleDownloadAndInstall = useCallback(async () => {
    try {
      setUpdateStatus("downloading");
      setDownloadProgress(0);
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setDownloadProgress(contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0);
        }
      });
      setUpdateStatus("ready");
    } catch {
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus("idle"), 3000);
    }
  }, []);

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

        {/* Footer — Version + Check for Updates */}
        <div className="px-3 py-3 border-t border-surface-border flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/20">FinkSpace v{APP_VERSION}</span>
          </div>

          {updateStatus === "idle" && (
            <button
              onClick={handleCheckForUpdates}
              className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded-lg border border-surface-border text-xs text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
            >
              <RefreshCw size={11} />
              Check for updates
            </button>
          )}

          {updateStatus === "checking" && (
            <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-white/40">
              <RefreshCw size={11} className="animate-spin" />
              Checking...
            </div>
          )}

          {updateStatus === "up-to-date" && (
            <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-accent-green">
              <CheckCircle size={11} />
              You're up to date
            </div>
          )}

          {updateStatus === "available" && (
            <button
              onClick={handleDownloadAndInstall}
              className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded-lg bg-accent-orange/20 border border-accent-orange/40 text-xs text-accent-orange font-medium hover:bg-accent-orange/30 transition-colors"
            >
              <Download size={11} />
              Update to v{updateVersion}
            </button>
          )}

          {updateStatus === "downloading" && (
            <div className="flex flex-col gap-1 px-1">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <RefreshCw size={11} className="animate-spin" />
                Downloading... {downloadProgress}%
              </div>
              <div className="w-full h-1 bg-surface-light rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-orange rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {updateStatus === "ready" && (
            <button
              onClick={() => relaunch()}
              className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/40 text-xs text-accent-green font-medium hover:bg-accent-green/30 transition-colors"
            >
              <RefreshCw size={11} />
              Restart to apply
            </button>
          )}

          {updateStatus === "error" && (
            <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-400">
              Update check failed
            </div>
          )}
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
