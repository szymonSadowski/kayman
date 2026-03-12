---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
---

# kayman - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for kayman, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can start a recording session and associate it with a project from their configured project list
FR2: User can start a recording session without a project (memo mode)
FR3: User can stop an active recording session
FR4: User can check whether a recording is active and view its duration
FR5: System captures system audio and microphone audio during a recording session
FR6: User can configure which audio inputs to capture (system, mic, or both)
FR7: System transcribes recorded audio locally after a session ends
FR8: System generates an AI summary from the transcript after transcription completes
FR9: System exports a structured meeting entry to Notion after summarization completes
FR10: System generates a meeting title via AI when no title is provided
FR11: System preserves the transcript locally if any pipeline stage fails
FR12: System notifies the user at each pipeline stage (transcribing, summarizing, exporting, done)
FR13: System notifies the user with the specific failure stage and error context if any pipeline stage fails
FR14: System detects occurrences of the user's configured name in the transcript
FR15: System bolds detected user name mentions in the Key Points section of the summary output
FR16: System creates a Notion database entry tagged with the associated project
FR17: Each Notion entry contains a title, TL;DR, Key Points (with spotlight), and Full Summary sections
FR18: System associates memo recordings with a dedicated Memos section in Notion
FR19: User can retrieve the most recent meeting summary TL;DR inline within Raycast
FR20: User can retrieve the most recent meeting summary from the terminal
FR21: User can configure the tool via a YAML file at `~/.config/kayman/config.yaml`
FR22: User can configure their name (used for spotlight detection) in the config file
FR23: User can configure Notion credentials and target database in the config file
FR24: User can configure the AI provider, model, and API key in the config file
FR25: User can define a list of named projects with associated Notion page IDs in the config file
FR26: User can configure audio input preferences in the config file
FR27: User can invoke all kayman commands from Raycast
FR28: User can see a live recording duration indicator in the menu bar while a session is active
FR29: User can invoke all kayman commands from the terminal without Raycast
FR30: System provides shell tab completion for project names on `kayman start`
FR31: System exits with non-zero codes on failure for scripting compatibility

### NonFunctional Requirements

NFR1: Transcription of a 60-minute recording completes within 5 minutes on M-series Mac without noticeable CPU/memory impact on active foreground work
NFR2: `kayman start` initiates recording within 2 seconds of invocation
NFR3: `kayman stop` triggers the pipeline within 1 second of invocation
NFR4: `kayman last` renders the TL;DR within 1 second of invocation
NFR5: Audio recordings never leave the local machine — all transcription is performed on-device
NFR6: Config file containing API keys and tokens stored at `~/.config/kayman/` with no network transmission of credentials
NFR7: Transcripts and summaries stored locally only; no telemetry or remote logging
NFR8: Pipeline handles Notion API rate limits and transient failures with retry or failure notification — no silent data loss
NFR9: AI provider errors (rate limits, auth failures, model errors) surfaced with actionable error messages
NFR10: whisper.cpp integration degrades gracefully if the model file is missing (clear error, not crash)

### Additional Requirements

- **Starter Template (Epic 1 Story 1):** Scaffold via `create-turbo` with pnpm workspaces — 3 packages: `@kayman/shared`, `cli`, `raycast`. First story must initialize this monorepo structure before any other work.
- Node.js 22 required (`@raycast/api` ≥ v1.94.0 constraint); pnpm 10.x; turbo 2.8.x
- Build tooling: `tsup` for CLI (dual-entry: `index.ts` + `pipeline/runner.ts`); `@raycast/api` esbuild bundler for Raycast; `vitest` for testing; `tsc/tsup` for shared
- Background pipeline detachment: Node.js `spawn` with `detached: true` + `child.unref()` — CLI exits immediately after handoff
- Session state bridging `start`→`stop`: atomic JSON at `~/.config/kayman/session.json` with PID liveness check on read
- Local file storage layout: `~/.local/share/kayman/recordings/<YYYY-MM-DD>-<project>/` containing `audio.caf` + `transcript.txt`
- `LAST_SUMMARY_PATH` pointer file (`~/.local/share/kayman/last-summary.json`) written on successful pipeline completion; read by `kayman last`
- Swift CLI shim (`kayman-capture`) compiled with `swift build`, prebuilt binary committed; wraps ScreenCaptureKit for audio capture
- macOS notifications via `node-notifier` — ONLY through shared `notify()` helper in `@kayman/shared/notify.ts`; never call `node-notifier` directly
- Notion retry policy: max 3 attempts, exponential backoff (base 1s, max 8s)
- `PipelineStage` enum defined in `@kayman/shared/types.ts`; all pipeline stages use `runStage(input) → output | throws PipelineError` interface
- `execa` for Raycast→CLI invocation; never raw `child_process` in Raycast package
- CI/CD: GitHub Actions — lint + typecheck + test on push; no deployment pipeline
- Config validation: required fields checked at startup of every command; missing fields → clear user-readable error, not crash
- `node-linker=hoisted` in `packages/raycast/.npmrc` (resolves esbuild workspace symlink issue)

