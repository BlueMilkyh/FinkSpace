import { useEffect } from "react";
import { useSettingsStore } from "../stores/settings-store";

const TERMINAL_THEMES = {
  dark: {
    background: "#1a1b2e",
    foreground: "#e0e0e0",
    selectionBackground: "#3a3c5c",
    black: "#1a1b2e",
  },
  black: {
    background: "#000000",
    foreground: "#e0e0e0",
    selectionBackground: "#333333",
    black: "#000000",
  },
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    selectionBackground: "#b4d5fe",
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
