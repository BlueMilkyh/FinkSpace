// ─── FinkSwarm Orchestration ────────────────────────────────────────────
//
// Turns a Swarm config into live cooperating CLI processes.
//
// Design:
//   • Each SwarmAgent is spawned as a standalone PTY via the existing
//     spawn_agent Tauri command (same primitive FinkSpace uses).
//   • Coordination happens through a filesystem mailbox at
//     `<workDir>/.finkswarm/` so every CLI that has a Write tool
//     (claude, codex, gemini, opencode, cursor) can participate —
//     we never try to scrape protocol markers out of a TUI's stdout.
//   • Agents SEND by writing JSON files into `.finkswarm/outbox/`.
//     The manager polls that directory, parses each file, logs the
//     message to the swarm console, and DELIVERS it to peer agents
//     by pasting `[Peer <role>]: …` into their PTY as a new turn.
//   • Each agent gets a full mission brief written to
//     `.finkswarm/brief-<agentId>.txt` at launch time and is
//     bootstrapped with a short prompt asking it to read that file.
//     This sidesteps the "rich TUI input can't handle multi-line
//     paste" problem that killed the earlier stdin-based brief.
//
// The output listener still runs — not for protocol scanning (which
// lives in the mailbox poller now) but to detect and auto-accept
// first-boot consent dialogs (claude trust folder, bypass permissions,
// gemini YOLO, …).

import {
  spawnAgent,
  writeToAgent,
  killAgent,
  onAgentOutput,
  onAgentExited,
  fsMakeDirAll,
  fsWriteText,
  fsReadText,
  fsDrainDir,
} from "../lib/tauri-bridge";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useSwarmStore } from "./store";
import type { Swarm, SwarmAgent } from "./types";
import { CLI_META, ROLE_META } from "./types";
import { getHome } from "../lib/platform";

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

// Poll the filesystem mailbox this often. Low enough that peer traffic
// feels interactive; high enough that idle swarms aren't thrashing disk.
const MAILBOX_POLL_MS = 400;

// ─── Path helpers ──────────────────────────────────────────────────────

function norm(p: string): string {
  // Rust's std::path accepts forward slashes on Windows, so normalising
  // to "/" keeps the path strings we hand to the frontend identical
  // across platforms and easy to paste into shell commands.
  return p.replace(/\\/g, "/").replace(/\/+$/, "");
}

function mailboxRoot(workDir: string): string {
  return `${norm(workDir)}/.finkswarm`;
}
function outboxDir(workDir: string): string {
  return `${mailboxRoot(workDir)}/outbox`;
}
function inboxDir(workDir: string, agentId: string): string {
  return `${mailboxRoot(workDir)}/inbox/${agentId}`;
}
function briefFile(workDir: string, agentId: string): string {
  return `${mailboxRoot(workDir)}/brief-${agentId}.txt`;
}

// ─── Per-agent runtime (PTY side) ──────────────────────────────────────

let outputUnlisten: UnlistenFn | null = null;
let exitedUnlisten: UnlistenFn | null = null;

interface AgentRuntime {
  swarmId: string;
  // Rolling tail of recent raw output (ANSI stripped) used to detect
  // stacked first-boot consent dialogs. Capped to a few KB.
  dialogTail: string;
  // Which dialog signatures we've already dismissed on this agent,
  // so the scanner doesn't spam Enter/arrow keys into the prompt.
  handledDialogs: Set<string>;
  // Debounce timer for the response.
  dialogTimer: ReturnType<typeof setTimeout> | null;
}
const agentRuntime = new Map<string, AgentRuntime>();

// UTF-8 decoders per agent so multi-byte sequences split across chunks
// don't corrupt dialog detection.
const agentDecoders = new Map<string, TextDecoder>();

function decoderFor(agentId: string): TextDecoder {
  let d = agentDecoders.get(agentId);
  if (!d) {
    d = new TextDecoder("utf-8", { fatal: false });
    agentDecoders.set(agentId, d);
  }
  return d;
}

// ─── Per-swarm runtime (mailbox side) ──────────────────────────────────

interface SwarmRuntime {
  workDir: string;
  pollTimer: ReturnType<typeof setInterval> | null;
}
const swarmRuntime = new Map<string, SwarmRuntime>();

function stopSwarmPoller(swarmId: string) {
  const rt = swarmRuntime.get(swarmId);
  if (rt?.pollTimer) clearInterval(rt.pollTimer);
  swarmRuntime.delete(swarmId);
}

