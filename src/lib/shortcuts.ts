import { isMac } from "./platform";

/**
 * Shared keyboard shortcut utilities.
 *
 * Storage format: `"Ctrl+Shift+Alt+<Key>"` with modifiers in a fixed order.
 * On macOS, stored `Ctrl` maps to Cmd (metaKey) at match time — storage
 * stays `Ctrl+...` so bindings are portable between platforms.
 */

export interface ParsedShortcut {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

/** Parse a stored shortcut string like "Ctrl+Shift+W" into its parts. */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split("+").map((p) => p.trim());
  return {
    ctrl: parts.includes("Ctrl"),
    shift: parts.includes("Shift"),
    alt: parts.includes("Alt"),
    key: parts.filter((p) => !["Ctrl", "Shift", "Alt"].includes(p))[0] ?? "",
  };
}

/** Serialize a parsed shortcut back to storage form. */
export function serializeShortcut(parsed: ParsedShortcut): string {
  const parts: string[] = [];
  if (parsed.ctrl) parts.push("Ctrl");
  if (parsed.shift) parts.push("Shift");
  if (parsed.alt) parts.push("Alt");
  if (parsed.key) parts.push(parsed.key);
  return parts.join("+");
}

/** True if the KeyboardEvent matches the given stored shortcut string. */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false;
  const parsed = parseShortcut(shortcut);
  if (!parsed.key) return false;
  // On macOS, Cmd (metaKey) is used instead of Ctrl
  const modPressed = isMac() ? e.metaKey : e.ctrlKey;
  if (modPressed !== parsed.ctrl) return false;
  if (e.shiftKey !== parsed.shift) return false;
  if (e.altKey !== parsed.alt) return false;

  const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const expectedKey = parsed.key.toUpperCase();

  // Digit keys: compare via e.code so Shift+1 ("!") still matches "1"
  if (/^[0-9]$/.test(expectedKey) && e.code === `Digit${expectedKey}`) {
    return true;
  }

  if (expectedKey === "]" && e.key === "]") return true;
  if (expectedKey === "[" && e.key === "[") return true;
  if (expectedKey === "," && e.key === ",") return true;

  return pressedKey === expectedKey;
}

/** True if the event is a modifier-only keydown (no main key pressed yet). */
export function isModifierOnly(e: KeyboardEvent): boolean {
  return (
    e.key === "Control" ||
    e.key === "Shift" ||
    e.key === "Alt" ||
    e.key === "Meta"
  );
}

/** Extract the "main" key name from a KeyboardEvent for shortcut storage. */
export function getShortcutKey(e: KeyboardEvent): string {
  // Digit keys: always store the digit character (e.code = "Digit1" → "1")
  if (/^Digit[0-9]$/.test(e.code)) {
    return e.code.slice(5);
  }
  // Function keys, arrows, named keys
  if (e.key.length > 1) {
    return e.key;
  }
  // Single-char keys — uppercase for letters, pass through punctuation
  return e.key.toUpperCase();
}

/**
 * Build a shortcut string from a KeyboardEvent. Returns `null` if the event
 * is a modifier-only keydown (no main key yet).
 */
export function formatShortcutFromEvent(e: KeyboardEvent): string | null {
  if (isModifierOnly(e)) return null;
  const key = getShortcutKey(e);
  if (!key) return null;
  return serializeShortcut({
    // On Mac we capture metaKey as Ctrl so storage stays portable
    ctrl: isMac() ? e.metaKey : e.ctrlKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key,
  });
}

/**
 * Convert a stored shortcut string into display parts for `<kbd>` rendering.
 * Uses ⌘ ⇧ ⌥ glyphs on macOS, "Ctrl"/"Shift"/"Alt" text elsewhere.
 */
export function shortcutToParts(shortcut: string): string[] {
  if (!shortcut) return [];
  const mac = isMac();
  return shortcut.split("+").map((p) => {
    const key = p.trim();
    if (key === "Ctrl") return mac ? "⌘" : "Ctrl";
    if (key === "Shift") return mac ? "⇧" : "Shift";
    if (key === "Alt") return mac ? "⌥" : "Alt";
    return key;
  });
}

/**
 * Is this shortcut "safe" — i.e. has at least one modifier, or uses a
 * non-typing key (F1–F12, Escape, arrows, etc.)?
 *
 * Used to warn when the user binds a bare letter/digit that would
 * interfere with normal typing.
 */
export function isSafeShortcut(shortcut: string): boolean {
  const parsed = parseShortcut(shortcut);
  if (!parsed.key) return true; // empty = unbound, no danger
  if (parsed.ctrl || parsed.shift || parsed.alt) return true;
  const k = parsed.key;
  // Function keys
  if (/^F([1-9]|1[0-2])$/.test(k)) return true;
  // Named non-printable keys
  if (k.length > 1) return true;
  return false;
}
