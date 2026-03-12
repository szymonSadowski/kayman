---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-03-12'
inputDocuments: ['product-brief-kayman-2026-03-12.md', 'prd.md', 'prd-validation-report.md']
workflowType: 'architecture'
project_name: 'kayman'
user_name: 'Szymonsadowski'
date: '2026-03-12'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
31 FRs spanning 8 domains: Recording & Session Management (FR1-6), Pipeline
Processing (FR7-13), Personal Spotlight (FR14-15), Notion Export (FR16-18),
Summary Access (FR19-20), Configuration (FR21-26), Raycast Integration (FR27-28),
CLI & Shell (FR29-31).

Architecturally, the FRs describe a linear pipeline with two discrete CLI
invocations (`start`/`stop`) as entry points and a detached background process
as the execution engine. The pipeline is strictly sequential: audio capture →
transcription → AI summarization → Notion export, with notifications and local
persistence as cross-cutting concerns at every stage.

**Non-Functional Requirements:**
- NFR1: Transcription of 60-min recording completes within 5 min on M-series without
  foreground CPU/memory impact — drives background scheduling strategy
- NFR2-4: Sub-2s start, sub-1s stop/last — pipeline must detach instantly
- NFR5-7: Audio/transcripts local only, no telemetry — eliminates any cloud
  audio path; architectural hard constraint
- NFR8-9: Notion/AI API error handling with no silent failures — requires explicit
  retry policy and failure propagation to notification system
- NFR10: whisper.cpp graceful degradation on missing model

**Scale & Complexity:**

- Primary domain: Mac CLI / local-first tooling
- Complexity level: low-medium (single user, no auth/multitenancy, but non-trivial
  process architecture and native macOS integration)
- Estimated architectural components: ~6 (CLI layer, state manager, audio capture,
  transcription runner, AI summarizer, Notion exporter)

### Technical Constraints & Dependencies

- **Runtime:** Node.js / TypeScript (Vercel AI SDK ecosystem)
- **Platform:** macOS with M-series chip (Apple Silicon required for whisper.cpp perf)
- **Native binary:** whisper.cpp invoked from Node.js subprocess
- **Native API:** ScreenCaptureKit for audio — may require Swift/Objective-C shim or
  existing npm wrapper
- **External APIs:** Notion API, configurable AI provider (OpenAI default)
- **Raycast:** Script Commands or Raycast Extension for full command namespace +
  menu bar indicator
- **Config:** YAML at `~/.config/kayman/config.yaml` — must be parsed at startup
- **Shell completion:** Tab completion for project names (MVP)

### Cross-Cutting Concerns Identified

1. **Process lifecycle & detachment** — pipeline must detach from CLI after `stop`;
   menu bar indicator requires a persistent process separate from CLI invocations
2. **Inter-process state** — PID/state file bridges `start` and `stop` across
   separate invocations; must be atomic and handle stale state
3. **Notification chain** — macOS notifications must fire at each pipeline stage;
   must work from detached background process
4. **Failure propagation** — any pipeline stage failure must: fire notification with
   stage + error context, preserve transcript locally, exit cleanly
5. **Local file lifecycle** — audio files and transcripts must be managed across
   pipeline stages, cleaned up on success, preserved on failure
6. **Config loading** — YAML config must be validated at startup for each command;
   missing required fields produce clear errors, not crashes

## Starter Template Evaluation

### Primary Technology Domain

Mac CLI tool with Raycast Extension — TypeScript monorepo (no off-the-shelf starter exists
for this combination; manually composed from pnpm workspaces + turborepo).

### Starter Options Considered

| Option | Notes |
|--------|-------|
| `create-turbo` | Best monorepo DX; turborepo handles build caching and task orchestration |
| Single-package repo | Simpler but loses clean separation; Raycast esbuild bundler requires its own package root |
| Nx monorepo | Overkill for 2-package repo |

**Selected approach:** `create-turbo` with pnpm workspaces, 2 packages (`cli`, `raycast`), plus optional `shared` package for types/utilities shared between them.

### Selected Starter: create-turbo (manual Raycast template)

