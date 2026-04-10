import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight } from "lucide-react";

interface CdInputProps {
  cwd: string;
  onChange: (newCwd: string) => void;
}

export function CdInput({ cwd, onChange }: CdInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // If cwd is empty, ask the backend for the home directory once.
  useEffect(() => {
    if (!cwd) {
      invoke<string>("home_dir")
        .then((home) => onChange(home))
        .catch(() => {});
    }
  }, [cwd, onChange]);

  const displayCwd = cwd || "~";

  const runCommand = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Accept either a bare path or `cd <path>`.
    let target = trimmed;
    if (trimmed === "cd") {
      // bare `cd` → go home
      try {
        const home = await invoke<string>("home_dir");
        onChange(home);
        setValue("");
        setError(null);
      } catch (e) {
        setError(String(e));
      }
      return;
    }
    if (trimmed.startsWith("cd ")) {
      target = trimmed.slice(3).trim();
    }
    // Strip surrounding quotes
    if (
      (target.startsWith('"') && target.endsWith('"')) ||
      (target.startsWith("'") && target.endsWith("'"))
    ) {
      target = target.slice(1, -1);
    }

    setBusy(true);
    try {
      const resolved = await invoke<string>("resolve_dir", {
        base: cwd,
        input: target,
      });
      onChange(resolved);
      setValue("");
      setError(null);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-1.5">
      <div
        onClick={() => inputRef.current?.focus()}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border ${
          error ? "border-red-500/50" : "border-white/10 hover:border-white/20 focus-within:border-accent-orange/50"
        } font-mono text-xs transition-colors cursor-text`}
      >
        <ChevronRight size={12} className="text-accent-orange flex-shrink-0" />
        <span className="text-white/40 truncate max-w-[40%]" title={displayCwd}>
          {displayCwd}
        </span>
        <span className="text-white/30">$</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={busy}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runCommand(value);
            }
          }}
          placeholder="cd ..  or  cd src/components"
          className="flex-1 bg-transparent outline-none text-white placeholder:text-white/20"
        />
      </div>
      {error && (
        <span className="text-[11px] text-red-400/80 font-mono px-1">{error}</span>
      )}
    </div>
  );
}
