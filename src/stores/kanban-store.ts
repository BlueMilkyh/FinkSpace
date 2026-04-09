import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  KanbanLabel,
  KanbanChecklistItem,
  KanbanPriority,
} from "../types";
import { DEFAULT_LABELS } from "../types";

interface KanbanStore {
  board: KanbanBoard;

  // Columns
  addColumn: (title?: string) => void;
  removeColumn: (columnId: string) => void;
  renameColumn: (columnId: string, title: string) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;

  // Cards
  addCard: (columnId: string, title?: string) => KanbanCard;
  removeCard: (columnId: string, cardId: string) => void;
  updateCard: (columnId: string, cardId: string, updates: Partial<Omit<KanbanCard, "id" | "createdAt">>) => void;
  moveCard: (fromColumnId: string, toColumnId: string, cardId: string, toIndex?: number) => void;
  reorderCard: (columnId: string, fromIndex: number, toIndex: number) => void;

  // Labels
  addLabel: (label: Omit<KanbanLabel, "id">) => void;
  removeLabel: (labelId: string) => void;
  updateLabel: (labelId: string, updates: Partial<Omit<KanbanLabel, "id">>) => void;

  // Checklist
  addChecklistItem: (columnId: string, cardId: string, text: string) => void;
  removeChecklistItem: (columnId: string, cardId: string, itemId: string) => void;
  toggleChecklistItem: (columnId: string, cardId: string, itemId: string) => void;
  updateChecklistItem: (columnId: string, cardId: string, itemId: string, text: string) => void;

  // Card detail modal
  openCardId: string | null;
  openCardColumnId: string | null;
  openCard: (columnId: string, cardId: string) => void;
  closeCard: () => void;

  // Filters
  searchQuery: string;
  filterLabelIds: string[];
  filterPriority: KanbanPriority | null;
  setSearchQuery: (query: string) => void;
  toggleFilterLabel: (labelId: string) => void;
  setFilterPriority: (priority: KanbanPriority | null) => void;
  clearFilters: () => void;
}

const defaultBoard: KanbanBoard = {
  id: "default",
  name: "Board",
  columns: [
    { id: "todo", title: "To Do", cards: [] },
    { id: "in-progress", title: "In Progress", cards: [] },
    { id: "done", title: "Done", cards: [] },
  ],
  labels: DEFAULT_LABELS,
};

function mapCards(
  columns: KanbanColumn[],
  columnId: string,
  cardId: string,
  fn: (card: KanbanCard) => KanbanCard,
): KanbanColumn[] {
  return columns.map((c) =>
    c.id === columnId
      ? { ...c, cards: c.cards.map((card) => (card.id === cardId ? fn(card) : card)) }
      : c,
  );
}

