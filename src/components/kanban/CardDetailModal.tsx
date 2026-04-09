import { useState } from "react";
import {
  X,
  Tag,
  Flag,
  Calendar,
  CheckSquare,
  Plus,
  Trash2,
  AlignLeft,
} from "lucide-react";
import { useKanbanStore } from "../../stores/kanban-store";
import type { KanbanPriority } from "../../types";

const PRIORITIES: { value: KanbanPriority; label: string; color: string }[] = [
  { value: "none", label: "None", color: "#6b7280" },
  { value: "low", label: "Low", color: "#3498db" },
  { value: "medium", label: "Medium", color: "#f39c12" },
  { value: "high", label: "High", color: "#e67e22" },
  { value: "urgent", label: "Urgent", color: "#e74c3c" },
];

export function CardDetailModal() {
  const openCardId = useKanbanStore((s) => s.openCardId);
  const openCardColumnId = useKanbanStore((s) => s.openCardColumnId);
  const closeCard = useKanbanStore((s) => s.closeCard);
  const board = useKanbanStore((s) => s.board);
  const updateCard = useKanbanStore((s) => s.updateCard);
  const addChecklistItem = useKanbanStore((s) => s.addChecklistItem);
  const removeChecklistItem = useKanbanStore((s) => s.removeChecklistItem);
  const toggleChecklistItem = useKanbanStore((s) => s.toggleChecklistItem);
  const updateChecklistItem = useKanbanStore((s) => s.updateChecklistItem);

  const [newCheckItem, setNewCheckItem] = useState("");

  if (!openCardId || !openCardColumnId) return null;

  const column = board.columns.find((c) => c.id === openCardColumnId);
  const card = column?.cards.find((c) => c.id === openCardId);
  if (!card || !column) return null;

  const checkDone = card.checklist.filter((i) => i.done).length;
  const checkTotal = card.checklist.length;
  const checkPercent = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0;

  const toggleLabel = (labelId: string) => {
    const newLabelIds = card.labelIds.includes(labelId)
      ? card.labelIds.filter((id) => id !== labelId)
      : [...card.labelIds, labelId];
    updateCard(openCardColumnId, openCardId, { labelIds: newLabelIds });
  };

  const handleAddCheckItem = () => {
    if (!newCheckItem.trim()) return;
    addChecklistItem(openCardColumnId, openCardId, newCheckItem.trim());
    setNewCheckItem("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      onClick={closeCard}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl bg-surface-light border border-surface-border rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex-1">
            <input
              className="text-lg font-semibold text-white bg-transparent outline-none w-full border-b border-transparent focus:border-white/20 pb-1"
              value={card.title}
              onChange={(e) =>
                updateCard(openCardColumnId, openCardId, {
                  title: e.target.value,
                })
              }
            />
            <span className="text-xs text-secondary mt-1 block">
              in <span className="text-white/60">{column.title}</span>
            </span>
          </div>
          <button
            onClick={closeCard}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-5 flex flex-col gap-5">
          {/* Labels */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={14} className="text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Labels
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {board.labels.map((label) => {
                const isActive = card.labelIds.includes(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => toggleLabel(label.id)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                      isActive
                        ? "ring-1 ring-white/30"
                        : "opacity-40 hover:opacity-70"
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
          </div>

          {/* Priority */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flag size={14} className="text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Priority
              </span>
            </div>
            <div className="flex gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() =>
                    updateCard(openCardColumnId, openCardId, {
                      priority: p.value,
                    })
                  }
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    card.priority === p.value
                      ? "border-white/30"
                      : "border-transparent opacity-40 hover:opacity-70"
                  }`}
                  style={{
                    backgroundColor:
                      card.priority === p.value ? p.color + "25" : "transparent",
                    color: p.color,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} className="text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Due Date
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={card.dueDate ?? ""}
                onChange={(e) =>
                  updateCard(openCardColumnId, openCardId, {
                    dueDate: e.target.value || null,
                  })
                }
                className="bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent-orange [color-scheme:dark]"
              />
              {card.dueDate && (
                <button
                  onClick={() =>
                    updateCard(openCardColumnId, openCardId, { dueDate: null })
                  }
                  className="text-xs text-white/30 hover:text-white/60 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlignLeft size={14} className="text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Description
              </span>
            </div>
            <textarea
              value={card.description}
              onChange={(e) =>
                updateCard(openCardColumnId, openCardId, {
                  description: e.target.value,
                })
              }
              placeholder="Add a description..."
              rows={4}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-accent-orange resize-none"
            />
          </div>

          {/* Checklist */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare size={14} className="text-white/40" />
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Checklist
              </span>
              {checkTotal > 0 && (
                <span className="text-[10px] text-white/30 ml-auto">
                  {checkDone}/{checkTotal} ({checkPercent}%)
                </span>
              )}
            </div>

            {/* Progress bar */}
            {checkTotal > 0 && (
              <div className="w-full h-1.5 bg-surface rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${checkPercent}%`,
                    backgroundColor:
                      checkDone === checkTotal ? "#2ecc71" : "#e67e22",
                  }}
                />
              </div>
            )}

            {/* Items */}
            <div className="flex flex-col gap-1">
              {card.checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 group px-1 py-1 rounded hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      toggleChecklistItem(
                        openCardColumnId,
                        openCardId,
                        item.id,
                      )
                    }
                    className="accent-accent-orange w-3.5 h-3.5 cursor-pointer"
                  />
                  <input
                    className={`flex-1 text-sm bg-transparent outline-none ${
                      item.done
                        ? "line-through text-white/30"
                        : "text-white/70"
                    }`}
                    value={item.text}
                    onChange={(e) =>
                      updateChecklistItem(
                        openCardColumnId,
                        openCardId,
                        item.id,
                        e.target.value,
                      )
                    }
                  />
                  <button
                    onClick={() =>
                      removeChecklistItem(
                        openCardColumnId,
                        openCardId,
                        item.id,
                      )
                    }
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add checklist item */}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCheckItem()}
                placeholder="Add item..."
                className="flex-1 bg-surface border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-accent-orange"
              />
              <button
                onClick={handleAddCheckItem}
                className="p-1.5 rounded-lg border border-surface-border hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
