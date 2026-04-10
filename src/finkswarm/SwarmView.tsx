import { useEffect } from "react";
import { useSwarmStore } from "./store";
import { SwarmWizard } from "./SwarmWizard";
import { SwarmDashboard } from "./SwarmDashboard";

export function SwarmView() {
  const swarms = useSwarmStore((s) => s.swarms);
  const activeSwarmId = useSwarmStore((s) => s.activeSwarmId);
  const draft = useSwarmStore((s) => s.draft);
  const beginDraft = useSwarmStore((s) => s.beginDraft);
  const setActiveSwarm = useSwarmStore((s) => s.setActiveSwarm);

  const activeSwarm =
    swarms.find((s) => s.id === activeSwarmId) ?? swarms[0] ?? null;

  // Keep activeSwarmId in sync if it dangled.
  useEffect(() => {
    if (activeSwarmId && !swarms.find((s) => s.id === activeSwarmId)) {
      setActiveSwarm(swarms[0]?.id ?? null);
    }
  }, [activeSwarmId, swarms, setActiveSwarm]);

  // No swarms yet and no draft — jump straight into the wizard.
  useEffect(() => {
    if (swarms.length === 0 && !draft) {
      beginDraft();
    }
  }, [swarms.length, draft, beginDraft]);

  // Wizard takes precedence whenever a draft exists.
  if (draft) {
    return <SwarmWizard />;
  }

  if (!activeSwarm) return null;
  return <SwarmDashboard swarm={activeSwarm} />;
}