export const useKanbanStore = create<KanbanStore>()(
  persist(
    (set, get) => ({
      board: defaultBoard,

      // ── Columns ──

      addColumn: (title) => {
        const col: KanbanColumn = {
          id: crypto.randomUUID(),
          title: title ?? "New Column",
          cards: [],
        };
        set((s) => ({
          board: { ...s.board, columns: [...s.board.columns, col] },
        }));
      },

      removeColumn: (columnId) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: s.board.columns.filter((c) => c.id !== columnId),
          },
        }));
      },

      renameColumn: (columnId, title) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: s.board.columns.map((c) =>
              c.id === columnId ? { ...c, title } : c,
            ),
          },
        }));
      },

      moveColumn: (fromIndex, toIndex) => {
        set((s) => {
          const cols = [...s.board.columns];
          const [moved] = cols.splice(fromIndex, 1);
          cols.splice(toIndex, 0, moved);
          return { board: { ...s.board, columns: cols } };
        });
      },

      // ── Cards ──

      addCard: (columnId, title) => {
        const card: KanbanCard = {
          id: crypto.randomUUID(),
          title: title ?? `Task ${Date.now().toString(36).slice(-4)}`,
          description: "",
          labelIds: [],
          priority: "none",
          dueDate: null,
          checklist: [],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          board: {
            ...s.board,
            columns: s.board.columns.map((c) =>
              c.id === columnId ? { ...c, cards: [...c.cards, card] } : c,
            ),
          },
        }));
        return card;
      },

      removeCard: (columnId, cardId) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: s.board.columns.map((c) =>
              c.id === columnId
                ? { ...c, cards: c.cards.filter((card) => card.id !== cardId) }
                : c,
            ),
          },
        }));
      },

      updateCard: (columnId, cardId, updates) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: mapCards(s.board.columns, columnId, cardId, (card) => ({
              ...card,
              ...updates,
            })),
          },
        }));
      },

      moveCard: (fromColumnId, toColumnId, cardId, toIndex) => {
        set((s) => {
          const fromCol = s.board.columns.find((c) => c.id === fromColumnId);
          const card = fromCol?.cards.find((c) => c.id === cardId);
          if (!card) return s;

          const columns = s.board.columns.map((c) => {
            if (c.id === fromColumnId) {
              return { ...c, cards: c.cards.filter((card) => card.id !== cardId) };
            }
            if (c.id === toColumnId) {
              const cards = [...c.cards];
              if (toIndex !== undefined) {
                cards.splice(toIndex, 0, card);
              } else {
                cards.push(card);
              }
              return { ...c, cards };
            }
            return c;
          });

          return { board: { ...s.board, columns } };
        });
      },

      reorderCard: (columnId, fromIndex, toIndex) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: s.board.columns.map((c) => {
              if (c.id !== columnId) return c;
              const cards = [...c.cards];
              const [moved] = cards.splice(fromIndex, 1);
              cards.splice(toIndex, 0, moved);
              return { ...c, cards };
            }),
          },
        }));
      },

      // ── Labels ──

      addLabel: (label) => {
        set((s) => ({
          board: {
            ...s.board,
            labels: [...s.board.labels, { ...label, id: crypto.randomUUID() }],
          },
        }));
      },

      removeLabel: (labelId) => {
        set((s) => ({
          board: {
            ...s.board,
            labels: s.board.labels.filter((l) => l.id !== labelId),
            // Also remove from all cards
            columns: s.board.columns.map((c) => ({
              ...c,
              cards: c.cards.map((card) => ({
                ...card,
                labelIds: card.labelIds.filter((id) => id !== labelId),
              })),
            })),
          },
        }));
      },

      updateLabel: (labelId, updates) => {
        set((s) => ({
          board: {
            ...s.board,
            labels: s.board.labels.map((l) =>
              l.id === labelId ? { ...l, ...updates } : l,
            ),
          },
        }));
      },

      // ── Checklist ──

      addChecklistItem: (columnId, cardId, text) => {
        const item: KanbanChecklistItem = {
          id: crypto.randomUUID(),
          text,
          done: false,
        };
        set((s) => ({
          board: {
            ...s.board,
            columns: mapCards(s.board.columns, columnId, cardId, (card) => ({
              ...card,
              checklist: [...card.checklist, item],
            })),
          },
        }));
      },

      removeChecklistItem: (columnId, cardId, itemId) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: mapCards(s.board.columns, columnId, cardId, (card) => ({
              ...card,
              checklist: card.checklist.filter((i) => i.id !== itemId),
            })),
          },
        }));
      },

      toggleChecklistItem: (columnId, cardId, itemId) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: mapCards(s.board.columns, columnId, cardId, (card) => ({
              ...card,
              checklist: card.checklist.map((i) =>
                i.id === itemId ? { ...i, done: !i.done } : i,
              ),
            })),
          },
        }));
      },

      updateChecklistItem: (columnId, cardId, itemId, text) => {
        set((s) => ({
          board: {
            ...s.board,
            columns: mapCards(s.board.columns, columnId, cardId, (card) => ({
              ...card,
              checklist: card.checklist.map((i) =>
                i.id === itemId ? { ...i, text } : i,
              ),
            })),
          },
        }));
      },

      // ── Card detail modal ──

      openCardId: null,
      openCardColumnId: null,
      openCard: (columnId, cardId) => set({ openCardId: cardId, openCardColumnId: columnId }),
      closeCard: () => set({ openCardId: null, openCardColumnId: null }),

      // ── Filters ──

      searchQuery: "",
      filterLabelIds: [],
      filterPriority: null,

      setSearchQuery: (query) => set({ searchQuery: query }),

      toggleFilterLabel: (labelId) => {
        const current = get().filterLabelIds;
        set({
          filterLabelIds: current.includes(labelId)
            ? current.filter((id) => id !== labelId)
            : [...current, labelId],
        });
      },

      setFilterPriority: (priority) => set({ filterPriority: priority }),

      clearFilters: () =>
        set({ searchQuery: "", filterLabelIds: [], filterPriority: null }),
    }),
    {
      name: "finkspace-kanban",
      partialize: (state) => ({ board: state.board }),
    },
  ),
);