**Rationale:** Raycast requires its extension to live in its own directory with its own `package.json`
(esbuild runs from there). A turborepo gives us a single repo, shared code via workspace packages,
and build orchestration. pnpm workspaces are fully supported since `@raycast/api` v1.39.1.

**Initialization Commands:**

```bash
# 1. Scaffold monorepo
npx create-turbo@latest kayman --package-manager pnpm

# 2. Remove default apps, create packages
cd kayman
rm -rf apps/
mkdir -p packages/cli/src packages/raycast/src packages/shared/src

# 3. Scaffold Raycast Extension into packages/raycast
npm init raycast-extension -t menu-bar-extra packages/raycast

# 4. Critical: add to packages/raycast/.npmrc to fix esbuild symlink resolution
echo "node-linker=hoisted" >> packages/raycast/.npmrc

pnpm install
```

**Monorepo Structure:**

```
kayman/
├── pnpm-workspace.yaml
├── turbo.json
├── package.json              # root — dev tooling only
├── packages/
│   ├── shared/               # shared types, config loader, utils
│   │   ├── src/index.ts
│   │   └── package.json      # "@kayman/shared"
│   ├── cli/                  # Node.js CLI (commander.js)
│   │   ├── src/
│   │   │   ├── index.ts      # entry, command registration
│   │   │   ├── commands/     # start, stop, last, memo, status
│   │   │   └── pipeline/     # audio, transcribe, summarize, notion
│   │   └── package.json      # bin: { kayman: ./dist/index.js }
│   └── raycast/              # Raycast Extension
│       ├── src/
│       │   ├── start.tsx
│       │   ├── stop.tsx
│       │   ├── last.tsx
│       │   └── menu-bar.tsx  # recording duration indicator
│       ├── .npmrc            # node-linker=hoisted
│       └── package.json      # @raycast/api: ^1.104.5
```

**Architectural Decisions Provided by This Setup:**

**Language & Runtime:**
TypeScript throughout; Node.js 22 (required by @raycast/api ≥ v1.94.0)

**Build Tooling:**
- CLI: `tsup` (esbuild-based, produces CJS bin)
- Raycast: built-in `@raycast/api` esbuild bundler (`ray build`)
- Shared: `tsc` or `tsup` with declaration emit
- Orchestration: turborepo task graph (`build` → dependsOn `^build`)

**Testing Framework:**
Vitest (fast, ESM-native, compatible with tsup output)

**Code Organization:**
Shared config loading, types, and spotlight utilities live in `packages/shared` —
both CLI and Raycast import from `@kayman/shared`

**Development Experience:**
- `pnpm dev` at root runs both CLI watch mode and `ray develop`
- turbo caches build artifacts; incremental rebuilds only affected packages
- `node-linker=hoisted` in raycast package resolves esbuild workspace symlink issue

**Versions:**
- `@raycast/api`: 1.104.5
- `pnpm`: 10.x
- `turbo`: 2.8.x
- `commander`: latest (^13.x)
- `tsup`: latest (^8.x)
- `vitest`: latest (^3.x)

**Note:** Project initialization using these commands should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Background pipeline detachment strategy
- State file format and location
- Audio capture bridge to ScreenCaptureKit
- Local file storage layout

**Important Decisions (Shape Architecture):**
- macOS notification mechanism
- whisper.cpp invocation pattern
- Vercel AI SDK usage pattern

**Deferred Decisions (Post-MVP):**
- Per-project prompt overrides (Phase 2)
- `kayman ask` transcript Q&A (Phase 2)
- Calendar integration (Phase 2)

### Data Architecture

No database. All persistence is file-based:

**Session State (inter-process bridge):**
- Path: `~/.config/kayman/session.json`
- Format: JSON — PID of recording process, audio file path, project name, start timestamp
- Written atomically by `kayman start`, read/deleted by `kayman stop`
- Stale state detection: check PID liveness on read; delete if process is dead

**Local File Storage:**
- Layout: `~/.local/share/kayman/recordings/<YYYY-MM-DD>-<project>/`
- Contents per session: `audio.caf` (raw capture), `transcript.txt` (whisper output)
- Cleanup policy: delete audio + transcript on successful Notion export; preserve both on any pipeline failure

**Config:**
- `~/.config/kayman/config.yaml` — loaded and validated at startup of every command
- Validation: required fields checked at load time; missing fields produce clear error, not crash