### FR Coverage Map

FR1: Epic 2 - Start recording with project picker
FR2: Epic 2 - Memo mode (no project)
FR3: Epic 2 - Stop recording
FR4: Epic 2 - Status check (active + duration)
FR5: Epic 2 - System + mic audio capture via Swift shim
FR6: Epic 2 - Audio input source config
FR7: Epic 3 - whisper.cpp local transcription
FR8: Epic 3 - AI summarization
FR9: Epic 3 - Notion export
FR10: Epic 3 - AI-generated meeting title
FR11: Epic 3 - Local transcript preservation on failure
FR12: Epic 3 - Per-stage pipeline notifications
FR13: Epic 3 - Failure notification with stage + error context
FR14: Epic 3 - User name detection in transcript
FR15: Epic 3 - Bold name mentions in Key Points
FR16: Epic 3 - Notion entry with project tag
FR17: Epic 3 - Notion entry structure (title, TL;DR, Key Points, Full Summary)
FR18: Epic 3 - Memo → Memos section in Notion
FR19: Epic 4 - `kayman last` TL;DR inline in Raycast
FR20: Epic 4 - `kayman last` in terminal
FR21: Epic 1 - YAML config file at ~/.config/kayman/config.yaml
FR22: Epic 1 - User name in config (spotlight)
FR23: Epic 1 - Notion credentials in config
FR24: Epic 1 - AI provider/model/key in config
FR25: Epic 1 - Projects list in config
FR26: Epic 1 - Audio input prefs in config
FR27: Epic 4 - All commands invokable from Raycast
FR28: Epic 4 - Menu bar recording duration indicator
FR29: Epic 1 - Terminal CLI entry point (commander)
FR30: Epic 4 - Shell tab completion for project names
FR31: Epic 1 - Non-zero exit codes on failure

## Epic List

### Epic 1: Foundation — Project Scaffold & Configuration System
Users can install kayman, write a config file, and the tool validates it on startup. The full monorepo structure, shared types/utilities, and CLI entry point are in place — everything needed to run any command.
**FRs covered:** FR21, FR22, FR23, FR24, FR25, FR26, FR29, FR31

### Epic 2: Audio Recording & Session Management
Users can start a named recording session (or a memo), check whether recording is active and how long it's been running, and stop it — audio is captured and saved locally.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6

### Epic 3: Meeting Pipeline — Transcription, Summary & Notion Export
Stopping a recording triggers the full background pipeline: local whisper.cpp transcription → AI summary with Personal Spotlight bolding → structured Notion export. Notifications fire at every stage; any failure surfaces with stage + error context and preserves the transcript locally.
**FRs covered:** FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18

### Epic 4: Summary Access & Raycast Integration
`kayman last` works in terminal and Raycast inline. All commands have Raycast counterparts. The menu bar shows live recording duration. Shell tab completion for project names completes the power-user CLI experience.
**FRs covered:** FR19, FR20, FR27, FR28, FR30

## Epic 1: Foundation — Project Scaffold & Configuration System

