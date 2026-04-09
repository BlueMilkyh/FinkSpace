import { GripVertical, X, Calendar, CheckSquare } from "lucide-react";
import { useKanbanStore } from "../../stores/kanban-store";
import type { KanbanCard } from "../../types";

interface KanbanCardItemProps {
  card: KanbanCard;
  columnId: string;
  index: number;
  onDragStart: (cardId: string, columnId: string, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
  dimmed?: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "#3498db",
  medium: "#f39c12",
  high: "#e67e22",
  urgent: "#e74c3c",
};

export function KanbanCardItem({
  card,
  columnId,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  dimmed,
}: KanbanCardItemProps) {
  const removeCard = useKanbanStore((s) => s.removeCard);
  const openCard = useKanbanStore((s) => s.openCard);
  const labels = useKanbanStore((s) => s.board.labels);

  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const checkDone = card.checklist.filter((i) => i.done).length;
  const checkTotal = card.checklist.length;
  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date() ? true : false;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(card.id, columnId, index);
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={onDrop}
      onClick={() => openCard(columnId, card.id)}
      className={`group flex flex-col gap-1.5 bg-surface rounded-md border border-surface-border p-2.5 cursor-grab active:cursor-grabbing hover:border-white/20 transition-colors ${
        dimmed ? "opacity-30 pointer-events-none" : ""
      }`}
    >
      {/* Labels row */}
      {cardLabels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cardLabels.map((label) => (
            <span
              key={label.id}
              className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: label.color + "30",
                color: label.color,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Title row */}
      <div className="flex items-start gap-2">
        <GripVertical
          size={14}
          className="text-white/20 mt-0.5 flex-shrink-0"
        />

        {/* Priority dot */}
        {card.priority !== "none" && (
          <div
            className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: PRIORITY_COLORS[card.priority] }}
            title={card.priority}
          />
        )}

        <span className="flex-1 text-sm text-white/80 leading-snug break-words">
          {card.title}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            removeCard(columnId, card.id);
          }}
          className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Footer indicators */}
      {(card.dueDate || checkTotal > 0) && (
        <div className="flex items-center gap-3 ml-6 text-[10px]">
          {card.dueDate && (
            <span
              className={`flex items-center gap-1 ${
                isOverdue ? "text-red-400" : "text-white/30"
              }`}
            >
              <Calendar size={10} />
              {new Date(card.dueDate).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {checkTotal > 0 && (
            <span
              className={`flex items-center gap-1 ${
                checkDone === checkTotal ? "text-green-400" : "text-white/30"
              }`}
            >
              <CheckSquare size={10} />
              {checkDone}/{checkTotal}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
