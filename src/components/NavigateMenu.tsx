import { useState, useEffect, useRef } from "react";
import { LayoutGrid, SquareTerminal, Kanban, Settings, Home } from "lucide-react";
import { useNavigationStore, type ViewType } from "../stores/navigation-store";

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "terminal", label: "Terminal", icon: SquareTerminal, shortcut: "Ctrl+1" },
  { id: "kanban", label: "Kanban Board", icon: Kanban, shortcut: "Ctrl+2" },
  { id: "settings", label: "Settings", icon: Settings, shortcut: "Ctrl+," },
];

export function NavigateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeView = useNavigationStore((s) => s.activeView);
  const setActiveView = useNavigationStore((s) => s.setActiveView);
  const toggleSettings = useNavigationStore((s) => s.toggleSettings);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (item: NavItem) => {
    if (item.id === "settings") {
      toggleSettings();
    } else {
      setActiveView(item.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-full px-3 hover:bg-surface-light text-white/40 hover:text-white/80 transition-colors ${
          isOpen ? "bg-surface-light text-white/80" : ""
        }`}
      >
        <LayoutGrid size={15} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-surface-border rounded-lg shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-2.5 border-b border-surface-border">
            <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest">
              Navigate
            </span>
          </div>
          <div className="py-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeView;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors ${
                    isActive
                      ? "bg-surface-light"
                      : "hover:bg-surface-light/50"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
                      isActive
                        ? "bg-accent-orange/10 border-accent-orange/40 text-accent-orange"
                        : "bg-surface-light border-surface-border text-white/50"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  {isActive && (
                    <div className="w-0.5 h-6 rounded-full bg-accent-orange -ml-1.5" />
                  )}
                  <span
                    className={`flex-1 text-left text-sm font-medium ${
                      isActive ? "text-white" : "text-white/70"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.shortcut && (
                    <span className="text-xs text-white/20 bg-surface-light px-2 py-0.5 rounded">
                      {item.shortcut}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