Users can install kayman, write a config file, and the tool validates it on startup. The full monorepo structure, shared types/utilities, and CLI entry point are in place — everything needed to run any command.

### Story 1.1: Monorepo Scaffold & Build Tooling

As a developer,
I want the kayman monorepo initialized with all three packages, build tooling, and CI configured,
So that all subsequent stories have a working project foundation to build on.

**Acceptance Criteria:**

**Given** a fresh machine with Node.js 22 and pnpm installed
**When** `pnpm install && pnpm build` is run from the repo root
**Then** all three packages (`@kayman/shared`, `cli`, `raycast`) build without errors
**And** `pnpm test` runs vitest across all packages (zero tests pass, zero fail)
**And** turbo build order resolves `shared` before `cli` and `raycast`

**Given** the repo is pushed to GitHub
**When** a commit is pushed
**Then** the CI workflow runs lint + typecheck + test and reports status

### Story 1.2: Shared Package — Types, Paths & Config Loader

As a developer,
I want `@kayman/shared` to export all core types, path constants, and a config loader with validation,
So that CLI commands can load and validate the config without duplicating logic.

**Acceptance Criteria:**

**Given** a valid `~/.config/kayman/config.yaml` exists with all required fields
**When** `loadConfig()` is called
**Then** it returns a typed `Config` object with camelCase keys (e.g. `config.userName`, `config.aiProvider`)
**And** `PipelineStage`, `PipelineError`, `Config`, `Session`, `Summary` types are exported from `@kayman/shared`
**And** `CONFIG_DIR`, `DATA_DIR`, `SESSION_PATH`, `LAST_SUMMARY_PATH`, and `recordingDir(date, project)` are exported from `paths.ts`

**Given** a config file with a missing required field (e.g. `notion_token`)
**When** `loadConfig()` is called
**Then** it throws a user-readable error (e.g. `"Config error: notion_token is required"`) — no stack trace
**And** unit tests cover valid config, missing fields, and malformed YAML

### Story 1.3: CLI Entry Point, Command Stubs & Exit Codes

As a power user,
I want to run `kayman <command>` from the terminal and see helpful output even before commands are fully implemented,
So that the CLI is installable and the config validation feedback loop works end-to-end.

**Acceptance Criteria:**

**Given** `kayman` is installed via `pnpm link --global`
**When** `kayman --help` is run
**Then** all 5 commands (`start`, `stop`, `last`, `memo`, `status`) are listed with descriptions

**Given** a valid config file exists
**When** any `kayman` command is run
**Then** config is loaded and validated at startup before executing the command

**Given** config is missing or invalid
**When** any `kayman` command is run
**Then** an error message is printed to stderr and the process exits with code 1 (FR31)

**Given** a stub command like `kayman status` runs successfully
**When** it exits
**Then** the process exits with code 0

## Epic 2: Audio Recording & Session Management

Users can start a named recording session (or a memo), check whether recording is active and how long it's been running, and stop it — audio is captured and saved locally.

### Story 2.1: Swift Audio Capture Shim

As a developer,
I want a prebuilt Swift CLI binary (`kayman-capture`) that records audio via ScreenCaptureKit,
So that Node.js can spawn it as a subprocess without requiring users to have Swift installed.

**Acceptance Criteria:**

**Given** `packages/cli/bin/kayman-capture` exists (prebuilt binary committed to repo)
**When** `kayman-capture --source system_and_mic --output /tmp/test.caf` is run
**Then** it begins writing audio to the specified `.caf` file

**Given** `kayman-capture` is running
**When** it receives `SIGTERM`
**Then** it finalizes the `.caf` file and exits cleanly

**Given** `--source mic_only` or `--source system_only` is passed
**When** recording runs
**Then** only the specified audio source is captured (FR6)

### Story 2.2: Session State Manager

As a developer,
I want `@kayman/shared` to export session read/write/clear utilities,
So that `kayman start` and `kayman stop` can share recording state across separate process invocations.

**Acceptance Criteria:**

**Given** a session is written via `writeSession(session)`
**When** `readSession()` is called in a separate process
**Then** it returns the same `Session` object (`{ pid, audioPath, project, startedAt }`)

