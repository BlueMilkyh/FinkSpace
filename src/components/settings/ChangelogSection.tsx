import { useState } from "react";
import { Tag, Zap, Wrench, TrendingUp, ArrowLeftRight, Minus } from "lucide-react";
import { CHANGELOG, type ChangeType, type ProductTag } from "../../lib/changelog";

const APP_VERSION = __APP_VERSION__;

type Filter = "All" | "FinkSpace" | "FinkSwarm";

const TYPE_META: Record<ChangeType, { label: string; color: string; icon: React.ElementType }> = {
  added:    { label: "Added",    color: "#2ecc71", icon: Zap },
  fixed:    { label: "Fixed",    color: "#e74c3c", icon: Wrench },
  improved: { label: "Improved", color: "#3498db", icon: TrendingUp },
  changed:  { label: "Changed",  color: "#f1c40f", icon: ArrowLeftRight },
  removed:  { label: "Removed",  color: "#95a5a6", icon: Minus },
};

const PRODUCT_COLORS: Record<ProductTag, string> = {
  FinkSpace: "#e67e22",
  FinkSwarm: "#00bcd4",
  Both:      "#9b59b6",
};

export function ChangelogSection() {
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = CHANGELOG.filter((entry) => {
    if (filter === "All") return true;
    return entry.product === filter || entry.product === "Both";
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-white">Changelog</h2>
        <p className="text-xs text-white/40">
          What's new in FinkSpace &amp; FinkSwarm — currently on{" "}
          <span className="font-mono text-accent-orange">v{APP_VERSION}</span>
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface w-fit">
        {(["All", "FinkSpace", "FinkSwarm"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === f
                ? "bg-surface-light text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="flex flex-col gap-6">
        {filtered.map((entry) => {
          const isLatest = entry.version === APP_VERSION;
          const productColor = PRODUCT_COLORS[entry.product];
          const visibleChanges =
            filter === "All"
              ? entry.changes
              : entry.changes.filter(
                  (c) => !c.product || c.product === filter || c.product === "Both"
                );

          return (
            <div
              key={entry.version}
              className="rounded-xl border border-surface-border bg-surface overflow-hidden"
            >
              {/* Version header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border bg-surface-light/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold font-mono text-white">
                      v{entry.version}
                    </span>
                    {isLatest && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent-orange/20 text-accent-orange border border-accent-orange/30">
                        Current
                      </span>
                    )}
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{
                      color: productColor,
                      borderColor: productColor + "40",
                      background: productColor + "12",
                    }}
                  >
                    {entry.product}
                  </span>
                </div>
                <span className="text-[11px] text-white/30 font-mono">{entry.date}</span>
              </div>

              {/* Highlight */}
              {entry.highlights && (
                <div className="px-4 pt-3 pb-0">
                  <p className="text-xs text-white/60 italic">{entry.highlights}</p>
                </div>
              )}

              {/* Change items */}
              <div className="px-4 py-3 flex flex-col gap-2">
                {visibleChanges.map((change, i) => {
                  const meta = TYPE_META[change.type];
                  const Icon = meta.icon;
                  return (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: meta.color + "18", color: meta.color }}
                      >
                        <Icon size={11} />
                      </div>
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 mt-[1px]"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span className="text-xs text-white/70 leading-relaxed">
                          {change.text}
                        </span>
                      </div>
                      {change.product && filter === "All" && entry.product === "Both" && (
                        <span
                          className="text-[9px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5"
                          style={{
                            color: PRODUCT_COLORS[change.product],
                            borderColor: PRODUCT_COLORS[change.product] + "40",
                            background: PRODUCT_COLORS[change.product] + "10",
                          }}
                        >
                          {change.product}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-[11px] text-white/25">
        <Tag size={11} />
        <span>Older releases are on GitHub — BlueMilkyh/FinkSpace</span>
      </div>
    </div>
  );
}
