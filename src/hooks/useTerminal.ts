import { useEffect } from "react";
import {
  getOrCreateTerminal,
  attachToContainer,
  detachFromContainer,
  updateTerminalTheme,
  refitTerminal,
} from "../lib/terminal-manager";
import { useSettingsStore } from "../stores/settings-store";

interface UseTerminalOptions {
  agentId: string;
  command: string;
  args: string[];
  cwd: string;
  color: string;
  isVisible: boolean;
}

export function useTerminal(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseTerminalOptions,
) {
  const theme = useSettingsStore((s) => s.settings.theme);

  // Ensure the managed terminal exists (doesn't re-create if already present)
  getOrCreateTerminal(
    options.agentId,
    options.command,
    options.args,
    options.cwd,
    options.color,
    theme,
  );

  // Attach terminal to the DOM container; detach on unmount to preserve the element
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    attachToContainer(
      options.agentId,
      container,
      options.command,
      options.args,
      options.cwd,
    );
    return () => {
      // Detach: pull the terminal element out before React destroys the container
      detachFromContainer(options.agentId);
    };
  }, [options.agentId, containerRef, options.command, options.args, options.cwd]);

  // Update theme without re-creating terminal
  useEffect(() => {
    updateTerminalTheme(options.agentId, theme);
  }, [theme, options.agentId]);

  // Re-fit when terminal becomes visible
  useEffect(() => {
    if (options.isVisible) {
      const timer = setTimeout(() => {
        refitTerminal(options.agentId);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [options.isVisible, options.agentId]);
}
