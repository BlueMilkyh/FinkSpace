import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AgentOutputEvent, AgentExitedEvent } from "../types";

export async function spawnAgent(
  id: string,
  command: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("spawn_agent", { id, command, args, cwd, cols, rows });
}

export async function writeToAgent(id: string, data: string): Promise<void> {
  await invoke("write_to_agent", { id, data });
}

export async function resizeAgent(
  id: string,
  cols: number,
  rows: number,
): Promise<void> {
  await invoke("resize_agent", { id, cols, rows });
}

export async function killAgent(id: string): Promise<void> {
  await invoke("kill_agent", { id });
}

export async function onAgentOutput(
  callback: (event: AgentOutputEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentOutputEvent>("agent-output", (e) => callback(e.payload));
}

export async function onAgentExited(
  callback: (event: AgentExitedEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentExitedEvent>("agent-exited", (e) => callback(e.payload));
}
