import { useCallback, useRef } from "react";
import { Plus } from "lucide-react";
import { useKanbanStore } from "../stores/kanban-store";
import { KanbanColumnView } from "./kanban/KanbanColumnView";
import { KanbanFilters } from "./kanban/KanbanFilters";
import { CardDetailModal } from "./kanban/CardDetailModal";

export function KanbanBoard() {
  const board = useKanbanStore((s) => s.board);
  const addColumn = useKanbanStore((s) => s.addColumn);
  const moveCard = useKanbanStore((s) => s.moveCard);
  const reorderCard = useKanbanStore((s) => s.reorderCard);
  const searchQuery = useKanbanStore((s) => s.searchQuery);
  const filterLabelIds = useKanbanStore((s) => s.filterLabelIds);
  const filterPriority = useKanbanStore((s) => s.filterPriority);

  // Drag state ref (avoids re-renders during drag)
  const dragRef = useRef<{
    cardId: string;
    fromColumnId: string;
    fromIndex: number;
    toColumnId: string;
    toIndex: number;
  } | null>(null);

  const handleDragStart = useCallback(
    (cardId: string, columnId: string, index: number) => {
      dragRef.current = {
        cardId,
        fromColumnId: columnId,
        fromIndex: index,
        toColumnId: columnId,
        toIndex: index,
      };
    },
    [],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, columnId: string, index: number) => {
      e.preventDefault();
      if (dragRef.current) {
        dragRef.current.toColumnId = columnId;
        dragRef.current.toIndex = index;
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (_e: React.DragEvent, columnId: string) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.fromColumnId === columnId) {
        // Reorder within same column
        if (drag.fromIndex !== drag.toIndex) {
          reorderCard(columnId, drag.fromIndex, drag.toIndex);
        }
      } else {
        // Move between columns
        moveCard(drag.fromColumnId, columnId, drag.cardId, drag.toIndex);
      }

      dragRef.current = null;
    },
    [moveCard, reorderCard],
  );

  // Compute dimmed cards based on filters
  const getDimmedCardIds = useCallback((): Set<string> => {
    const hasFilter =
      searchQuery || filterLabelIds.length > 0 || filterPriority;
    if (!hasFilter) return new Set();

    const dimmed = new Set<string>();
    const query = searchQuery.toLowerCase();

    for (const col of board.columns) {
      for (const card of col.cards) {
        let matches = true;

        if (query && !card.title.toLowerCase().includes(query)) {
          matches = false;
        }

        if (
          filterLabelIds.length > 0 &&
          !filterLabelIds.some((id) => card.labelIds.includes(id))
        ) {
          matches = false;
        }

        if (filterPriority && card.priority !== filterPriority) {
          matches = false;
        }

        if (!matches) dimmed.add(card.id);
      }
    }

    return dimmed;
  }, [board.columns, searchQuery, filterLabelIds, filterPriority]);

  const dimmedCardIds = getDimmedCardIds();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <KanbanFilters />

      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {board.columns.map((column) => (
          <KanbanColumnView
            key={column.id}
            columnId={column.id}
            title={column.title}
            cards={column.cards}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            dimmedCardIds={dimmedCardIds}
          />
        ))}

        {/* Add column */}
        <button
          onClick={() => addColumn()}
          className="flex items-center justify-center w-72 flex-shrink-0 h-12 rounded-lg border border-dashed border-surface-border text-white/30 hover:text-white/60 hover:border-white/30 transition-colors text-sm gap-2"
        >
          <Plus size={14} />
          Add column
        </button>
      </div>

      <CardDetailModal />
    </div>
  );
}
