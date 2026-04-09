import { create } from "zustand";

export type ViewType = "terminal" | "kanban" | "settings";

interface NavigationStore {
  activeView: ViewType;
  previousView: ViewType;
  setActiveView: (view: ViewType) => void;
  toggleSettings: () => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  activeView: "terminal",
  previousView: "terminal",
  setActiveView: (view) =>
    set((s) => ({
      activeView: view,
      previousView: s.activeView !== "settings" ? s.activeView : s.previousView,
    })),
  toggleSettings: () => {
    const { activeView, previousView } = get();
    if (activeView === "settings") {
      set({ activeView: previousView });
    } else {
      set({ previousView: activeView, activeView: "settings" });
    }
  },
}));
