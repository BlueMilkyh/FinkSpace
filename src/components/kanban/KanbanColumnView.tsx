import { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { useKanbanStore } from "../../stores/kanban-store";
import { KanbanCardItem } from "./KanbanCardItem";
import type { KanbanCard } from "../../types";

interface KanbanColumnViewProps {
  columnId: string;
  title: string;
  cards: KanbanCard[];
  onDragStart: (cardId: string, columnId: string, index: number) => void;
  onDragOver: (e: React.DragEvent, columnId: string, index: number) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  dimmedCardIds?: Set<string>;
}

export function KanbanColumnView({
  columnId,
  title,
  cards,
  onDragStart,
  onDragOver,
  onDrop,
  dimmedCardIds,
}: KanbanColumnViewProps) {
  const addCard = useKanbanStore((s) => s.addCard);
  const removeColumn = useKanbanStore((s) => s.removeColumn);
  const renameColumn = useKanbanStore((s) => s.renameColumn);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={columnRef}
      className="flex flex-col w-72 flex-shrink-0 bg-surface-light rounded-lg border border-surface-border"
      onDragOver={(e) => {
        e.preventDefault();
        // If dragging over the empty area below cards, target end
        onDragOver(e, columnId, cards.length);
      }}
      onDrop={(e) => {
        setDropTarget(null);
        onDrop(e, columnId);
      }}
      onDragLeave={() => setDropTarget(null)}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-border">
        <input
          className="text-sm font-semibold text-white/90 bg-transparent outline-none flex-1"
          value={title}
          onChange={(e) => renameColumn(columnId, e.target.value)}
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-white/30 mr-1">{cards.length}</span>
          <button
            onClick={() => removeColumn(columnId)}
            className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto min-h-[100px]">
        {cards.map((card, index) => (
          <KanbanCardItem
            key={card.id}
            card={card}
            columnId={columnId}
            index={index}
            onDragStart={onDragStart}
            onDragOver={(e, idx) => {
              e.preventDefault();
              e.stopPropagation();
              setDropTarget(idx);
              onDragOver(e, columnId, idx);
            }}
            onDrop={(e) => {
              setDropTarget(null);
              onDrop(e, columnId);
            }}
            dimmed={dimmedCardIds?.has(card.id)}
          />
        ))}
        {/* Drop indicator at the end */}
        {dropTarget === cards.length && (
          <div className="h-0.5 bg-accent-orange/50 rounded-full" />
        )}
      </div>

      {/* Add card */}
      <button
        onClick={() => addCard(columnId)}
        className="flex items-center gap-2 px-3 py-2 text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors text-sm border-t border-surface-border"
      >
        <Plus size={14} />
        Add card
      </button>
    </div>
  );
}
