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
  fsPathExists,
  fsDrainDir,
} from "../lib/tauri-bridge";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { useSwarmStore } from "./store";
import type { Swarm, SwarmAgent } from "./types";
import { CLI_META, ROLE_META, getAgentLabel } from "./types";
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
  // Agent object snapshot used when composing the bootstrap prompt after
  // consent dialogs have been dismissed.
  agent: SwarmAgent;
  // Rolling tail of recent raw output (ANSI stripped) used to detect
  // stacked first-boot consent dialogs. Capped to a few KB.
  dialogTail: string;
  // Which dialog signatures we've already dismissed on this agent,
  // so the scanner doesn't spam Enter/arrow keys into the prompt.
  handledDialogs: Set<string>;
  // Debounce timer for the response.
  dialogTimer: ReturnType<typeof setTimeout> | null;
  // True once the bootstrap prompt has been pasted. Set either by the
  // dialog scanner (right after the last detected dialog clears) or by
  // the safety fallback timer. Either way, we only send bootstrap once.
  bootstrapSent: boolean;
  // Safety fallback timer — fires after ~8s to send bootstrap even if
  // we never detected a consent dialog (non-Claude CLIs, or Claude with
  // pre-accepted consent so nothing to scan).
  bootstrapTimer: ReturnType<typeof setTimeout> | null;
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
      // After dismissing a dialog, schedule bootstrap shortly after —
      // gives the CLI time to transition to its main prompt before we
      // paste the bootstrap text. We keep this idempotent (bootstrapSent
      // flag), so the safety timer and dialog-driven path can't double-up.
      setTimeout(() => sendBootstrap(agentId), 700);
    }, 250);
    return;
  }
}

/**
 * Idempotently deliver the bootstrap prompt to an agent. Called both from
 * the dialog scanner (right after a consent dialog clears) and from a
 * safety fallback timer for CLIs where no dialog is ever detected.
 */
function sendBootstrap(agentId: string): void {
  const rt = agentRuntime.get(agentId);
  if (!rt) return;
  if (rt.bootstrapSent) return;
  rt.bootstrapSent = true;
  if (rt.bootstrapTimer) {
    clearTimeout(rt.bootstrapTimer);
    rt.bootstrapTimer = null;
  }
  writeToAgent(agentId, bootstrapPrompt(rt.agent) + "\r").catch(() => {});
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
    if (runtime.bootstrapTimer) clearTimeout(runtime.bootstrapTimer);
    const swarmId = runtime.swarmId;
    useSwarmStore.getState().setAgentStatus(swarmId, event.id, "exited");
    agentRuntime.delete(event.id);
    agentDecoders.delete(event.id);
    // Natural exit (crash, manual kill, parent CLI quit) — still needs to
    // bring the whole swarm down if this was the last live agent.
    maybeMarkSwarmCompleted(swarmId);
  });
}

/**
 * If every agent in the swarm has exited, stop the mailbox poller and
 * flip the swarm status to "completed". Safe to call any time an agent
 * transitions to "exited".
 */
function maybeMarkSwarmCompleted(swarmId: string): void {
  const state = useSwarmStore.getState();
  const swarm = state.swarms.find((s) => s.id === swarmId);
  if (!swarm) return;
  // Only auto-complete from an actively running swarm — don't overwrite
  // "error" or "draft".
  if (swarm.status !== "running") return;
  const allExited = swarm.config.agents.every((a) => a.status === "exited");
  if (!allExited) return;
  stopSwarmPoller(swarmId);
  state.setSwarmStatus(swarmId, "completed");
  state.appendMessage({
    swarmId,
    fromAgentId: "system",
    text: "All agents have exited. Swarm complete.",
  });
}

// ─── Mission brief composer ────────────────────────────────────────────

/**
 * Per-role numbered label (`Builder 1`, `Scout 2`, …). Falls back to the
 * unnumbered role name when only one agent of that role exists. Rendered
 * in the UI, the mission brief, and peer-message prefixes so agents can
 * address each other by number instead of by opaque ID.
 */
