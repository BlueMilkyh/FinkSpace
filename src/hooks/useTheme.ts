import { useEffect } from "react";
import { useSettingsStore } from "../stores/settings-store";

const TERMINAL_THEMES = {
  dark: {
    background: "#0b0d12",
    foreground: "#e0e0e0",
    selectionBackground: "#232634",
    black: "#0b0d12",
  },
  black: {
    background: "#000000",
    foreground: "#e0e0e0",
    selectionBackground: "#333333",
    black: "#000000",
  },
  light: {
    background: "#ffffff",
    foreground: "#0a0e1a",
    selectionBackground: "#a8c8ff",
    black: "#000000",
  },
} as const;

export type AppTheme = "dark" | "light" | "black";

export function useTheme() {
  const theme = useSettingsStore((s) => s.settings.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return theme;
}

export function getTerminalTheme(theme: AppTheme) {
  return TERMINAL_THEMES[theme];
}