// ─── ANSI stripping for dialog detection ──────────────────────────────

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\][^\u0007]*\u0007/g, "");
}

interface DialogSig {
  id: string;
  match: RegExp;
  // Bytes to send to accept the positive option.
  keys: string;
}

const DIALOGS: DialogSig[] = [
  // Claude: "Do you trust the files in this folder?" — default is Yes.
  {
    id: "claude-trust-folder",
    match: /trust (the files in )?this folder|Quick safety check/i,
    keys: "\r",
  },
  // Claude: Bypass Permissions warning (only when launched with
  // --dangerously-skip-permissions). Default is "No, exit", so we
  // arrow down to "Yes, I accept" before confirming.
  {
    id: "claude-bypass-permissions",
    match: /Bypass Permissions mode/i,
    keys: "\x1b[B\r",
  },
  // Gemini YOLO mode opt-in.
  {
    id: "gemini-yolo",
    match: /YOLO mode|Enable YOLO/i,
    keys: "\r",
  },
];

function scanForDialogs(agentId: string) {
  const rt = agentRuntime.get(agentId);
  if (!rt) return;
  const haystack = rt.dialogTail;
  for (const d of DIALOGS) {
    if (rt.handledDialogs.has(d.id)) continue;
    if (!d.match.test(haystack)) continue;
    if (rt.dialogTimer) clearTimeout(rt.dialogTimer);
    const sigId = d.id;
    const keys = d.keys;
    rt.dialogTimer = setTimeout(() => {
      const live = agentRuntime.get(agentId);
      if (!live) return;
      if (live.handledDialogs.has(sigId)) return;
      live.handledDialogs.add(sigId);
      writeToAgent(agentId, keys).catch(() => {});
      live.dialogTail = "";
      live.dialogTimer = null;
    }, 250);
    return;
  }
}

// ─── Output listener (dialog detection only) ──────────────────────────

async function ensureListeners() {
  if (outputUnlisten && exitedUnlisten) return;

  outputUnlisten = await onAgentOutput((event) => {
    const runtime = agentRuntime.get(event.id);
    if (!runtime) return;

    // base64 → bytes → UTF-8 text
    let decoded: string;
    try {
      const bytes = Uint8Array.from(atob(event.data), (c) => c.charCodeAt(0));
      decoded = decoderFor(event.id).decode(bytes, { stream: true });
    } catch {
      return;
    }

    runtime.dialogTail = (runtime.dialogTail + stripAnsi(decoded)).slice(
      -4096,
    );
    if (runtime.handledDialogs.size < DIALOGS.length) {
      scanForDialogs(event.id);
    }
  });

  exitedUnlisten = await onAgentExited((event) => {
    const runtime = agentRuntime.get(event.id);
    if (!runtime) return;
    if (runtime.dialogTimer) clearTimeout(runtime.dialogTimer);
    useSwarmStore
      .getState()
      .setAgentStatus(runtime.swarmId, event.id, "exited");
    agentRuntime.delete(event.id);
    agentDecoders.delete(event.id);
  });
}

// ─── Mission brief composer ────────────────────────────────────────────

function roleLabel(a: SwarmAgent): string {
  return a.role === "custom" && a.customRole
    ? a.customRole
    : ROLE_META[a.role].label.toLowerCase();
}

