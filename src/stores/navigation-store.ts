import { create } from "zustand";

export type ViewType = "home" | "terminal" | "kanban" | "settings" | "swarm";

interface NavigationStore {
  activeView: ViewType;
  previousView: ViewType;
  setActiveView: (view: ViewType) => void;
  toggleSettings: () => void;
  goHome: () => void;
}

export const useNavigationStore = create<NavigationStore>((set, get) => ({
  activeView: "home",
  previousView: "home",
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
  goHome: () => set({ activeView: "home", previousView: "home" }),
}));
