import { useState } from "react";
import { Eye, EyeOff, Key, Info } from "lucide-react";
import { useSettingsStore } from "../../stores/settings-store";

export function APIKeysSection() {
  const { settings, updateSetting } = useSettingsStore();
  const [showKey, setShowKey] = useState(false);

  const maskedKey = settings.anthropicApiKey
    ? settings.anthropicApiKey.slice(0, 10) + "..." + settings.anthropicApiKey.slice(-4)
    : "";

  return (
    <div>
      <h2 className="text-lg font-semibold text-primary mb-1">API Keys</h2>
      <p className="text-sm text-secondary mb-6">Create and manage API keys</p>

      <div className="flex flex-col gap-4">
        {/* Anthropic API Key */}
        <div className="rounded-lg border border-surface-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-light/50">
            <Key size={16} className="text-secondary" />
            <span className="text-sm font-semibold text-primary">Anthropic</span>
          </div>
          <div className="px-4 py-4">
            <p className="text-sm text-white/80 mb-3">API key for direct Claude API access (optional if using CLI)</p>
            <div className="relative max-w-md">
              <input
                type={showKey ? "text" : "password"}
                value={settings.anthropicApiKey}
                onChange={(e) => updateSetting("anthropicApiKey", e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 pr-10 text-sm text-primary placeholder-white/20 focus:outline-none focus:border-accent-orange font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-secondary hover:text-primary transition-colors"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {settings.anthropicApiKey && !showKey && (
              <p className="text-xs text-secondary mt-2 font-mono">{maskedKey}</p>
            )}
          </div>
        </div>

        {/* Future keys */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-surface-border/50">
          <Info size={14} className="text-secondary shrink-0" />
          <span className="text-xs text-secondary">
            Support for OpenAI, Google, and other provider keys will be added in future updates.
          </span>
        </div>
      </div>
    </div>
  );
}