function composeMissionBrief(swarm: Swarm, agent: SwarmAgent): string {
  const peers = swarm.config.agents
    .filter((a) => a.id !== agent.id)
    .map((a) => `  - ${a.id}  [${roleLabel(a)}]  (${a.cli})`)
    .join("\n");

  const knowledge =
    swarm.config.knowledge.length === 0
      ? "  (none)"
      : swarm.config.knowledge.map((k) => `  - ${k.path}`).join("\n");

  const myLabel = roleLabel(agent);
  const roleDesc =
    agent.role === "custom"
      ? (agent.customRole ?? "custom role")
      : ROLE_META[agent.role].description;

  return [
    "=======================================================",
    "  FINKSWARM MISSION BRIEF",
    "=======================================================",
    "",
    "[SWARM MISSION]",
    swarm.config.prompt,
    "",
    `[YOUR ROLE] ${myLabel}`,
    roleDesc,
    "",
    `[SWARM ID]        ${swarm.id}`,
    `[YOUR AGENT ID]   ${agent.id}`,
    `[WORKING DIR]     ${swarm.config.workDir}`,
    "",
    "[PEERS]",
    peers || "  (none)",
    "",
    "[KNOWLEDGE FILES]",
    knowledge,
    "(Absolute paths — read them with your file tools as needed.)",
    "",
    "=======================================================",
    "  COMMUNICATION PROTOCOL (filesystem mailbox)",
    "=======================================================",
    "",
    "You coordinate with peers through a shared directory,",
    "  .finkswarm/",
    "inside your working directory. Every agent reads and writes",
    "this directory using its normal file tools.",
    "",
    "─── HOW TO SEND A MESSAGE ───",
    "",
    "Use your Write (or equivalent) tool to create a JSON file:",
    "",
    "  path:",
    `    .finkswarm/outbox/<unix_ms>-${agent.id}.json`,
    "",
    "  contents (exactly this shape):",
    "    {",
    `      "from": "${agent.id}",`,
    '      "to":   "<peerAgentId>"    // or "all"',
    '      "text": "<your message>"',
    "    }",
    "",
    "Pick a filename that starts with the current millisecond",
    "timestamp so messages stay in order. FinkSpace drains this",
    "directory automatically — never delete files from it yourself.",
    "",
    "─── HOW TO RECEIVE MESSAGES ───",
    "",
    "Peer messages are delivered to YOU as new prompts prefixed",
    '  "[Peer <role>]: …"',
    "Treat each one as the next turn of conversation and respond",
    "according to your role. To reply to a peer, write another",
    "JSON file into .finkswarm/outbox/ as described above.",
    "",
    "─── HOW TO MARK YOURSELF IDLE ───",
    "",
    "When you have nothing to do until another peer responds,",
    "write an idle marker:",
    "",
    "  path:",
    `    .finkswarm/outbox/<unix_ms>-${agent.id}-idle.json`,
    "  contents:",
    `    {"from":"${agent.id}","idle":true}`,
    "",
    "=======================================================",
    "  RULES",
    "=======================================================",
    "",
    " 1. ALWAYS use your Write tool for outgoing messages. DO NOT",
    "    print JSON to the terminal — nothing reads it there.",
    " 2. NEVER delete files in .finkswarm/outbox — FinkSpace does.",
    " 3. Only the COORDINATOR assigns tasks and declares the",
    "    mission done. Everyone else reports progress upward.",
    " 4. If a peer message is unclear, ask the Coordinator via a",
    "    new outbox message addressed to them.",
    " 5. Keep individual messages compact — one decision, one task,",
    "    or one status update per file.",
    "",
    "=======================================================",
    "  BEGIN",
    "=======================================================",
    "",
    agent.role === "coordinator"
      ? "You are the Coordinator. Plan the mission, break it into tasks, and distribute them to the peers listed above by writing outbox messages. Wait for their replies and orchestrate the swarm until the mission is complete."
      : "Wait for the Coordinator's first instruction (it will arrive as a [Peer coordinator] prompt). Until then, you may read the knowledge files and prepare.",
    "",
  ].join("\n");
}

function bootstrapPrompt(agent: SwarmAgent): string {
  // Kept short so it fits cleanly in a TUI rich-input box — the real
  // brief lives in the file we ask the agent to read.
  return (
    `Read the file .finkswarm/brief-${agent.id}.txt in this directory ` +
    `and follow the FinkSwarm coordination protocol described there. ` +
    `Your agent id is "${agent.id}". Start by reading the brief now, ` +
    `then proceed according to your role.`
  );
}

// ─── Claude consent pre-acceptance ─────────────────────────────────────
//
// Claude Code shows two modal dialogs on first contact:
//   1. "Do you trust the files in this folder?" — per-project
//   2. "Bypass Permissions mode" warning — global, when launched with
//      --dangerously-skip-permissions
//
// Both are remembered in `~/.claude.json`. When present, Claude skips the
// dialogs entirely. We patch that file before spawning so every agent in
// the swarm boots straight into its TUI with no prompts to dismiss.
//
// We merge non-destructively: read the existing config, set the few keys
// we care about, write it back. If anything in that pipeline fails we
// silently fall back to the runtime dialog detector.