### Authentication & Security

No authentication (personal, single-user tool).

- API keys (Notion token, AI API key) stored in `~/.config/kayman/config.yaml` — user-managed permissions
- Audio and transcripts stored locally only; no telemetry, no remote logging (NFR5-7)
- No encryption at rest — macOS filesystem permissions are sufficient for personal tool

### API & Communication Patterns

**External APIs:**

| API | Client | Error Handling |
|-----|--------|----------------|
| Notion | `@notionhq/client` (official SDK) | Retry on 429/5xx (max 3 attempts, exponential backoff); failure → notification + transcript preserved |
| AI Provider | Vercel AI SDK `generateText()` (non-streaming) | Surface provider error message in notification; preserve transcript locally |
| whisper.cpp | Direct `child_process.spawn` subprocess | Check binary + model existence before invocation; clear error on missing model (NFR10) |

**Internal IPC (CLI → Pipeline):**
- No socket/IPC — pipeline is a self-contained detached Node.js script
- Args passed via CLI arguments at spawn time; no ongoing communication needed
- Pipeline writes results to disk (transcript, summary JSON) and fires notifications

**Error Propagation Standard:**
Every pipeline stage follows: execute → on failure: (1) fire macOS notification with stage name + error message, (2) preserve transcript to disk, (3) exit non-zero

### Infrastructure & Deployment

**Background Pipeline Detachment:**
```typescript
// In kayman stop:
const child = spawn(process.execPath, [pipelineRunnerPath, ...pipelineArgs], {
  detached: true,
  stdio: 'ignore',
})
child.unref() // CLI process exits immediately; pipeline continues independently
```

**Audio Capture:**
- A thin Swift CLI shim (`packages/cli/bin/kayman-capture`) compiled with `swift build`
- Node spawns it as a subprocess; shim writes audio to a temp `.caf` file
- Shim ships as a prebuilt binary in the repo (no Swift toolchain required at runtime)
- Captures mic + system audio via ScreenCaptureKit; source configurable via CLI args

**macOS Notifications:**
- `node-notifier` npm package — works from detached background process
- Notification fired at each pipeline stage: Transcribing → Summarizing → Exporting → Done (or Error with stage)

**whisper.cpp Invocation:**
```typescript
spawn('whisper', ['--model', modelPath, '--output-txt', audioPath], { stdio: 'pipe' })
// Checks binary existence before spawn; exits with clear message if missing
```

**Vercel AI SDK:**
```typescript
const { text } = await generateText({ model, prompt: summaryPrompt })
// Non-streaming — pipeline is background, no UI to stream to
```

**Distribution (MVP):**
- `npm link` / local install via `pnpm install` in repo
- Raycast Extension: loaded as a development extension (not published to Raycast Store for MVP)
- GitHub release with prebuilt Swift shim binary (Phase 3)

**CI/CD:**
- GitHub Actions: lint + typecheck + test on push
- No deployment pipeline — local tool

### Decision Impact Analysis

**Implementation Sequence:**
1. Monorepo scaffold + shared package skeleton
2. Config loader (`@kayman/shared`) — foundation for all commands
3. Session state manager (`@kayman/shared`) — bridges start/stop
4. Swift audio capture shim — required for any recording
5. `kayman start` + `kayman stop` (CLI commands + pipeline runner)
6. whisper.cpp transcription stage
7. Vercel AI SDK summarization stage
8. Notion export stage
9. `kayman last`, `kayman memo`, `kayman status`
10. Raycast Extension (wraps CLI commands)
11. Menu bar indicator (Raycast menu-bar-extra)
12. Shell completion

**Cross-Component Dependencies:**
- `@kayman/shared` must build before `cli` or `raycast` (turborepo `dependsOn: ["^build"]`)
- Swift shim must be compiled before any recording test
- Pipeline runner is a separate entry point in `packages/cli` (not the main bin) — both built by tsup
- Raycast Extension invokes `kayman` CLI commands via `execa` — CLI must be installed/linked first

## Implementation Patterns & Consistency Rules

### Critical Conflict Points Identified

7 areas where AI agents could make different choices without explicit rules.

