import { useEffect, useState } from "react";
import { SquareTerminal, Network } from "lucide-react";
import { useNavigationStore } from "../stores/navigation-store";
import { useSettingsStore } from "../stores/settings-store";
import { isMac } from "../lib/platform";

function formatShortcut(shortcut: string | undefined): string[] {
  if (!shortcut) return [];
  return shortcut.split("+").map((k) => {
    const key = k.trim();
    if (key === "Ctrl" && isMac()) return "⌘";
    if (key === "Shift") return "⇧";
    if (key === "Alt") return isMac() ? "⌥" : "Alt";
    return key;
  });
}

const PREFIX = "Build the future with ";
const ROTATING_WORDS = ["Fink", "AI", "Style"];

type Phase = "prefix" | "typing" | "holding" | "deleting";

export function HomeView() {
  const setActiveView = useNavigationStore((s) => s.setActiveView);
  const shortcuts = useSettingsStore((s) => s.settings.shortcuts);
  const finkSpaceKeys = formatShortcut(shortcuts?.openFinkSpace);
  const finkSwarmKeys = formatShortcut(shortcuts?.openFinkSwarm);

  // Typewriter: types the prefix once, then cycles through rotating words.
  const [prefixLen, setPrefixLen] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [wordLen, setWordLen] = useState(0);
  const [phase, setPhase] = useState<Phase>("prefix");

  useEffect(() => {
    if (phase === "prefix") {
      if (prefixLen < PREFIX.length) {
        const t = setTimeout(() => setPrefixLen((n) => n + 1), 75);
        return () => clearTimeout(t);
      }
      setPhase("typing");
      return;
    }

    const word = ROTATING_WORDS[wordIdx];

    if (phase === "typing") {
      if (wordLen < word.length) {
        const t = setTimeout(() => setWordLen((n) => n + 1), 180);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("holding"), 2800);
      return () => clearTimeout(t);
    }

    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), 600);
      return () => clearTimeout(t);
    }

    if (phase === "deleting") {
      if (wordLen > 0) {
        const t = setTimeout(() => setWordLen((n) => n - 1), 90);
        return () => clearTimeout(t);
      }
      setWordIdx((i) => (i + 1) % ROTATING_WORDS.length);
      setPhase("typing");
      return;
    }
  }, [phase, prefixLen, wordLen, wordIdx]);

  const prefixText = PREFIX.slice(0, prefixLen);
  const wordText = ROTATING_WORDS[wordIdx].slice(0, wordLen);

  return (
    <div className="relative h-full w-full flex items-center justify-center bg-surface overflow-hidden">
      {/* Ambient neon glow background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-orange/[0.07] blur-[120px]" />
        <div className="absolute -bottom-32 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
      </div>

      {/* Sweeping scanline */}
      <div className="neon-scanline" />

      <div className="relative flex flex-col items-center gap-10 px-8 py-12 max-w-4xl w-full">
        {/* Logo + wordmark */}
        <div className="flex flex-col items-center gap-4">
          <div className="neon-float">
            <div className="snake-neon neon-pulse-orange w-24 h-24 rounded-2xl bg-accent-orange/5 border border-accent-orange/30 flex items-center justify-center overflow-hidden">
              <img
                src="/app-icon.png"
                alt="FinkSpace"
                className="w-16 h-16 object-contain drop-shadow-[0_0_12px_rgba(255,140,40,0.6)]"
                draggable={false}
              />
            </div>
          </div>
          <h1 className="font-mono text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,140,40,0.25)] min-h-[2.5rem]">
            <span>{prefixText}</span>
            <span className="text-accent-orange drop-shadow-[0_0_12px_rgba(255,140,40,0.5)]">
              {wordText}
            </span>
            <span
              className="typewriter-cursor inline-block w-[0.6ch] -mb-0.5 ml-0.5 bg-accent-orange align-baseline"
              style={{ height: "1em" }}
            />
          </h1>
          <p className="text-sm text-white/40">Choose how you want to work.</p>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
          {/* FinkSpace card */}
          <button
            onClick={() => setActiveView("terminal")}
            className="snake-neon group relative flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-light/40 border border-surface-border transition-transform duration-300 text-left hover:-translate-y-0.5"
          >
            <span className="absolute top-3 right-3 text-[10px] font-mono text-white/25">
              #1
            </span>
            <div className="w-12 h-12 rounded-xl bg-accent-orange/10 border border-accent-orange/40 flex items-center justify-center">
              <SquareTerminal size={24} className="text-accent-orange" />
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold text-white">FinkSpace</h2>
              <p className="text-sm text-white/50 leading-relaxed">
                Open a terminal workspace. Split into grids, add AI agents, and run
                everything side by side.
              </p>
            </div>
            {finkSpaceKeys.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {finkSpaceKeys.map((k, i) => (
                  <kbd
                    key={i}
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-surface-border bg-surface/80 text-[10px] font-mono text-white/50"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            )}
          </button>

          {/* FinkSwarm card (placeholder) */}
          <button
            onClick={() => setActiveView("swarm")}
            className="snake-neon snake-neon-cyan group relative flex flex-col items-start gap-4 p-6 rounded-2xl bg-surface-light/40 border border-surface-border transition-transform duration-300 text-left hover:-translate-y-0.5"
          >
            <span className="absolute top-3 right-3 text-[10px] font-mono text-white/25">
              #2
            </span>
            <div className="w-12 h-12 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
              <Network size={24} className="text-cyan-300" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">FinkSwarm</h2>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-white/40 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </div>
              <p className="text-sm text-white/50 leading-relaxed">
                Launch a team of AI agents that work together in parallel. Give the
                goal, they write the code.
              </p>
            </div>
            {finkSwarmKeys.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {finkSwarmKeys.map((k, i) => (
                  <kbd
                    key={i}
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-surface-border bg-surface/80 text-[10px] font-mono text-white/50"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
