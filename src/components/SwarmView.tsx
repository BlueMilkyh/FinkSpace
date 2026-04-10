import { Network, ArrowLeft } from "lucide-react";
import { useNavigationStore } from "../stores/navigation-store";

export function SwarmView() {
  const goHome = useNavigationStore((s) => s.goHome);

  return (
    <div className="h-full w-full flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-6 text-center max-w-lg px-8">
        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Network size={40} className="text-white/40" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold text-white">FinkSwarm</h1>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-white/40 leading-relaxed">
            Launch a team of AI agents that work together in parallel. Give the goal,
            they write the code. This product is still in development.
          </p>
        </div>
        <button
          onClick={goHome}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-border hover:border-white/30 hover:bg-surface-light text-white/70 hover:text-white transition-all text-sm"
        >
          <ArrowLeft size={14} />
          Back to Home
        </button>
      </div>
    </div>
  );
}
