import { useSettingsStore } from "../../stores/settings-store";
import { TERMINAL_TYPES, TERMINAL_LAYOUTS } from "../../types";

function LayoutPreview({ rows, isAuto }: { rows: number[]; isAuto?: boolean }) {
  if (isAuto) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-[9px] text-secondary font-medium">AUTO</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col gap-[2px]">
      {rows.map((cols, rowIdx) => (
        <div key={rowIdx} className="flex-1 flex gap-[2px]">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className="flex-1 rounded-[2px] bg-current opacity-30"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function TerminalSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div>
      <h2 className="text-lg font-semibold text-primary mb-1">Terminal</h2>
      <p className="text-sm text-secondary mb-6">
        Configure which shell is used for new terminal sessions.
      </p>

      {/* Default Shell */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-primary mb-1">Default Shell</h3>
        <p className="text-xs text-secondary mb-4">
          New terminals will use your selected shell. Override per-terminal from the right-click menu.
        </p>

        <div className="rounded-lg border border-surface-border overflow-hidden">
          {TERMINAL_TYPES.map((t, index) => {
            const isSelected = settings.defaultTerminalType === t.id;
            const isLast = index === TERMINAL_TYPES.length - 1;

            return (
              <div
                key={t.id}
                onClick={() => updateSetting("defaultTerminalType", t.id)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-accent-orange/10 border-accent-orange"
                    : "hover:bg-surface-light/30"
                } ${!isLast ? "border-b border-surface-border/30" : ""}`}
              >
                {/* Radio button */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected
                      ? "border-accent-orange"
                      : "border-white/30"
                  }`}
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-orange" />
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">{t.name}</span>
                    {t.id !== "system-default" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-lighter text-secondary font-mono">
                        {t.id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-secondary truncate">
                    {t.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Layout */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-primary mb-1">Pane Layout</h3>
        <p className="text-xs text-secondary mb-4">
          Choose how terminal panes are arranged in the workspace. Auto adjusts based on pane count.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {TERMINAL_LAYOUTS.map((layout) => {
            const isSelected = settings.terminalLayout === layout.id;

            return (
              <button
                key={layout.id}
                onClick={() => updateSetting("terminalLayout", layout.id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-accent-orange bg-accent-orange/10"
                    : "border-surface-border hover:border-white/30 hover:bg-surface-light/30"
                }`}
              >
                <div
                  className={`w-12 h-9 p-[3px] rounded ${
                    isSelected ? "text-accent-orange" : "text-white/60"
                  }`}
                >
                  <LayoutPreview
                    rows={layout.rows}
                    isAuto={layout.id === "auto"}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isSelected ? "text-accent-orange" : "text-secondary"
                  }`}
                >
                  {layout.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
