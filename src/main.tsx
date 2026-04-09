import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPlatform, getHome } from "./lib/platform";
import { refreshTerminalTypes } from "./types";
import { useSettingsStore } from "./stores/settings-store";

async function bootstrap() {
  await initPlatform();
  refreshTerminalTypes();

  // Set default workDir if not yet configured
  const { settings, updateSetting } = useSettingsStore.getState();
  if (!settings.defaultWorkDir) {
    updateSetting("defaultWorkDir", getHome());
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