### Naming Patterns

**File Naming Conventions:**
- TypeScript source files: `kebab-case.ts` / `kebab-case.tsx`
  - ✅ `audio-capture.ts`, `notion-export.ts`, `menu-bar.tsx`
  - ❌ `audioCapture.ts`, `NotionExport.ts`
- Test files: co-located as `*.test.ts` (not in a `__tests__/` folder)
- Binary/shim files: `kebab-case` (no extension) — e.g. `kayman-capture`

**Code Naming Conventions:**
- Functions/variables: `camelCase`
- Types/Interfaces: `PascalCase` — prefix interfaces with `I` is forbidden
- Constants: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for config-derived values
- Exported enums: `PascalCase` with `PascalCase` members (e.g. `PipelineStage.Transcribing`)

**Pipeline Stage Naming:**
All pipeline stages use a consistent `PipelineStage` enum:
```typescript
export enum PipelineStage {
  Recording = 'recording',
  Transcribing = 'transcribing',
  Summarizing = 'summarizing',
  Exporting = 'exporting',
  Done = 'done',
}
```
This enum is defined in `@kayman/shared` and used by CLI, pipeline runner, and Raycast.

**Config Key Naming:**
- YAML config keys: `snake_case` (matches PRD schema: `user_name`, `ai_provider`, etc.)
- Parsed config TypeScript object: `camelCase` — conversion happens in the config loader
  - ✅ `config.userName`, `config.aiProvider`
  - ❌ Using raw YAML keys directly in TypeScript code

### Structure Patterns

**Project Organization:**
```
packages/
├── shared/src/
│   ├── config.ts          # config loader + validation + types
│   ├── session.ts         # session state read/write
│   ├── types.ts           # shared types (PipelineStage, Config, Session, Summary)
│   ├── notify.ts          # notification helpers (wraps node-notifier)
│   └── index.ts           # re-exports everything
├── cli/src/
│   ├── index.ts           # commander setup + command registration only
│   ├── commands/
│   │   ├── start.ts       # kayman start
│   │   ├── stop.ts        # kayman stop
│   │   ├── last.ts        # kayman last
│   │   ├── memo.ts        # kayman memo
│   │   └── status.ts      # kayman status
│   └── pipeline/
│       ├── runner.ts      # pipeline entry point (spawned detached)
│       ├── transcribe.ts  # whisper.cpp stage
│       ├── summarize.ts   # Vercel AI SDK stage
│       └── export.ts      # Notion export stage
└── raycast/src/
    ├── start.tsx
    ├── stop.tsx
    ├── last.tsx
    └── menu-bar.tsx
```

**Test File Placement:**
Co-located with source: `config.test.ts` next to `config.ts`.
Integration tests that require the built binary go in `packages/cli/src/__integration__/`.

### Format Patterns

**Session State JSON (`session.json`):**
```typescript
interface Session {
  pid: number           // recording process PID
  audioPath: string     // absolute path to .caf file
  project: string | null // null for memo mode
  startedAt: string     // ISO 8601
}
```

**Summary JSON (written to disk before Notion export, preserved on failure):**
```typescript
interface Summary {
  title: string
  tldr: string
  keyPoints: string[]   // spotlight-bolded mentions use **markdown bold**
  fullSummary: string
  project: string | null
  recordedAt: string    // ISO 8601
  transcriptPath: string
}
```

**Notification Message Templates (defined in `@kayman/shared/notify.ts`):**
```
Transcribing...
Summarizing...
Exporting to Notion...
Done — entry created in Notion
[Stage] failed: [error message]. Transcript saved to [path].
```
Agents MUST use the shared `notify()` helper — never call `node-notifier` directly.

**Error Message Format:**
All thrown errors from pipeline stages use this pattern:
```typescript
throw new PipelineError(PipelineStage.Transcribing, 'whisper binary not found at /usr/local/bin/whisper')
// PipelineError is defined in @kayman/shared/types.ts
// message format: "[Stage] failed: [detail]"
```

### Communication Patterns

**CLI → Pipeline Runner (spawn args):**
Pipeline runner always receives args in this order:
```
node runner.js <audioPath> <project|""> <transcriptSaveDir>
```
No flags, no named args — positional only, for simplicity and shell-script compatibility.

