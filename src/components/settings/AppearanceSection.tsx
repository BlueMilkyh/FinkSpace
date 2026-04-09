import { useSettingsStore } from "../../stores/settings-store";
import { ColorPicker } from "../ColorPicker";

const THEMES = [
  {
    id: "dark" as const,
    label: "Dark",
    preview: { bg: "#1a1b2e", surface: "#242640", border: "#3a3c5c" },
  },
  {
    id: "black" as const,
    label: "Black",
    preview: { bg: "#000000", surface: "#111111", border: "#2a2a2a" },
  },
  {
    id: "light" as const,
    label: "Light",
    preview: { bg: "#f5f5f5", surface: "#e8e8e8", border: "#cccccc" },
  },
];

export function AppearanceSection() {
  const { settings, updateSetting } = useSettingsStore();

  return (
    <div>
      <h2 className="text-lg font-semibold text-primary mb-1">Appearance</h2>
      <p className="text-sm text-secondary mb-6">Theme and display settings</p>

      <div className="flex flex-col gap-6">
        {/* Theme */}
        <div>
          <label className="text-sm font-medium text-secondary mb-3 block">Theme</label>
          <div className="flex gap-3">
            {THEMES.map((t) => {
              const isActive = settings.theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => updateSetting("theme", t.id)}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    isActive
                      ? "border-accent-orange"
                      : "border-surface-border hover:border-surface-lighter"
                  }`}
                >
                  <div
                    className="w-16 h-10 rounded border flex items-end p-1 gap-0.5"
                    style={{
                      backgroundColor: t.preview.bg,
                      borderColor: t.preview.border,
                    }}
                  >
                    <div
                      className="flex-1 h-3 rounded-sm"
                      style={{ backgroundColor: t.preview.surface }}
                    />
                    <div
                      className="flex-1 h-4 rounded-sm"
                      style={{ backgroundColor: t.preview.surface }}
                    />
                  </div>
                  <span className="text-primary">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-sm font-medium text-secondary mb-3 block">Accent Color</label>
          <ColorPicker
            selectedColor={settings.accentColor}
            onSelect={(color) => updateSetting("accentColor", color)}
          />
        </div>

        {/* UI Scale */}
        <div>
          <label className="text-sm font-medium text-secondary mb-1 block">
            UI Scale: {settings.uiScale}%
          </label>
          <p className="text-xs text-secondary mb-2">Adjust the overall interface size</p>
          <input
            type="range"
            min={80}
            max={120}
            step={5}
            value={settings.uiScale}
            onChange={(e) => updateSetting("uiScale", Number(e.target.value))}
            className="w-64 accent-accent-orange"
          />
          <div className="flex justify-between w-64 text-xs text-secondary mt-1">
            <span>80%</span>
            <span>100%</span>
            <span>120%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