function roleLabel(a: SwarmAgent, allAgents: SwarmAgent[]): string {
  return getAgentLabel(a, allAgents);
}

export function composeMissionBrief(swarm: Swarm, agent: SwarmAgent): string {
  const peers = swarm.config.agents
    .filter((a) => a.id !== agent.id)
    .map(
      (a) =>
        `  - ${roleLabel(a, swarm.config.agents)}  (${a.cli})  [id: ${a.id}]`,
    )
    .join("\n");

  const knowledge =
    swarm.config.knowledge.length === 0
      ? "  (none)"
      : swarm.config.knowledge.map((k) => `  - ${k.path}`).join("\n");

  const myLabel = roleLabel(agent, swarm.config.agents);
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
    "─── HOW TO SIGNAL DONE (SHUT YOURSELF DOWN) ───",
    "",
    "When your work on this mission is finished AND the Coordinator",
    "has declared the mission complete, write a DONE marker. This is",
    "your LAST action — FinkSpace will terminate your PTY immediately",
    "after reading it, and the swarm stops once every agent has done",
    "the same.",
    "",
    "  path:",
    `    .finkswarm/outbox/<unix_ms>-${agent.id}-done.json`,
    "  contents:",
    `    {"from":"${agent.id}","done":true}`,
    "",
    "Do NOT send a done marker just because you're waiting on a peer —",
    "use the idle marker for that. Send done ONLY when the mission is",
    "truly over for you. Workers: wait for the Coordinator's completion",
    "broadcast first. Coordinator: send yours last, after every peer has",
    "acknowledged mission complete.",
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
    " 6. When your work is done and the Coordinator has declared the",
    "    mission complete, write a DONE marker to shut yourself down.",
    "    Saying \"signing off\" in chat is NOT enough — without the",
    "    done marker your process keeps running and burns tokens.",
    "",
    "=======================================================",
    "  BEGIN",
    "=======================================================",
    "",
    agent.role === "coordinator"
      ? "You are the Coordinator. Plan the mission, break it into tasks, and distribute them to the peers listed above by writing outbox messages. Wait for their replies and orchestrate the swarm until the mission is complete. When every task is verifiably done, broadcast a clear \"MISSION COMPLETE\" message to all peers and then — as your very last action — write your own done marker to shut yourself down."
      : "Wait for the Coordinator's first instruction (it will arrive as a [Peer coordinator] prompt). Until then, you may read the knowledge files and prepare. When the Coordinator broadcasts mission complete, acknowledge it briefly and then write your done marker as your final action.",
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
  // Terminal signal — the agent has finished its job and wants its PTY
  // killed. Sent as the agent's last action; FinkSpace does the actual
  // process termination and, once every agent has signaled done, marks
  // the whole swarm completed.
  done?: boolean;
}

/**
 * Kill a single agent's PTY, clean up its runtime maps, and mark it as
 * exited in the store. If that was the last live agent in the swarm,
 * stop the mailbox poller and flip the swarm status to "completed".
 */