**Raycast → CLI (execa pattern):**
All Raycast commands invoke CLI via `execa`:
```typescript
import { execa } from 'execa'
await execa('kayman', ['start', project], { reject: true })
// Always use reject:true so errors surface as thrown exceptions
```
Never use `execSync` or raw `child_process` in Raycast package — always `execa`.

**State Management (Raycast):**
Raycast components use Raycast's built-in `useState`/`useEffect` hooks only.
No external state library. Session state is read from `session.json` via `@kayman/shared`.

### Process Patterns

**Error Handling:**
- Pipeline stages: every stage is wrapped in try/catch; catch calls `handlePipelineError(stage, err)` from `@kayman/shared`
- CLI commands: top-level try/catch in each command file; errors printed to stderr + exit 1
- Config errors: thrown synchronously from `loadConfig()` with a user-readable message; no stack trace shown to user
- Never use `.catch()` chains — use `async/await` + `try/catch` throughout

**Pipeline Stage Interface:**
Every stage exports a single async function with this signature:
```typescript
export async function runStage(input: StageInput): Promise<StageOutput>
// Throws PipelineError on failure — never returns null/undefined for errors
```

**Async/Await:**
- No callbacks, no `.then()` chains — `async/await` everywhere
- Top-level await is acceptable in the pipeline runner entry point

### Enforcement Guidelines

**All AI Agents MUST:**
- Import shared types, notify, config, and session utilities from `@kayman/shared` — never re-implement
- Use `PipelineStage` enum for all stage references — never hardcode stage name strings
- Follow the `runStage(input) → output | throws PipelineError` interface for all pipeline stages
- Use `execa` in Raycast package for CLI invocation — never raw `child_process`
- Co-locate test files with source files (`*.test.ts`)

**Anti-Patterns:**
- ❌ Calling `node-notifier` directly — use `notify()` from `@kayman/shared`
- ❌ Hardcoding paths like `~/.config/kayman/` — use path helpers from `@kayman/shared`
- ❌ Using `.then()` / `.catch()` — use `async/await`
- ❌ Swallowing errors silently — every catch must either rethrow or call `handlePipelineError`
- ❌ Defining `Config`, `Session`, or `Summary` types outside `@kayman/shared`

## Project Structure & Boundaries

### Complete Project Directory Structure