**Given** a session file exists but the recorded PID is no longer alive
**When** `readSession()` is called
**Then** it returns `null` and deletes the stale session file (stale-state protection)

**Given** `clearSession()` is called
**When** `readSession()` is subsequently called
**Then** it returns `null`
**And** unit tests cover write/read, stale PID detection, and clear

### Story 2.3: `kayman start` — Project Picker & Recording

As a power user,
I want to run `kayman start` and pick a project (or pass it directly), then have recording begin immediately,
So that I can capture a meeting in ≤2 keystrokes without leaving Raycast or opening a terminal.

**Acceptance Criteria:**

**Given** `kayman start` is run with no argument
**When** the command executes
**Then** an interactive project picker lists all projects from config and waits for selection

**Given** `kayman start "Project Kayman"` is run
**When** the command executes
**Then** recording begins immediately with that project (no picker shown)

**Given** a project is selected
**When** recording starts
**Then** `kayman-capture` is spawned with the configured audio source, `session.json` is written with `{ pid, audioPath, project, startedAt }`, and the command exits within 2 seconds (NFR2)

**Given** `kayman start` is run while a session is already active
**When** the command executes
**Then** an error is printed to stderr: `"Recording already in progress. Run kayman stop first."` and exits with code 1

**Given** `kayman memo` is run
**When** the command executes
**Then** recording begins immediately with `project: null`, no picker shown (FR2)

### Story 2.4: `kayman stop` & `kayman status`

As a power user,
I want `kayman stop` to end recording and `kayman status` to show whether recording is active,
So that I can control and monitor sessions from terminal or Raycast.

**Acceptance Criteria:**

**Given** an active recording session exists
**When** `kayman stop` is run
**Then** `SIGTERM` is sent to the `kayman-capture` PID, `session.json` is deleted, and the command exits within 1 second (NFR3)
**And** a placeholder message `"Pipeline: stub (transcription not yet implemented)"` is printed to stdout

**Given** no active recording session exists
**When** `kayman stop` is run
**Then** an error is printed: `"No active recording session."` and exits with code 1

**Given** an active recording session exists
**When** `kayman status` is run
**Then** stdout shows `"Recording: active — Project Kayman (duration: 12m 34s)"` (FR4)

**Given** no active recording session exists
**When** `kayman status` is run
**Then** stdout shows `"Recording: inactive"` and exits with code 0

## Epic 3: Meeting Pipeline — Transcription, Summary & Notion Export

Stopping a recording triggers the full background pipeline: local whisper.cpp transcription → AI summary with Personal Spotlight bolding → structured Notion export. Notifications fire at every stage; any failure surfaces with stage + error context and preserves the transcript locally.

### Story 3.1: Notification System

As a power user,
I want macOS notifications to fire at each pipeline stage with consistent messaging,
So that I know the pipeline is progressing without watching a terminal.

**Acceptance Criteria:**

**Given** `notify(PipelineStage.Transcribing)` is called from any process (including detached)
**When** it executes
**Then** a macOS notification appears with the message `"Transcribing..."`

**Given** `notifyError(PipelineStage.Summarizing, err)` is called
**When** it executes
**Then** a macOS notification appears with message `"Summarizing failed: [error message]. Transcript saved to [path]."` (FR13)

**Given** `notify(PipelineStage.Done)` is called
**When** it executes
**Then** a macOS notification appears: `"Done — entry created in Notion"`
**And** all notification helpers are exported from `@kayman/shared/notify.ts` — `node-notifier` is never called directly elsewhere

### Story 3.2: Transcription Stage

As a power user,
I want my recorded audio transcribed locally via whisper.cpp after a session ends,
So that my audio never leaves my machine (NFR5).

**Acceptance Criteria:**

**Given** a valid `.caf` audio file and whisper binary + model exist
**When** `runTranscribe({ audioPath, transcriptDir })` is called
**Then** it spawns whisper as a subprocess, waits for completion, and returns the path to `transcript.txt`
**And** the stage follows the `runStage(input) → output | throws PipelineError` interface

