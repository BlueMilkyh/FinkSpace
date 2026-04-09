import { useState, useEffect, useCallback } from "react";
import { Download, X, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; body: string }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  const checkForUpdate = useCallback(async () => {
    try {
      const update = await check();
      if (update) {
        setState({
          status: "available",
          version: update.version,
          body: update.body ?? "",
        });
      }
    } catch (e) {
      // Silently fail on update check - not critical
      console.warn("Update check failed:", e);
    }
  }, []);

  useEffect(() => {
    // Check on startup after a short delay
    const timer = setTimeout(checkForUpdate, 5000);
    // Check every 30 minutes
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  const handleDownloadAndInstall = async () => {
    try {
      setState({ status: "downloading", progress: 0 });
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setState({
              status: "downloading",
              progress: contentLength > 0 ? Math.round((downloaded / contentLength) * 100) : 0,
            });
            break;
          case "Finished":
            break;
        }
      });

      setState({ status: "ready" });
    } catch (e) {
      setState({ status: "error", message: String(e) });
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  if (state.status === "idle" || dismissed) return null;

  return (
    <div className="fixed bottom-16 right-4 z-50 w-80 bg-surface border border-surface-border rounded-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-light border-b border-surface-border">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Update</span>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      <div className="p-3">
        {state.status === "available" && (
          <>
            <div className="flex items-start gap-2.5 mb-3">
              <Download size={16} className="text-accent-orange mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-primary">
                  FinkSpace {state.version} available
                </p>
                {state.body && (
                  <p className="text-xs text-secondary mt-1 line-clamp-3">{state.body}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadAndInstall}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-orange/20 border border-accent-orange/40 text-accent-orange text-xs font-medium hover:bg-accent-orange/30 transition-colors"
              >
                <Download size={12} />
                Update now
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-secondary hover:text-primary transition-colors"
              >
                Later
              </button>
            </div>
          </>
        )}

        {state.status === "downloading" && (
          <div className="flex items-center gap-2.5">
            <RefreshCw size={14} className="text-accent-blue animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-primary">Downloading... {state.progress}%</p>
              <div className="w-full h-1.5 bg-surface-lighter rounded-full mt-1.5 overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {state.status === "ready" && (
          <>
            <div className="flex items-center gap-2.5 mb-3">
              <CheckCircle size={16} className="text-accent-green flex-shrink-0" />
              <p className="text-sm text-primary">Update ready. Restart to apply.</p>
            </div>
            <button
              onClick={handleRelaunch}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-green/20 border border-accent-green/40 text-accent-green text-xs font-medium hover:bg-accent-green/30 transition-colors"
            >
              <RefreshCw size={12} />
              Restart FinkSpace
            </button>
          </>
        )}

        {state.status === "error" && (
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="text-accent-red mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-primary">Update failed</p>
              <p className="text-xs text-secondary mt-0.5">{state.message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