```
kayman/
├── README.md
├── package.json                    # root — workspace scripts + dev deps (eslint, ts, vitest)
├── pnpm-workspace.yaml
├── turbo.json                      # task graph: build, dev, test, lint
├── tsconfig.base.json              # shared TS config extended by all packages
├── .eslintrc.js                    # shared ESLint config
├── .gitignore
├── .github/
│   └── workflows/
│       └── ci.yml                  # lint + typecheck + test on push
│
├── packages/
│   │
│   ├── shared/                     # @kayman/shared
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts            # re-exports all public API
│   │       ├── types.ts            # Config, Session, Summary, PipelineStage, PipelineError
│   │       ├── config.ts           # loadConfig(), validateConfig(), path helpers
│   │       ├── session.ts          # readSession(), writeSession(), clearSession(), isProcessAlive()
│   │       ├── notify.ts           # notify(stage), notifyError(stage, err) — wraps node-notifier
│   │       ├── spotlight.ts        # applySpotlight(keyPoints, userName) — bold name mentions
│   │       ├── paths.ts            # CONFIG_DIR, DATA_DIR, SESSION_PATH, recordingDir(date, project)
│   │       ├── config.test.ts
│   │       ├── session.test.ts
│   │       ├── spotlight.test.ts
│   │       └── paths.test.ts
│   │
│   ├── cli/                        # kayman CLI binary
│   │   ├── package.json            # bin: { kayman: ./dist/index.js }
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts          # builds index.ts + pipeline/runner.ts as separate entries
│   │   ├── bin/
│   │   │   └── kayman-capture      # prebuilt Swift binary (ScreenCaptureKit shim)
│   │   ├── swift/
│   │   │   ├── Package.swift
│   │   │   └── Sources/
│   │   │       └── kayman-capture/
│   │   │           └── main.swift  # ScreenCaptureKit audio recording shim
│   │   └── src/
│   │       ├── index.ts            # commander setup + command registration
│   │       ├── commands/
│   │       │   ├── start.ts        # FR1,2: project picker, start recording, write session.json
│   │       │   ├── stop.ts         # FR3: stop recording, spawn detached pipeline runner
│   │       │   ├── last.ts         # FR19,20: read latest summary, print TL;DR
│   │       │   ├── memo.ts         # FR2: instant record, no project picker
│   │       │   └── status.ts       # FR4: check active session, print duration
│   │       ├── pipeline/
│   │       │   ├── runner.ts       # pipeline entry point (detached); orchestrates stages
│   │       │   ├── transcribe.ts   # FR7: spawn whisper subprocess, return transcript path
│   │       │   ├── summarize.ts    # FR8,10,14,15: Vercel AI SDK generateText, apply spotlight
│   │       │   └── export.ts       # FR9,16,17,18: Notion API export with retry
│   │       ├── completion/
│   │       │   └── completion.ts   # FR30: shell tab completion for project names
│   │       ├── commands/start.test.ts
│   │       ├── commands/stop.test.ts
│   │       ├── pipeline/transcribe.test.ts
│   │       ├── pipeline/summarize.test.ts
│   │       ├── pipeline/export.test.ts
│   │       └── __integration__/
│   │           └── pipeline.test.ts  # full pipeline integration (requires whisper + API keys)
│   │
│   └── raycast/                    # Raycast Extension
│       ├── package.json            # @raycast/api: ^1.104.5, name: kayman
│       ├── tsconfig.json
│       ├── .npmrc                  # node-linker=hoisted
│       ├── raycast-env.d.ts
│       └── src/
│           ├── start.tsx           # FR27: invoke kayman start with project picker UI
│           ├── stop.tsx            # FR27: invoke kayman stop
│           ├── last.tsx            # FR19: display TL;DR inline
│           ├── memo.tsx            # FR27: invoke kayman memo
│           ├── status.tsx          # FR27: display active session status
│           └── menu-bar.tsx        # FR28: live recording duration indicator in menu bar
```

### Architectural Boundaries

**Package Boundaries:**

| Package | Owns | Does NOT own |
|---------|------|-------------|
| `@kayman/shared` | Types, config loading, session R/W, notifications, spotlight logic, path constants | No process spawning, no CLI parsing, no Raycast imports |
| `cli` | Command parsing, process lifecycle, pipeline orchestration, whisper/AI/Notion calls | No Raycast imports, no direct UI rendering |
| `raycast` | Raycast UI components, menu bar, invoking CLI via execa | No direct whisper/AI/Notion calls — delegates entirely to CLI |

**Integration Boundaries:**

```
[User] → Raycast Extension → execa → kayman CLI
[User] → Terminal        →         → kayman CLI
                                        ↓
                              kayman start (writes session.json + spawns kayman-capture)
                              kayman stop  (reads session.json + spawns pipeline runner detached)
                                        ↓
                              [Detached] pipeline/runner.ts
                                ├── transcribe.ts  → whisper binary → transcript.txt
                                ├── summarize.ts   → Vercel AI SDK → summary.json
                                └── export.ts      → Notion API    → Notion entry
                              (notifications fired at each stage via node-notifier)
```

**Data Flow:**

```
kayman start
  → writes ~/.config/kayman/session.json { pid, audioPath, project, startedAt }
  → spawns kayman-capture (Swift shim) → writes audio.caf to ~/.local/share/kayman/recordings/<date>-<project>/

kayman stop
  → reads session.json → sends SIGTERM to kayman-capture PID → deletes session.json
  → spawns node runner.ts <audioPath> <project> <recordingDir> --detached

runner.ts (background)
  → notify(Transcribing)
  → transcribe(audioPath) → transcript.txt
  → notify(Summarizing)
  → summarize(transcript.txt) → summary.json (with spotlight applied)
  → notify(Exporting)
  → exportToNotion(summary.json) → Notion entry
  → notify(Done) → delete audio.caf + transcript.txt
  [on any stage failure] → notify(Error, stage, message) → preserve transcript.txt + summary.json
```

### Requirements to Structure Mapping

