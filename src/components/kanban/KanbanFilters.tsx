import { Search, X, Filter } from "lucide-react";
import { useKanbanStore } from "../../stores/kanban-store";
import type { KanbanPriority } from "../../types";

const PRIORITIES: { value: KanbanPriority; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#3498db" },
  { value: "medium", label: "Med", color: "#f39c12" },
  { value: "high", label: "High", color: "#e67e22" },
  { value: "urgent", label: "Urgent", color: "#e74c3c" },
];

export function KanbanFilters() {
  const searchQuery = useKanbanStore((s) => s.searchQuery);
  const setSearchQuery = useKanbanStore((s) => s.setSearchQuery);
  const filterLabelIds = useKanbanStore((s) => s.filterLabelIds);
  const toggleFilterLabel = useKanbanStore((s) => s.toggleFilterLabel);
  const filterPriority = useKanbanStore((s) => s.filterPriority);
  const setFilterPriority = useKanbanStore((s) => s.setFilterPriority);
  const clearFilters = useKanbanStore((s) => s.clearFilters);
  const labels = useKanbanStore((s) => s.board.labels);

  const hasFilters =
    searchQuery || filterLabelIds.length > 0 || filterPriority;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-surface-border bg-surface-light/30 flex-shrink-0">
      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search cards..."
          className="bg-surface border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-primary placeholder-white/20 focus:outline-none focus:border-accent-orange w-48"
        />
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-surface-border" />

      {/* Label filters */}
      <div className="flex items-center gap-1">
        <Filter size={12} className="text-white/30 mr-1" />
        {labels.map((label) => {
          const isActive = filterLabelIds.includes(label.id);
          return (
            <button
              key={label.id}
              onClick={() => toggleFilterLabel(label.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                isActive ? "ring-1 ring-white/40" : "opacity-30 hover:opacity-60"
              }`}
              style={{
                backgroundColor: label.color + "30",
                color: label.color,
              }}
            >
              {label.name}
            </button>
          );
        })}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-surface-border" />

      {/* Priority filter */}
      <div className="flex items-center gap-1">
        {PRIORITIES.map((p) => (
          <button
            key={p.value}
            onClick={() =>
              setFilterPriority(filterPriority === p.value ? null : p.value)
            }
            className={`text-[10px] px-2 py-0.5 rounded-lg font-medium transition-all ${
              filterPriority === p.value
                ? "ring-1 ring-white/40"
                : "opacity-30 hover:opacity-60"
            }`}
            style={{
              backgroundColor: p.color + "25",
              color: p.color,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors ml-auto"
        >
          <X size={12} />
          Clear
        </button>
      )}
    </div>
  );
}