async function preAcceptClaudeConsent(workDir: string): Promise<void> {
  const home = getHome();
  if (!home) return;
  const configPath = `${norm(home)}/.claude.json`;

  let config: Record<string, unknown> = {};
  try {
    const raw = await fsReadText(configPath);
    if (raw.trim().length > 0) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        config = parsed as Record<string, unknown>;
      }
    }
  } catch {
    // Corrupt JSON — don't clobber it; let the runtime detector handle it.
    return;
  }

  // Top-level flag: once true, the Bypass Permissions warning is skipped.
  config.bypassPermissionsModeAccepted = true;
  config.hasCompletedOnboarding = config.hasCompletedOnboarding ?? true;

  // Per-project trust flag. Claude keys this dictionary by the absolute
  // path it sees when it launches, so we set both the normalised ("/") and
  // the native ("\\" on Windows) variants to be safe.
  const projects =
    (config.projects as Record<string, Record<string, unknown>> | undefined) ??
    {};
  const variants = new Set<string>();
  variants.add(workDir);
  variants.add(norm(workDir));
  variants.add(workDir.replace(/\//g, "\\"));
  for (const key of variants) {
    const existing = (projects[key] as Record<string, unknown> | undefined) ?? {};
    existing.hasTrustDialogAccepted = true;
    existing.hasCompletedProjectOnboarding =
      existing.hasCompletedProjectOnboarding ?? true;
    projects[key] = existing;
  }
  config.projects = projects;

  try {
    await fsWriteText(configPath, JSON.stringify(config, null, 2));
  } catch {
    // Best-effort — the runtime detector is still armed as a fallback.
  }
}

// ─── Mailbox polling + delivery ────────────────────────────────────────

interface MailboxEnvelope {
  from?: string;
  to?: string;
  text?: string;
  idle?: boolean;
}

async function pollMailbox(swarmId: string): Promise<void> {
  const rt = swarmRuntime.get(swarmId);
  if (!rt) return;

  const state = useSwarmStore.getState();
  const swarm = state.swarms.find((s) => s.id === swarmId);
  if (!swarm) {
    stopSwarmPoller(swarmId);
    return;
  }

  let files: { name: string; content: string }[];
  try {
    files = await fsDrainDir(outboxDir(rt.workDir));
  } catch {
    return;
  }
  if (files.length === 0) return;

  for (const f of files) {
    let env: MailboxEnvelope;
    try {
      env = JSON.parse(f.content);
    } catch {
      state.appendMessage({
        swarmId,
        fromAgentId: "system",
        text: `Unparseable mailbox file: ${f.name}`,
      });
      continue;
    }

    const from = String(env.from ?? "").trim();
    const sender = swarm.config.agents.find((a) => a.id === from);
    if (!sender) {
      state.appendMessage({
        swarmId,
        fromAgentId: "system",
        text: `Mailbox file ${f.name} has unknown "from": ${from || "(missing)"}`,
      });
      continue;
    }

    // Idle marker
    if (env.idle === true) {
      state.setAgentStatus(swarmId, sender.id, "idle");
      continue;
    }

    const text = String(env.text ?? "").trim();
    if (!text) continue;

    const to = env.to ? String(env.to).trim() : "all";

    state.appendMessage({
      swarmId,
      fromAgentId: sender.id,
      toAgentId: to === "all" ? undefined : to,
      text,
    });
    state.setAgentStatus(swarmId, sender.id, "running");

    // Deliver to target PTY(s). We paste the message as a new turn
    // prefixed with the sender's role so the receiving agent knows
    // who it came from.
    const senderLabel = roleLabel(sender);
    const body = `[Peer ${senderLabel}]: ${text}\n(Respond via the FinkSwarm protocol — write to .finkswarm/outbox/.)`;
    const targets =
      to === "all"
        ? swarm.config.agents.filter((a) => a.id !== sender.id).map((a) => a.id)
        : [to];

    for (const tid of targets) {
      if (!agentRuntime.has(tid)) continue;
      writeToAgent(tid, body + "\r").catch(() => {});
    }
  }
}

// ─── Public API ────────────────────────────────────────────────────────

export async function startSwarm(swarm: Swarm): Promise<void> {
  await ensureListeners();

  // 1. Prepare the mailbox tree and per-agent briefs on disk.
  try {
    await fsMakeDirAll(outboxDir(swarm.config.workDir));
    for (const agent of swarm.config.agents) {
      await fsMakeDirAll(inboxDir(swarm.config.workDir, agent.id));
      await fsWriteText(
        briefFile(swarm.config.workDir, agent.id),
        composeMissionBrief(swarm, agent),
      );
    }
    // A small README so a human poking at the directory understands it.
    await fsWriteText(
      `${mailboxRoot(swarm.config.workDir)}/README.txt`,
      [
        "FinkSwarm coordination mailbox.",
        "",
        "  outbox/         Agents write JSON messages here.",
        "  inbox/<id>/     Reserved per-agent inbox (currently unused;",
        "                  messages are delivered via PTY for TUI CLIs).",
        "  brief-<id>.txt  Mission brief for each agent.",
        "",
        "FinkSpace drains outbox/ every few hundred ms. Do not add",
        "files by hand while the swarm is running.",
        "",
      ].join("\n"),
    );
  } catch (e) {
    useSwarmStore.getState().appendMessage({
      swarmId: swarm.id,
      fromAgentId: "system",
      text: `Failed to prepare mailbox: ${String(e)}`,
    });
    useSwarmStore.getState().setSwarmStatus(swarm.id, "error");
    return;
  }

  // 2. If any agent is a Claude agent, patch ~/.claude.json so the
  //    first-boot trust + bypass-permissions dialogs are pre-accepted.
  //    Runs exactly once per swarm launch, not per agent.
  if (swarm.config.agents.some((a) => a.cli === "claude")) {
    await preAcceptClaudeConsent(swarm.config.workDir);
  }

  // 3. Spawn every agent's PTY.
  for (const agent of swarm.config.agents) {
    const meta = CLI_META[agent.cli];
    const args = agent.autoApprove ? [...meta.autoApproveArgs] : [];
    agentRuntime.set(agent.id, {
      swarmId: swarm.id,
      dialogTail: "",
      handledDialogs: new Set(),
      dialogTimer: null,
    });
    try {
      await spawnAgent(
        agent.id,
        meta.command,
        args,
        swarm.config.workDir,
        DEFAULT_COLS,
        DEFAULT_ROWS,
      );
      useSwarmStore.getState().setAgentStatus(swarm.id, agent.id, "running");
    } catch (e) {
      useSwarmStore.getState().setAgentStatus(swarm.id, agent.id, "error");
      useSwarmStore.getState().appendMessage({
        swarmId: swarm.id,
        fromAgentId: "system",
        text: `Failed to spawn ${roleLabel(agent)} (${agent.cli}): ${String(e)}`,
      });
      agentRuntime.delete(agent.id);
      continue;
    }
  }

  // 4. Start the mailbox poller.
  const timer = setInterval(() => {
    pollMailbox(swarm.id).catch(() => {});
  }, MAILBOX_POLL_MS);
  swarmRuntime.set(swarm.id, {
    workDir: swarm.config.workDir,
    pollTimer: timer,
  });

  // 5. Once consent dialogs are resolved, inject a short bootstrap
  //    prompt that tells each agent to read its brief file. The real
  //    instructions live in the file, so the PTY-paste payload stays
  //    small enough that TUI rich-input widgets don't chop it.
  setTimeout(() => {
    for (const agent of swarm.config.agents) {
      if (!agentRuntime.has(agent.id)) continue;
      writeToAgent(agent.id, bootstrapPrompt(agent) + "\r").catch(() => {});
    }
  }, 4000);
}

export async function stopSwarm(swarmId: string): Promise<void> {
  stopSwarmPoller(swarmId);
  const swarm = useSwarmStore.getState().swarms.find((s) => s.id === swarmId);
  if (!swarm) return;
  for (const agent of swarm.config.agents) {
    try {
      await killAgent(agent.id);
    } catch {
      // ignore — process may already be dead
    }
    const rt = agentRuntime.get(agent.id);
    if (rt?.dialogTimer) clearTimeout(rt.dialogTimer);
    agentRuntime.delete(agent.id);
    agentDecoders.delete(agent.id);
    useSwarmStore.getState().setAgentStatus(swarmId, agent.id, "exited");
  }
  useSwarmStore.getState().setSwarmStatus(swarmId, "completed");
}

/**
 * Broadcast a user-typed message into the swarm. Logged to the console,
 * then delivered to every agent as a "[USER]" peer turn via PTY.
 */
export async function broadcastUserMessage(
  swarmId: string,
  text: string,
): Promise<void> {
  const swarm = useSwarmStore.getState().swarms.find((s) => s.id === swarmId);
  if (!swarm) return;

  useSwarmStore.getState().appendMessage({
    swarmId,
    fromAgentId: "user",
    text,
  });

  const body = `[USER]: ${text}\n(Respond via the FinkSwarm protocol — write to .finkswarm/outbox/.)`;
  for (const agent of swarm.config.agents) {
    if (!agentRuntime.has(agent.id)) continue;
    writeToAgent(agent.id, body + "\r").catch(() => {});
  }
}
