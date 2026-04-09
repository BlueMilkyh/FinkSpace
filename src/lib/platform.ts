import { homeDir } from "@tauri-apps/api/path";
import { type as osType } from "@tauri-apps/plugin-os";

export type Platform = "windows" | "macos" | "linux";

let _platform: Platform = "windows";
let _homeDir = "";
let _initialized = false;

export async function initPlatform(): Promise<void> {
  if (_initialized) return;

  try {
    const os = osType();
    if (os === "macos") _platform = "macos";
    else if (os === "linux") _platform = "linux";
    else _platform = "windows";
  } catch {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) _platform = "macos";
    else if (ua.includes("linux")) _platform = "linux";
  }

  try {
    _homeDir = await homeDir();
    // Remove trailing separator
    if (_homeDir.endsWith("/") || _homeDir.endsWith("\\")) {
      _homeDir = _homeDir.slice(0, -1);
    }
  } catch {
    _homeDir = _platform === "windows" ? "C:\\Users" : "/Users";
  }

  _initialized = true;
}

export function getPlatform(): Platform {
  return _platform;
}

export function getHome(): string {
  return _homeDir;
}

export function isMac(): boolean {
  return _platform === "macos";
}

export function isWindows(): boolean {
  return _platform === "windows";
}

export function modKey(): string {
  return _platform === "macos" ? "Cmd" : "Ctrl";
}