| FR Group | Files |
|----------|-------|
| FR1-4 (session mgmt) | `commands/start.ts`, `commands/stop.ts`, `commands/status.ts`, `shared/session.ts` |
| FR5-6 (audio capture) | `swift/Sources/kayman-capture/main.swift`, `commands/start.ts` |
| FR7 (transcription) | `pipeline/transcribe.ts` |
| FR8,10 (AI summary) | `pipeline/summarize.ts` |
| FR9,16,17,18 (Notion) | `pipeline/export.ts` |
| FR11,13 (failure/persist) | `pipeline/runner.ts`, `shared/notify.ts` |
| FR12 (notifications) | `shared/notify.ts` |
| FR14,15 (spotlight) | `shared/spotlight.ts`, `pipeline/summarize.ts` |
| FR19,20 (last summary) | `commands/last.ts` |
| FR21-26 (config) | `shared/config.ts`, `shared/paths.ts` |
| FR27 (Raycast commands) | `raycast/src/*.tsx` |
| FR28 (menu bar) | `raycast/src/menu-bar.tsx` |
| FR29 (terminal CLI) | `cli/src/index.ts` |
| FR30 (shell completion) | `cli/src/completion/completion.ts` |
| FR31 (exit codes) | `cli/src/index.ts`, all `commands/*.ts` |

### Development Workflow Integration

**Development:**
```bash
pnpm dev          # turbo: runs cli watch (tsup --watch) + ray develop in parallel
pnpm build        # turbo: shared → cli → raycast (dependency order)
pnpm test         # turbo: vitest run across all packages
pnpm lint         # eslint across all packages
```

**Build outputs:**
- `packages/cli/dist/index.js` — main CLI bin
- `packages/cli/dist/pipeline/runner.js` — detached pipeline entry
- `packages/raycast/.build/` — Raycast extension bundle (produced by `ray build`)

