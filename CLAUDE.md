# FinkSpace — CLAUDE.md

> This file is the living context document for Claude Code sessions on this repo.
> It grows with the project. Update it when architecture, conventions, or tooling change.

---

## Product Overview

**FinkSpace** is a cross-platform desktop app (Tauri + React) for running and managing multiple AI coding agents side by side. Users open terminal workspaces, split them into grids of "agents" (PTY processes running Claude Code, Codex, Gemini, Aider, etc.), and optionally orchestrate them as a coordinated swarm.

### Products in this repo

| Product | Status | Entry | Description |
|---------|--------|-------|-------------|
| **FinkSpace** | Shipped (v0.2.x) | `src/finkspace/` | Terminal grid — spawn agents, split views, drag tabs |
| **FinkSwarm** | In development | `src/finkswarm/` | Multi-agent orchestration with star topology (Coordinator + Builders/Scouts/Reviewers) |
| **KanbanBoard** | Shipped | `src/components/KanbanBoard.tsx` | Built-in Kanban board for project tracking |
| **FinkVoice** | Planned | separate repo | Voice-driven AI agent control — see [Shared with FinkVoice](#shared-with-finkvoice) below |

### GitHub
- Repo: `BlueMilkyh/FinkSpace`
- CI: GitHub Actions builds release binaries when a `v*` tag is pushed
- Releases via: `npm run release [patch|minor|major|x.y.z]`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust backend) |
| Frontend | React 19, TypeScript 5, Vite 6 |
| Styling | Tailwind CSS 3 + custom CSS (CSS `@property`, conic-gradient neon effects) |
| State | Zustand 5 with `persist` middleware (localStorage via Tauri) |
| Terminal emulator | `@xterm/xterm` 5, WebGL/Canvas renderer |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Package manager | **npm** (`package-lock.json` — do NOT use bun/yarn/pnpm) |
| Rust PTY | Tauri commands: `spawn_agent`, `write_to_agent`, `kill_agent`, `resize_agent`, `resolve_dir`, `home_dir` |

---

## Directory Structure