export async function terminateAgent(
  swarmId: string,
  agent: SwarmAgent,
  reason: string,
): Promise<void> {
  const state = useSwarmStore.getState();
  const swarm = state.swarms.find((s) => s.id === swarmId);
  if (!swarm) return;

  // Already cleaned up — nothing to do.
  if (!agentRuntime.has(agent.id)) {
    state.setAgentStatus(swarmId, agent.id, "exited");
  } else {
    try {
      await killAgent(agent.id);
    } catch {
      // Process may already be dead.
    }
    const rt = agentRuntime.get(agent.id);
    if (rt?.dialogTimer) clearTimeout(rt.dialogTimer);
    if (rt?.bootstrapTimer) clearTimeout(rt.bootstrapTimer);
    agentRuntime.delete(agent.id);
    agentDecoders.delete(agent.id);
    state.setAgentStatus(swarmId, agent.id, "exited");
  }

  state.appendMessage({
    swarmId,
    fromAgentId: "system",
    text: `${getAgentLabel(agent, swarm.config.agents)} ${reason}`,
  });

  maybeMarkSwarmCompleted(swarmId);
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
  // The poller has no business running once a swarm has left the
  // "running" state — draining disk every 400ms for an errored or
  // completed swarm is pure waste. Tear ourselves down instead.
  if (swarm.status !== "running") {
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

    // Done marker — agent is voluntarily exiting. Kill the PTY and,
    // if this was the last live agent, tear the whole swarm down.
    if (env.done === true) {
      // Fire-and-forget: pollMailbox keeps draining other files.
      terminateAgent(swarmId, sender, "signaled done and exited.").catch(
        () => {},
      );
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
    const senderLabel = roleLabel(sender, swarm.config.agents);
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

  // 0. Fresh slate — clear any leftover agent statuses from a previous run
  //    (e.g. relaunching a "completed" swarm still showing "exited" badges).
  for (const agent of swarm.config.agents) {
    useSwarmStore.getState().setAgentStatus(swarm.id, agent.id, "pending");
  }

  // 0a. Validate knowledge-file paths on disk. Users can add files in the
  //     wizard and then move/delete them before launch; a broken path in
  //     the brief just confuses the agent when its Read tool errors out.
  //     We skip missing files and surface the list as a system message so
  //     the user knows which ones were dropped.
  const missingKnowledge: string[] = [];
  const validKnowledge = [] as typeof swarm.config.knowledge;
  for (const k of swarm.config.knowledge) {
    try {
      if (await fsPathExists(k.path)) {
        validKnowledge.push(k);
      } else {
        missingKnowledge.push(k.name);
      }
    } catch {
      // Treat any error as "missing" — safer than referencing a path we
      // can't actually read at brief time.
      missingKnowledge.push(k.name);
    }
  }
  if (missingKnowledge.length > 0) {
    useSwarmStore.getState().appendMessage({
      swarmId: swarm.id,
      fromAgentId: "system",
      text: `Skipped ${missingKnowledge.length} missing knowledge file(s): ${missingKnowledge.join(", ")}`,
    });
  }
  // Build a briefing swarm with the filtered knowledge set. We don't
  // mutate the stored swarm — the user may re-attach the file later and
  // relaunch, and we'd rather keep their intent intact.
  const briefingSwarm: Swarm = {
    ...swarm,
    config: { ...swarm.config, knowledge: validKnowledge },
  };

  // 1. Prepare the mailbox tree and per-agent briefs on disk.
  try {
    await fsMakeDirAll(outboxDir(swarm.config.workDir));
    for (const agent of swarm.config.agents) {
      await fsMakeDirAll(inboxDir(swarm.config.workDir, agent.id));
      await fsWriteText(
        briefFile(swarm.config.workDir, agent.id),
        composeMissionBrief(briefingSwarm, agent),
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
  let liveCount = 0;
  for (const agent of swarm.config.agents) {
    const meta = CLI_META[agent.cli];
    const args = agent.autoApprove ? [...meta.autoApproveArgs] : [];
    agentRuntime.set(agent.id, {
      swarmId: swarm.id,
      agent,
      dialogTail: "",
      handledDialogs: new Set(),
      dialogTimer: null,
      bootstrapSent: false,
      bootstrapTimer: null,
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
      liveCount++;
      // Safety fallback: if no consent dialog is detected within ~8s,
      // send the bootstrap prompt anyway. Covers Claude agents with
      // pre-accepted consent, plus other CLIs where we have no dialog
      // signatures at all. sendBootstrap is idempotent, so this races
      // harmlessly against the dialog-scanner path.
      const rtJustCreated = agentRuntime.get(agent.id);
      if (rtJustCreated) {
        rtJustCreated.bootstrapTimer = setTimeout(() => {
          sendBootstrap(agent.id);
        }, 8000);
      }
    } catch (e) {
      useSwarmStore.getState().setAgentStatus(swarm.id, agent.id, "error");
      useSwarmStore.getState().appendMessage({
        swarmId: swarm.id,
        fromAgentId: "system",
        text: `Failed to spawn ${roleLabel(agent, swarm.config.agents)} (${agent.cli}): ${String(e)}`,
      });
      agentRuntime.delete(agent.id);
      continue;
    }
  }

  // If every agent failed to spawn, there's no swarm to run. Flip the
  // status to "error" and bail out before starting the mailbox poller.
  if (liveCount === 0) {
    useSwarmStore.getState().setSwarmStatus(swarm.id, "error");
    useSwarmStore.getState().appendMessage({
      swarmId: swarm.id,
      fromAgentId: "system",
      text: "All agents failed to spawn. Swarm aborted.",
    });
    return;
  }

  // Keep the swarm in "running" state — launchDraft already set this, but
  // relaunching from "completed" via the dashboard needs it explicit too.
  useSwarmStore.getState().setSwarmStatus(swarm.id, "running");

  // 4. Start the mailbox poller. Per-agent bootstrap is already armed
  //    (either by the dialog scanner once consent clears, or by the
  //    per-agent 8-second safety fallback scheduled above), so we don't
  //    need a swarm-level bootstrap timer here.
  const timer = setInterval(() => {
    pollMailbox(swarm.id).catch(() => {});
  }, MAILBOX_POLL_MS);
  swarmRuntime.set(swarm.id, {
    workDir: swarm.config.workDir,
    pollTimer: timer,
  });
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
    if (rt?.bootstrapTimer) clearTimeout(rt.bootstrapTimer);
    agentRuntime.delete(agent.id);
    agentDecoders.delete(agent.id);
    useSwarmStore.getState().setAgentStatus(swarmId, agent.id, "exited");
  }
  useSwarmStore.getState().setSwarmStatus(swarmId, "completed");
}

/**
 * Send a user-typed message into the swarm. If `toAgentId` is provided the
 * message is delivered only to that agent; otherwise it's broadcast to every
 * live agent. Delivery failures (swarm not launched, target dead, PTY write
 * error) are surfaced as system messages in the console so the user can
 * tell whether the message actually reached anyone.
 */
export async function broadcastUserMessage(
  swarmId: string,
  text: string,
  toAgentId?: string,
): Promise<void> {
  const state = useSwarmStore.getState();
  const swarm = state.swarms.find((s) => s.id === swarmId);
  if (!swarm) return;

  // Log the user's message first so it shows up in the console
  // regardless of whether delivery succeeds.
  state.appendMessage({
    swarmId,
    fromAgentId: "user",
    toAgentId,
    text,
  });

  const targets = toAgentId
    ? swarm.config.agents.filter((a) => a.id === toAgentId)
    : swarm.config.agents;

  if (targets.length === 0) {
    state.appendMessage({
      swarmId,
      fromAgentId: "system",
      text: "Message not delivered — target agent no longer exists.",
    });
    return;
  }

  const liveTargets = targets.filter((a) => agentRuntime.has(a.id));
  if (liveTargets.length === 0) {
    state.appendMessage({
      swarmId,
      fromAgentId: "system",
      text:
        swarm.status === "running"
          ? "Message not delivered — no live agents are running right now."
          : "Message not delivered — launch the swarm first.",
    });
    return;
  }

  // The same paste-into-PTY delivery path peer messages use. We prefix
  // the text with [USER] so the agent can distinguish human input from
  // peer traffic, then trail a CR to submit in rich-input TUIs.
  const body = `[USER]: ${text}\n(Respond via the FinkSwarm protocol — write to .finkswarm/outbox/.)`;

  // Quietly succeed. We only post a system message when something
  // actually went wrong — success is implied by the absence of errors.
  const failed: { agent: SwarmAgent; error: string }[] = [];
  for (const agent of liveTargets) {
    try {
      await writeToAgent(agent.id, body + "\r");
    } catch (e) {
      failed.push({ agent, error: String(e) });
    }
  }

  if (failed.length > 0) {
    const details = failed
      .map(
        (f) => `${getAgentLabel(f.agent, swarm.config.agents)} (${f.error})`,
      )
      .join(", ");
    state.appendMessage({
      swarmId,
      fromAgentId: "system",
      text: `Failed to deliver to: ${details}`,
    });
  }
}