**Local install (development):**
```bash
pnpm install          # link all workspace packages
cd packages/cli && pnpm link --global   # makes `kayman` available in PATH
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are mutually compatible:
- Node.js 22 satisfies @raycast/api ≥ v1.94.0 requirement
- tsup (esbuild-based) produces CJS output compatible with commander.js bin registration
- node-notifier operates correctly from detached child processes (no tty required)
- execa bundles cleanly via Raycast's esbuild bundler
- pnpm workspaces fully supported by @raycast/api since v1.39.1
- Vercel AI SDK `generateText()` is compatible with Node.js 22 ESM/CJS

**Pattern Consistency:**
- `async/await` + `try/catch` enforced throughout is consistent with the detached process model
- `PipelineStage` enum defined in `@kayman/shared` is referenced correctly by all pipeline, notification, and error patterns
- `runStage(input) → output | throws PipelineError` interface is consistent across all 3 stages

**Structure Alignment:**
- Turborepo `dependsOn: ["^build"]` correctly enforces `shared` builds before `cli` and `raycast`
- `packages/cli/tsup.config.ts` dual-entry (`index.ts` + `pipeline/runner.ts`) correctly supports two distinct executables from one package
- `node-linker=hoisted` in `packages/raycast/.npmrc` resolves the esbuild symlink issue for workspace packages

### Requirements Coverage Validation ✅

**Functional Requirements — All 31 covered:**

| FR Group | Coverage |
|----------|---------|
| FR1-6 (recording/session) | `commands/start.ts`, `stop.ts`, `status.ts`, `memo.ts`, `shared/session.ts`, Swift shim |
| FR7-13 (pipeline) | `pipeline/runner.ts`, `transcribe.ts`, `summarize.ts`, `export.ts`, `shared/notify.ts` |
| FR14-15 (spotlight) | `shared/spotlight.ts` + `pipeline/summarize.ts` |
| FR16-18 (Notion export) | `pipeline/export.ts` |
| FR19-20 (last summary) | `commands/last.ts` + last-summary pointer (see gap resolution below) |
| FR21-26 (config) | `shared/config.ts`, `shared/paths.ts` |
| FR27-28 (Raycast) | `raycast/src/*.tsx`, `raycast/src/menu-bar.tsx` |
| FR29-31 (CLI/shell) | `cli/src/index.ts`, `completion/completion.ts` |

**Non-Functional Requirements — All 10 covered:**
- NFR1 (transcription <5min, no foreground impact): pipeline runs in detached process; M-series whisper perf addressed by model choice
- NFR2-4 (sub-2s start/stop/last): no blocking I/O in CLI commands before pipeline handoff
- NFR5-7 (local only): no cloud audio path; all processing in subprocess; no telemetry
- NFR8 (Notion retry): retry policy in `export.ts` (3 attempts, exponential backoff)
- NFR9 (AI error surfaces): `PipelineError` propagated to notification with provider message
- NFR10 (whisper graceful degradation): binary + model existence check before spawn

### Gap Analysis Results

**Important Gap — Resolved:**

`kayman last` discovery mechanism was undefined. Resolution: pipeline runner writes
`~/.local/share/kayman/last-summary.json` as a pointer file on successful pipeline completion:

```typescript
// written by runner.ts on Done:
{ summaryPath: '/absolute/path/to/summary.json' }
```

`commands/last.ts` reads this pointer, then reads the referenced `summary.json`.
This file is defined in `shared/paths.ts` as `LAST_SUMMARY_PATH` and the `Summary` type
in `shared/types.ts` already covers all fields needed by `last`.

Add to project structure:
- `LAST_SUMMARY_PATH = path.join(DATA_DIR, 'last-summary.json')` in `shared/paths.ts`
- Written by `pipeline/runner.ts` after successful Notion export
- Read by `commands/last.ts` and `raycast/src/last.tsx`

**Minor Gaps — Deferred to Implementation:**
- Swift shim rebuild: add `scripts/build-shim.sh` + README note; prebuilt binary committed to repo
- Menu bar polling interval: 1s default, configurable at implementation time
- Notion retry backoff formula: exponential (base 1s, max 8s) — leave to implementation

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (31 FRs, 10 NFRs, 4 journeys)
- [x] Scale and complexity assessed (low-medium, personal tool, no auth/multitenancy)
- [x] Technical constraints identified (macOS/M-series, ScreenCaptureKit, local-only)
- [x] Cross-cutting concerns mapped (6 concerns: process lifecycle, IPC state, notifications, failure propagation, file lifecycle, config)

**✅ Architectural Decisions**
- [x] Critical decisions documented with rationale (7 decisions)
- [x] Technology stack fully specified with versions
- [x] Integration patterns defined (detached spawn, execa, Notion retry)
- [x] Performance considerations addressed (NFR1-4 all covered)

**✅ Implementation Patterns**
- [x] Naming conventions established (files, code, enums, config keys)
- [x] Structure patterns defined (co-located tests, package boundaries)
- [x] Communication patterns specified (spawn args, execa, Raycast hooks)
- [x] Process patterns documented (error handling, pipeline stage interface, async/await)

**✅ Project Structure**
- [x] Complete directory structure defined (all files named)
- [x] Component boundaries established (3-package ownership table)
- [x] Integration points mapped (data flow diagram)
- [x] Requirements to structure mapping complete (FR → file table)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Simple, linear pipeline maps cleanly to implementation; no architectural ambiguity
- `@kayman/shared` as the single source of truth for types/paths/notify prevents drift
- Detached process model is proven on macOS; no daemon complexity
- All 31 FRs have a specific home file; no orphaned requirements

**Areas for Future Enhancement (Post-MVP):**
- Per-project prompt overrides → `config.ts` + `summarize.ts` extension points already exist
- `kayman ask` Q&A → new command file + new pipeline stage, no structural changes needed
- GitHub release with prebuilt binaries → CI job addition only

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Import all shared utilities from `@kayman/shared` — never re-implement
- Use `PipelineStage` enum for all stage references
- Respect the 3-package boundary table; no cross-boundary imports
- Refer to this document for all architectural questions before making decisions

**First Implementation Story:**
```bash
npx create-turbo@latest kayman --package-manager pnpm
npm init raycast-extension -t menu-bar-extra packages/raycast
echo "node-linker=hoisted" >> packages/raycast/.npmrc
pnpm install
```
Then scaffold `packages/shared/src/` with `types.ts`, `paths.ts`, `config.ts` — this is
the foundation all other stories depend on.