```
FinkSpace/
├── src/
│   ├── App.tsx                     # Root — view switcher (home/terminal/kanban/swarm/settings)
│   ├── main.tsx                    # Tauri init, platform init, React mount
│   ├── index.css                   # Global styles, neon animations (snake-neon, neon-float, etc.)
│   ├── vite-env.d.ts               # __APP_VERSION__ declare
│   │
│   ├── types/index.ts              # All shared types: Agent, Workspace, TerminalType, Kanban*, Swarm*
│   │
│   ├── finkspace/                  # FinkSpace module
│   │   ├── workspace-store.ts      # Zustand: workspaces, agents, reorder, persist
│   │   ├── AgentGrid.tsx           # Main terminal grid, layout engine
│   │   ├── AgentTile.tsx           # Single agent panel wrapper
│   │   ├── AgentHeader.tsx         # Per-agent header (name, color, status, context menu)
│   │   ├── TerminalView.tsx        # xterm.js terminal instance
│   │   ├── WorkspaceTabs.tsx       # Draggable workspace tab bar (@dnd-kit)
│   │   ├── EmptyWorkspaceWizard.tsx # Configure workspace layout + add agents wizard
│   │   ├── AddAgentButton.tsx      # Floating "+" add agent button
│   │   ├── TabContextMenu.tsx      # Right-click context menu on workspace tabs
│   │   ├── useTerminal.ts          # xterm init, fit, resize, keyboard hooks
│   │   └── notifications-store.ts  # Agent notification state
│   │
│   ├── finkswarm/                  # FinkSwarm module
│   │   ├── types.ts                # SwarmAgent, Swarm, SwarmConfig, SwarmPreset, ROLE_META, CLI_META
│   │   ├── store.ts                # Zustand swarm state
│   │   ├── manager.ts              # Swarm orchestration logic, protocol-marker routing
│   │   ├── SwarmView.tsx           # Top-level swarm view
│   │   ├── SwarmWizard.tsx         # Create-swarm wizard (mission, agents, knowledge)
│   │   ├── SwarmDashboard.tsx      # Running swarm dashboard
│   │   ├── SwarmGraph.tsx          # Visual agent topology graph
│   │   ├── SwarmConsole.tsx        # Swarm broadcast console
│   │   └── SwarmTerminalModal.tsx  # Per-agent terminal modal
│   │
│   ├── components/                 # Shared/cross-module components
│   │   ├── HomeView.tsx            # Landing screen (neon cards, typewriter, shortcuts)
│   │   ├── TitleBar.tsx            # Window chrome: logo, workspace tabs, nav icons
│   │   ├── StatusBar.tsx           # Bottom bar: active workspace stats
│   │   ├── SettingsPanel.tsx       # Settings shell (sidebar + section routing)
│   │   ├── KanbanBoard.tsx         # Full kanban view
│   │   ├── NavigateMenu.tsx        # Navigation dropdown
│   │   ├── UpdateNotification.tsx  # Auto-updater toast
│   │   ├── CdInput.tsx             # Mini shell for navigating directories (resolves via Tauri)
│   │   ├── InlineEdit.tsx          # Double-click-to-edit text field
│   │   ├── ColorPicker.tsx         # Agent/workspace color picker
│   │   └── settings/
│   │       ├── ShortcutsSection.tsx    # Editable keyboard shortcut bindings
│   │       ├── ShortcutCapture.tsx     # Click-to-capture shortcut component
│   │       ├── AppearanceSection.tsx
│   │       ├── AIAgentsSection.tsx
│   │       ├── TerminalSection.tsx
│   │       ├── CLISection.tsx
│   │       └── APIKeysSection.tsx
│   │
│   ├── stores/
│   │   ├── settings-store.ts       # App settings (shortcuts, theme, terminal, AI defaults) — persisted
│   │   ├── navigation-store.ts     # Active view (home/terminal/kanban/swarm/settings), previousView
│   │   └── kanban-store.ts         # Kanban boards/columns/cards — persisted
│   │
│   ├── hooks/
│   │   ├── useKeyboardShortcuts.ts # Global keydown handler, reads from settings-store shortcuts
│   │   └── useTheme.ts             # Applies theme class + CSS vars to :root
│   │
│   └── lib/
│       ├── shortcuts.ts            # parseShortcut, matchesShortcut, formatShortcutFromEvent, shortcutToParts
│       ├── platform.ts             # isMac(), isWindows(), getPlatform(), getHome(), initPlatform()
│       ├── tauri-bridge.ts         # Tauri command wrappers: spawnAgent, killAgent, writeToAgent, etc.
│       ├── terminal-manager.ts     # xterm instance registry, copy/paste, selection
│       └── colors.ts               # AGENT_COLORS palette, getNextColor()
│
├── src-tauri/                      # Rust/Tauri backend
│   ├── tauri.conf.json             # App config: identifier=com.finkspace.app, version
│   └── src/
│       └── main.rs                 # PTY spawn, write, kill, resize; platform commands
│
├── scripts/
│   └── release.mjs                 # Bump version in tauri.conf.json + package.json, commit, tag, push
│
├── app-icon.png                    # App icon — imported as Vite asset (NOT public/ folder)
├── package.json                    # scripts: dev, build, tauri, release
├── vite.config.ts                  # __APP_VERSION__ define, port 1420 strict
└── tailwind.config.ts
```

---

## Key Conventions

### State management
- **Zustand** stores, always with TypeScript interfaces defined above `create<T>()`.
- Persisted stores use `partialize` to exclude transient state + custom `merge` for migration safety.
- `workspace-store.ts` is in `src/finkspace/` (was moved from `src/stores/`).
- Call `useStore.getState()` inside event handlers/effects; `useStore(selector)` in render.

### Shortcut system
- All bindings live in `settings-store.ts → settings.shortcuts` as `Record<string, string>`.
- Storage format: `"Ctrl+Shift+W"` — `Ctrl` maps to `metaKey` on macOS at match time.
- Shared util: `src/lib/shortcuts.ts` — use `parseShortcut`, `matchesShortcut`, `shortcutToParts`, `formatShortcutFromEvent`. Do **not** re-implement these inline.
- `defaultShortcuts` is exported from `settings-store.ts` for reset UI.
- `switchWorkspace1to9` is a special range binding — handler extracts only the modifier prefix from the stored value, then pairs it with `Digit1..Digit9`.
- Handler in `useKeyboardShortcuts.ts` must read `useSettingsStore.getState().shortcuts` inside the `keydown` handler (not via selector), so it always uses the current value without re-registering the listener.

### Assets
- Static assets that need to survive Vite build **must be imported as ES modules**, not referenced by runtime path string.
- `app-icon.png` is imported: `import appIconUrl from "../../app-icon.png"` — never `src="/app-icon.png"`.
- There is no `public/` directory.

### Component patterns
- Feature-module files live in `src/finkspace/` or `src/finkswarm/`, not `src/components/`.
- Cross-feature or shell components go in `src/components/`.
- DnD uses `@dnd-kit` — `PointerSensor` with `activationConstraint: { distance: 6 }` so clicks still fire. `disabled: isEditing` on `useSortable` during inline rename.