**Given** the whisper binary is not found at the expected path
**When** `runTranscribe` is called
**Then** it throws `PipelineError(PipelineStage.Transcribing, "whisper binary not found at ...")` (NFR10)

**Given** the whisper model file is missing
**When** `runTranscribe` is called
**Then** it throws `PipelineError` with a clear message pointing to the missing model path (NFR10)

**Given** a 60-minute recording on M-series Mac
**When** transcription runs as a detached background process
**Then** it completes within 5 minutes without noticeable foreground CPU/memory impact (NFR1)

### Story 3.3: AI Summarization & Personal Spotlight

As a power user,
I want my transcript summarized by an AI and my name bolded in Key Points,
So that I can instantly find the moments that involved me (the Personal Spotlight feature).

**Acceptance Criteria:**

**Given** a transcript file and valid AI config
**When** `runSummarize({ transcriptPath, config })` is called
**Then** it calls `generateText()` via Vercel AI SDK (non-streaming) and returns a `Summary` object with `title`, `tldr`, `keyPoints`, `fullSummary`

**Given** the user's name appears in the transcript (e.g. `"Szymon"`)
**When** `applySpotlight(keyPoints, config.userName)` is called
**Then** all occurrences of the user's name in `keyPoints` are wrapped in `**bold**` markdown (FR14, FR15)

**Given** no title is provided
**When** summarization runs
**Then** an AI-generated title is included in the `Summary` object (FR10)

**Given** the AI provider returns an error (e.g. rate limit, auth failure)
**When** `runSummarize` is called
**Then** it throws `PipelineError(PipelineStage.Summarizing, "[provider error message]")` (NFR9)
**And** unit tests cover spotlight bolding, missing name (no change), and multiple occurrences

### Story 3.4: Notion Export Stage

As a power user,
I want my meeting summary exported to Notion as a structured entry tagged to my project,
So that I can find it before my next meeting without any manual work.

**Acceptance Criteria:**

**Given** a `Summary` object and valid Notion config
**When** `runExport({ summary, config })` is called
**Then** a Notion database entry is created with Title, TL;DR, Key Points (spotlight applied), and Full Summary sections (FR17)
**And** the entry is tagged with the associated project's `notion_page_id` (FR16)

**Given** `summary.project` is `null` (memo mode)
**When** export runs
**Then** the entry is associated with the Memos section/tag in Notion (FR18)

**Given** Notion returns a 429 or 5xx response
**When** export is attempted
**Then** it retries up to 3 times with exponential backoff (base 1s, max 8s) before throwing `PipelineError` (NFR8)

**Given** Notion returns an auth error (401)
**When** export is attempted
**Then** it throws `PipelineError(PipelineStage.Exporting, "Notion auth failed: check notion_token in config")` immediately (no retry)

### Story 3.5: Pipeline Runner & `kayman stop` Integration

As a power user,
I want `kayman stop` to hand off to a fully detached background pipeline that transcribes, summarizes, and exports — with notifications throughout and transcript preservation on any failure,
So that I never need to babysit the pipeline and silent failures are impossible.

**Acceptance Criteria:**

**Given** `kayman stop` is run with an active session
**When** the command executes
**Then** `pipeline/runner.ts` is spawned detached (`detached: true`, `child.unref()`), the CLI process exits within 1 second (NFR3), and the user receives a `"Transcribing..."` notification shortly after

**Given** the pipeline runner executes successfully
**When** all stages complete
**Then** notifications fire in sequence: Transcribing → Summarizing → Exporting → Done
**And** `~/.local/share/kayman/last-summary.json` is written pointing to the completed `summary.json`
**And** `audio.caf` and `transcript.txt` are deleted on success

**Given** any pipeline stage fails (e.g. whisper error)
**When** the failure occurs
**Then** a failure notification fires with stage + error message (FR13)
**And** `transcript.txt` is preserved on disk (FR11)
**And** the runner exits non-zero

**Given** the pipeline runner is a detached process
**When** it runs
**Then** it passes args positionally: `node runner.js <audioPath> <project|""> <transcriptSaveDir>` (no flags)

