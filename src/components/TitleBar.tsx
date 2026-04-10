import { Settings, Minus, Square, X, Maximize2, Home } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import { WorkspaceTabs } from "../finkspace/WorkspaceTabs";
import { NavigateMenu } from "./NavigateMenu";
import { useNavigationStore } from "../stores/navigation-store";
import { isMac } from "../lib/platform";

export function TitleBar() {
  const toggleSettings = useNavigationStore((s) => s.toggleSettings);
  const activeView = useNavigationStore((s) => s.activeView);
  const goHome = useNavigationStore((s) => s.goHome);
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();
  const mac = isMac();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      className="flex items-center bg-surface border-b border-surface-border h-10 select-none"
      data-tauri-drag-region
    >
      {/* macOS: leave space for native traffic lights */}
      {mac && <div className="w-[72px] flex-shrink-0" data-tauri-drag-region />}

      <div className="flex-1 pl-2" data-tauri-drag-region>
        <WorkspaceTabs />
      </div>
      <div className="flex items-center h-full">
        {activeView !== "home" && (
          <button
            onClick={goHome}
            title="Home"
            className="h-full px-3 hover:bg-surface-light text-white/40 hover:text-white/80 transition-colors"
          >
            <Home size={15} />
          </button>
        )}
        <NavigateMenu />
        <button
          onClick={toggleSettings}
          className="h-full px-3 hover:bg-surface-light text-white/40 hover:text-white/80 transition-colors"
        >
          <Settings size={15} />
        </button>

        {/* Windows/Linux: custom window controls */}
        {!mac && (
          <>
            <div className="w-px h-4 bg-surface-border mx-0.5" />
            <button
              onClick={handleMinimize}
              className="h-full px-3 hover:bg-surface-light text-white/40 hover:text-white/80 transition-colors"
            >
              <Minus size={15} />
            </button>
            <button
              onClick={handleMaximize}
              className="h-full px-3 hover:bg-surface-light text-white/40 hover:text-white/80 transition-colors"
            >
              {isMaximized ? <Square size={13} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleClose}
              className="h-full px-3.5 hover:bg-red-600 text-white/40 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
