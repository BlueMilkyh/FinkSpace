import { Copy, RefreshCw, Terminal, Zap, Settings, CheckCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { isWindows, getHome } from "../../lib/platform";

const APP_NAME = "finkspace";
const IS_WIN = isWindows();
const LAUNCHER_PATH = IS_WIN
  ? `${getHome()}\\AppData\\Local\\FinkSpace\\bin\\${APP_NAME}.exe`
  : `/usr/local/bin/${APP_NAME}`;
const BIN_DIR = IS_WIN
  ? `${getHome()}\\AppData\\Local\\FinkSpace\\bin`
  : `/usr/local/bin`;
const PATH_COMMAND = IS_WIN
  ? `setx PATH "%PATH%;${BIN_DIR}"`
  : `export PATH="$PATH:${BIN_DIR}" # add to ~/.zshrc or ~/.bashrc`;

type CliStatus = "checking" | "ready" | "not-installed";

export function CLISection() {
  const [copied, setCopied] = useState<string | null>(null);
  const [cliStatus, setCliStatus] = useState<CliStatus>("checking");
  const [pathStatus, setPathStatus] = useState<"checking" | "ready" | "not-configured">("checking");

  useEffect(() => {
    // Simulate checking CLI status
    const timer = setTimeout(() => {
      setCliStatus("not-installed");
      setPathStatus("not-configured");
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <Terminal size={22} className="text-white/70" />
        <h2 className="text-lg font-semibold text-primary">CLI</h2>
      </div>
      <p className="text-sm text-secondary mb-6">
        Install and configure the <code className="text-white/70 bg-surface px-1 rounded">{APP_NAME}</code> command so <code className="text-white/70 bg-surface px-1 rounded">{APP_NAME} .</code> opens the current folder in FinkSpace.
      </p>

      <div className="flex flex-col gap-4">
        {/* CLI Launcher */}
        <div className="rounded-lg border border-surface-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-light/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center border border-surface-border">
                <Terminal size={16} className="text-white/50" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">FinkSpace CLI Launcher</span>
                  {cliStatus === "ready" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green uppercase">Ready</span>
                  )}
                  {cliStatus === "not-installed" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent-yellow/20 text-accent-yellow uppercase">Not Installed</span>
                  )}
                  {cliStatus === "checking" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface text-secondary uppercase">Checking...</span>
                  )}
                </div>
                <p className="text-xs text-secondary mt-0.5">Install the launcher FinkSpace uses for terminal workflows like <code className="text-white/50">{APP_NAME} .</code></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cliStatus === "ready" ? (
                <>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-blue/20 border border-accent-blue/40 text-accent-blue text-xs font-medium hover:bg-accent-blue/30 transition-colors">
                    <RefreshCw size={12} />
                    Refresh CLI
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-secondary font-medium hover:text-primary hover:border-white/30 transition-colors">
                    <Copy size={12} />
                    Remove CLI
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setCliStatus("ready")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-orange/20 border border-accent-orange/40 text-accent-orange text-xs font-medium hover:bg-accent-orange/30 transition-colors"
                >
                  <Zap size={12} />
                  Install CLI
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-3 flex gap-4">
            <div className="flex-1">
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Launcher Path</span>
              <div className="mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-secondary font-mono truncate">
                {LAUNCHER_PATH}
              </div>
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">Bin Directory</span>
              <div className="mt-1 bg-surface border border-surface-border rounded-lg px-3 py-2 text-xs text-secondary font-mono truncate">
                {BIN_DIR}
              </div>
            </div>
          </div>
        </div>

        {/* PATH Configuration */}
        <div className="rounded-lg border border-surface-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-surface-light/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center border border-surface-border">
                <Settings size={16} className="text-white/50" />
              </div>
              <div>
                <span className="text-sm font-semibold text-primary">PATH Configuration</span>
                <p className="text-xs text-secondary mt-0.5">Make sure your shell can find the launcher from new terminal windows.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPathStatus("ready")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green text-xs font-medium hover:bg-accent-green/30 transition-colors"
              >
                <Zap size={12} />
                Add to PATH
              </button>
              <button
                onClick={() => copyToClipboard(PATH_COMMAND, "path")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border text-xs text-secondary font-medium hover:text-primary hover:border-white/30 transition-colors"
              >
                <Copy size={12} />
                {copied === "path" ? "Copied!" : "Copy Command"}
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            {pathStatus === "ready" ? (
              <div className="flex items-center gap-2 bg-accent-green/10 border border-accent-green/20 rounded-lg px-3 py-2.5">
                <CheckCircle size={14} className="text-accent-green flex-shrink-0" />
                <span className="text-sm text-accent-green">
                  PATH looks ready. Open a new terminal window and run <code className="font-mono font-bold">{APP_NAME} .</code>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg px-3 py-2.5">
                <AlertCircle size={14} className="text-accent-yellow flex-shrink-0" />
                <span className="text-sm text-accent-yellow">
                  PATH is not configured. Click "Add to PATH" or run the command manually.
                </span>
              </div>
            )}
            <p className="text-xs text-secondary mt-3 flex items-center gap-1.5">
              <AlertCircle size={11} className="flex-shrink-0" />
              After installing or updating PATH, open a new terminal window before testing <code className="text-white/50 bg-surface px-1 rounded">{APP_NAME} .</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