## Epic 4: Summary Access & Raycast Integration

`kayman last` works in terminal and Raycast inline. All commands have Raycast counterparts. The menu bar shows live recording duration. Shell tab completion for project names completes the power-user CLI experience.

### Story 4.1: `kayman last` — Terminal Summary Access

As a power user,
I want to run `kayman last` in the terminal and see the most recent meeting TL;DR,
So that I can get meeting context without opening Notion (FR20).

**Acceptance Criteria:**

**Given** a completed pipeline has written `~/.local/share/kayman/last-summary.json`
**When** `kayman last` is run in the terminal
**Then** it reads the pointer file, loads `summary.json`, and prints the TL;DR to stdout within 1 second (NFR4)
**And** output includes the meeting title and project name for context

**Given** no pipeline has completed yet (no `last-summary.json` exists)
**When** `kayman last` is run
**Then** it prints `"No meeting summaries yet. Run kayman stop after your next meeting."` and exits with code 0

### Story 4.2: Raycast Extension Scaffold & Command Stubs

As a developer,
I want the Raycast extension package wired up with all command stubs and `execa` integration,
So that Raycast can invoke CLI commands and all extension entry points exist for full implementation.

**Acceptance Criteria:**

**Given** the Raycast extension is loaded as a development extension in Raycast
**When** the kayman namespace is opened
**Then** all 5 commands (start, stop, last, memo, status) appear in the Raycast command list

**Given** any Raycast command stub invokes the CLI via `execa`
**When** it executes
**Then** it uses `await execa('kayman', [...args], { reject: true })` — never raw `child_process`
**And** `node-linker=hoisted` is set in `packages/raycast/.npmrc`

### Story 4.3: Raycast Commands — Start, Stop, Last, Memo, Status

As a power user,
I want all kayman commands to work natively in Raycast with proper UI,
So that I can run the entire meeting workflow without leaving `⌘ Space` (FR27).

**Acceptance Criteria:**

**Given** the user opens `kayman start` in Raycast
**When** the command loads
**Then** a project picker list renders with all projects from config; selecting one invokes `kayman start <project>` via execa

**Given** the user opens `kayman stop` in Raycast
**When** selected
**Then** it invokes `kayman stop` via execa and shows a success/error toast

**Given** the user opens `kayman last` in Raycast
**When** the command loads
**Then** the most recent TL;DR is rendered inline in Raycast (FR19) within 1 second (NFR4)

**Given** `kayman memo` is invoked from Raycast
**When** selected
**Then** it invokes `kayman memo` via execa and confirms recording started

**Given** `kayman status` is invoked from Raycast
**When** the command loads
**Then** it shows active recording duration or "inactive" state

### Story 4.4: Menu Bar Recording Indicator

As a power user,
I want a live recording duration indicator in the macOS menu bar while a session is active,
So that I can confirm recording is running without switching windows (FR28).

**Acceptance Criteria:**

**Given** `kayman start` has been run and a session is active
**When** the menu bar extension is running
**Then** the menu bar item shows the recording duration updating every second (e.g. `⏺ 12:34`)

**Given** no session is active
**When** the menu bar extension is running
**Then** the menu bar item shows a neutral/inactive state (e.g. `⏺ kayman`) or is hidden

**Given** the extension polls `session.json` every 1 second
**When** `kayman stop` is run and `session.json` is deleted
**Then** the menu bar indicator updates to inactive state within 1–2 seconds

### Story 4.5: Shell Tab Completion

As a power user,
I want tab completion for `kayman start <project>` in my shell,
So that I never have to type project names in full (FR30).

**Acceptance Criteria:**

**Given** the shell completion script is sourced in `~/.zshrc` or `~/.bashrc`
**When** the user types `kayman start ` and presses Tab
**Then** a list of project names from `~/.config/kayman/config.yaml` is shown

**Given** the user types `kayman start Kay` and presses Tab
**When** completion runs
**Then** it completes to `kayman start Kayman` (prefix matching)

**Given** the config file is updated with a new project
**When** tab completion runs next time
**Then** the new project name appears in completions (sourced live from config, not cached)
