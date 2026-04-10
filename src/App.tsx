import { TitleBar } from "./components/TitleBar";
import { AgentGrid } from "./components/AgentGrid";
import { KanbanBoard } from "./components/KanbanBoard";
import { SettingsPanel } from "./components/SettingsPanel";
import { HomeView } from "./components/HomeView";
import { SwarmView } from "./components/SwarmView";
import { StatusBar } from "./components/StatusBar";
import { UpdateNotification } from "./components/UpdateNotification";
import { useTheme } from "./hooks/useTheme";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useNavigationStore } from "./stores/navigation-store";

function App() {
  useTheme();
  useKeyboardShortcuts();
  const activeView = useNavigationStore((s) => s.activeView);

  return (
    <div className="h-screen w-screen flex flex-col bg-surface text-primary">
      <TitleBar />
      <div className="flex-1 relative">
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: activeView === "terminal" ? 1 : 0,
            pointerEvents: activeView === "terminal" ? "auto" : "none",
            zIndex: activeView === "terminal" ? 10 : 0,
          }}
        >
          <AgentGrid />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: activeView === "kanban" ? 1 : 0,
            pointerEvents: activeView === "kanban" ? "auto" : "none",
            zIndex: activeView === "kanban" ? 10 : 0,
          }}
        >
          <KanbanBoard />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: activeView === "home" ? 1 : 0,
            pointerEvents: activeView === "home" ? "auto" : "none",
            zIndex: activeView === "home" ? 10 : 0,
          }}
        >
          <HomeView />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: activeView === "swarm" ? 1 : 0,
            pointerEvents: activeView === "swarm" ? "auto" : "none",
            zIndex: activeView === "swarm" ? 10 : 0,
          }}
        >
          <SwarmView />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: activeView === "settings" ? 1 : 0,
            pointerEvents: activeView === "settings" ? "auto" : "none",
            zIndex: activeView === "settings" ? 10 : 0,
          }}
        >
          <SettingsPanel />
        </div>
      </div>
      <StatusBar />
      <UpdateNotification />
    </div>
  );
}

export default App;