### Neon/visual style
- CSS animations in `src/index.css`: `.snake-neon` (orange rotating border), `.snake-neon-cyan`, `neon-float`, `neon-pulse-orange`, `.neon-scanline`, `.typewriter-cursor`.
- Cards/tiles get `snake-neon` class only — no extra hover overlays, glow divs, or shadow classes. The border effect is the full decoration.
- Accent color: `#e67e22` (orange) for FinkSpace, cyan for FinkSwarm.

### Terminal types
- Defined per-platform in `src/types/index.ts` — call `getTerminalTypes()` at runtime after `initPlatform()`.
- `TERMINAL_TYPES` (module-level `let`) is populated after `refreshTerminalTypes()` — watch for stale reads before platform init.

### Release process
```bash
npm run release          # patch bump (0.2.2 → 0.2.3)
npm run release minor    # minor bump
npm run release 0.3.0    # exact version
```
- Requires clean git working tree (no uncommitted changes). Stash `.claude/settings.local.json` first if needed.
- Bumps `package.json` and `src-tauri/tauri.conf.json` in sync, commits `"release: vX.Y.Z"`, tags, and pushes to origin.
- GitHub Actions builds multi-platform binaries from the tag.

### Dev server
```bash
npm run tauri dev    # Vite on :1420 (strict) + Rust cargo run
```
- If port 1420 is taken: `netstat -ano | grep :1420` → `taskkill //F //PID <pid>`.
- TypeScript check: `npx tsc --noEmit` — should exit 0 before every commit.

---

## Views

| `ViewType` | Component | Description |
|-----------|-----------|-------------|
| `"home"` | `HomeView` | Landing screen with typewriter, product cards, shortcuts |
| `"terminal"` | `AgentGrid` | FinkSpace terminal workspace grid |
| `"kanban"` | `KanbanBoard` | Built-in Kanban board |
| `"swarm"` | `SwarmView` | FinkSwarm AI orchestration |
| `"settings"` | `SettingsPanel` | Settings overlay (Escape or Ctrl+, to toggle) |

Views are stacked as `absolute` divs with `opacity` + `pointerEvents` transitions — all mount at once, only the active one is visible.

---

## FinkSwarm Agent Roles

| Role | Color | Responsibility |
|------|-------|----------------|
| `coordinator` | yellow `#f1c40f` | Plans, routes tasks, declares done |
| `builder` | blue `#3498db` | Writes code |
| `scout` | green `#2ecc71` | Reads codebase/docs, answers questions |
| `reviewer` | orange `#e67e22` | Audits, runs tests |
| `custom` | purple `#9b59b6` | User-defined |

Coordination uses protocol markers on stdout — see `src/finkswarm/manager.ts`.

---

## Shared with FinkVoice

> FinkVoice is a planned separate Tauri app for voice-driven AI agent control. These are the expected integration points with FinkSpace.

**Shared infrastructure (planned):**
- PTY backend: same Tauri Rust commands (`spawn_agent`, `write_to_agent`, `kill_agent`) — FinkVoice will call the same interface.
- Agent color palette: `src/lib/colors.ts → AGENT_COLORS` — keep in sync or extract to a shared package.
- Platform detection: `src/lib/platform.ts` — copy pattern, not the file (separate Tauri app).
- Terminal types list: `src/types/index.ts → TERMINAL_TYPES` — FinkVoice will need the same CLI list.
- Agent identity: `Agent` interface (`id`, `name`, `color`, `status`, `workDir`, `terminalType`) — likely shared DTO format if inter-app communication is added.

**Divergence points:**
- FinkVoice will have its own Zustand store, settings, and navigation.
- UI theme may diverge (FinkSpace is dark/neon orange; FinkVoice TBD).
- Keyboard shortcuts are FinkSpace-specific; FinkVoice will have voice commands.

> Update this section when FinkVoice repo is created and integration shape becomes clearer.

---

## Zustand Persist Keys

| Store | localStorage key |
|-------|-----------------|
| workspace-store | `finkspace-workspaces` |
| settings-store | `finkspace-settings` |
| kanban-store | `finkspace-kanban` |
| finkswarm/store | TBD |

---

## What Claude Should NOT Do

- Do not use `bun`, `yarn`, or `pnpm` — this repo uses **npm**.
- Do not put static assets in `public/` — import them as ES modules.
- Do not re-implement `parseShortcut` / `matchesShortcut` / `shortcutToParts` inline — use `src/lib/shortcuts.ts`.
- Do not amend published commits — always create new commits.
- Do not run `git push --force` to `main`.
- Do not commit when the user hasn't explicitly asked.
- Do not put feature-module files in `src/components/` — use `src/finkspace/` or `src/finkswarm/`.
- Do not add extra hover effects or shadow classes to cards — only `snake-neon` class for border decoration.
- Do not reference `src/stores/workspace-store` — it is now at `src/finkspace/workspace-store`.
