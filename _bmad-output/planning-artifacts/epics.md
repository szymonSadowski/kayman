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

### Epic 5: Error Handling & CLI UX
Polished CLI experience with styled output, proactive error detection, graceful failure recovery, and per-project customization. Makes kayman feel like a professional tool, not a script.
**FRs covered:** NFR8, NFR9, NFR10 (enhanced)

### Epic 6: Local-First Mode & CLI Config
Full local inference pipeline via Ollama — no API calls except Notion. Quick `offline`/`online` mode switching. General-purpose `kayman config` command for editing settings from the terminal. Local model management for whisper.
**FRs covered:** NFR5 (extended), NFR7 (strengthened)

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

### Story 3.6: Session Tags & Notion Tag Export

As a power user,
I want to pass `--tags daily voc standup` on `kayman start` so those words are stored as tags in my Notion meeting entry,
So that I can categorize and filter meetings in Notion without manual tagging.

**Acceptance Criteria:**

**Given** `kayman start test --tags daily voc` is run
**When** recording starts
**Then** the tags `["daily", "voc"]` are stored in `session.json` alongside project/pid/startedAt

**Given** the pipeline runner reads a session with tags
**When** Notion export runs
**Then** the Notion database entry includes a multi-select "Tags" property populated with each tag value

**Given** `kayman start test` is run without `--tags`
**When** recording starts
**Then** `session.json` has `tags: []` and the Notion entry has no tags set

**Given** `kayman start test --tags daily` is run via Raycast
**When** the Raycast command invokes the CLI
**Then** the `--tags` flag is forwarded and tags appear in Notion

### Story 3.7: `kayman list` — Browse Past Meetings

As a power user,
I want to list my past meeting recordings filtered by project, date range, or tags,
So that I can find a specific past meeting from the terminal without opening Notion.

**Acceptance Criteria:**

**Given** recordings exist at `~/.local/share/kayman/recordings/` with `summary.json` files
**When** `kayman list` is run with no arguments
**Then** it prints all recordings sorted by date descending, showing: date, project name, title (from `summary.json`), and tags
**And** each row is one line so the output remains scannable

**Given** recordings exist for multiple projects
**When** `kayman list --project "Project A"` is run
**Then** only recordings matching that project (case-insensitive) are shown
**And** if no match, prints `No recordings found for project "Project A".` and exits code 0

**Given** recordings exist across multiple dates
**When** `kayman list --from 2026-03-01 --to 2026-03-31` is run
**Then** only recordings within the inclusive date range are shown
**And** `--from` without `--to` shows all from that date onward; `--to` without `--from` shows up to that date

**Given** recordings exist with tags (Story 3.6)
**When** `kayman list --tag daily` is run
**Then** only recordings containing `"daily"` in their tags are shown
**And** multiple `--tag` flags use AND logic

**Given** no recordings exist
**When** `kayman list` is run
**Then** prints `No recordings found.` and exits code 0

**Given** a recording directory exists but has no `summary.json`
**When** `kayman list` is run
**Then** that directory is skipped silently

### Story 3.8: `kayman retry` — Re-export Failed Notion Exports

As a power user,
I want to retry a failed Notion export for a specific recording or the most recent failure,
So that a transient Notion outage does not permanently prevent my meeting from reaching Notion.

**Acceptance Criteria:**

**Given** a recording directory contains `summary.json` but no `.exported` marker file
**When** `kayman retry` is run with no arguments
**Then** it finds the most recent recording with `summary.json` but no `.exported` marker, loads the summary, and runs `runExport({ summary, config })`
**And** on success, writes `.exported` marker and prints `Export succeeded for "<title>".`
**And** a macOS notification fires: `"Done — entry created in Notion"`

**Given** multiple failed exports exist
**When** `kayman retry --path <recording-dir>` is run
**Then** it retries the export for that specific directory only
**And** if the path has no `summary.json`, prints error to stderr and exits code 1

**Given** no failed exports exist
**When** `kayman retry` is run
**Then** prints `No failed exports found.` and exits code 0

**Given** the Notion export fails again during retry
**When** the retry completes
**Then** error is printed to stderr, `.exported` is NOT written, exits code 1

**Given** `kayman retry --all` is run
**When** multiple failed exports exist
**Then** it retries each sequentially, continues on individual failures, and prints summary: `Retried N exports: X succeeded, Y failed.`

**Given** `kayman stop` completes the pipeline successfully
**When** export succeeds in the pipeline runner
**Then** a `.exported` marker file is written to the recording directory (required change in `runner.ts`)

### Story 3.9: `kayman verify` — Health Check / Setup Validation

As a new user,
I want to run a single command that validates my entire kayman setup,
So that I can fix configuration problems before my first real recording.

**Acceptance Criteria:**

**Given** `kayman verify` is run
**When** the command executes
**Then** it runs these checks in order, printing pass/fail per check:
1. Config file exists and parses without errors
2. Whisper binary exists at configured path and is executable
3. Whisper model file exists at configured path
4. AI provider credentials are valid (minimal test API call)
5. Notion token is valid and database is accessible (`databases.retrieve`)

**Given** all checks pass
**When** output is displayed
**Then** each check shows a pass indicator and prints `All checks passed. kayman is ready to use.` — exits code 0

**Given** one or more checks fail
**When** output is displayed
**Then** each failed check shows a fail indicator with an actionable fix instruction
**And** all checks still run even if an earlier one fails (no short-circuit)
**And** exits code 1

**Given** the config file is missing or malformed
**When** `kayman verify` is run
**Then** config check fails, remaining checks are skipped, prints `Fix config errors first, then re-run kayman verify.`

**Given** no network connectivity
**When** AI and Notion checks run
**Then** both fail with a network error message, not a credentials error

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

## Epic 5: Error Handling & CLI UX

Polished CLI experience with styled output, proactive error detection, graceful failure recovery, and per-project customization. Makes kayman feel like a professional tool, not a script.

### Story 5.1: CLI Output Styling & Branding

As a power user,
I want kayman CLI output to use colors, icons, and consistent formatting,
So that I can scan terminal output quickly and distinguish success, errors, and info at a glance.

**Acceptance Criteria:**

**Given** any kayman command produces output to a TTY
**When** output is displayed
**Then** success messages are green with a ✓ prefix (e.g., `✓ Recording started.`)
**And** error messages are red with a ✗ prefix (e.g., `✗ No active recording session.`)
**And** warning messages are yellow with a ⚠ prefix
**And** secondary text (durations, paths) is dim/gray
**And** `kayman status` active state uses a ⏺ prefix

**Given** output is piped or redirected (stdout not a TTY)
**When** output is produced
**Then** all ANSI codes and icon characters are stripped — plain ASCII text
**And** textual content is identical to the styled version

**Given** a styling library is needed
**When** implementation begins
**Then** `picocolors` is used (already in transitive deps, zero-dep, auto TTY detection)
**And** a shared `format` module in `@kayman/shared` exports: `success(msg)`, `error(msg)`, `warn(msg)`, `info(msg)`, `dim(msg)`

**Given** `kayman start` completes successfully
**When** output is displayed
**Then** reads: `✓ Recording started.` with project name in bold

**Given** `kayman stop` completes successfully
**When** output is displayed
**Then** reads: `✓ Recording stopped. Processing in background...`

**Given** a `PipelineError` or config error occurs
**When** error is printed to stderr
**Then** uses `✗` prefix, no raw stack trace shown

### Story 5.2: Audio Capture Failure Recovery

As a power user,
I want kayman to detect and handle `kayman-capture` crashes or mic disconnects during recording,
So that I do not lose an entire meeting to a mid-recording failure.

**Acceptance Criteria:**

**Given** `kayman-capture` crashes during recording
**When** `kayman status` is run
**Then** it detects the dead PID, clears the stale session, reports `Recording: inactive (capture process died unexpectedly)`
**And** a macOS notification fires: `Recording lost: capture process exited unexpectedly.`

**Given** `kayman-capture` crashes during recording
**When** `kayman stop` is run afterward
**Then** it detects the dead PID, clears session, prints: `Capture process is no longer running. Session cleared.`
**And** if partial `audio.caf` exists (size > 0), prints: `Partial audio file found at <path>. Run kayman retry to attempt processing.`

**Given** a partial `.caf` file from a crashed capture
**When** pipeline transcription runs on it
**Then** if whisper exits code 0, pipeline continues normally
**And** if whisper exits non-zero, throws `PipelineError` with: `Transcription failed: audio file may be corrupted or too short.`

**Given** `kayman start` spawns `kayman-capture`
**When** capture exits within the first 2 seconds (immediate crash)
**Then** `kayman start` detects the early exit, clears session, prints: `Capture failed to start: <exit code>. Check audio permissions in System Settings > Privacy & Security > Screen & System Audio Recording.` — exits code 1

**Given** mic is disconnected during recording (capture produces silence)
**When** pipeline processes the audio
**Then** summarizer handles empty/silence transcript, producing title `"Empty Recording"` and TL;DR stating no speech detected

### Story 5.3: Early Validation — Fail Fast on Missing Dependencies

As a power user,
I want `kayman start` to check whisper, AI provider, and Notion are reachable before recording begins,
So that I discover problems immediately, not minutes later when the pipeline fails.

**Acceptance Criteria:**

**Given** `kayman start` is run
**When** before spawning `kayman-capture`
**Then** it checks whisper binary exists and is executable, and whisper model file exists
**And** both checks complete in under 50ms (filesystem stat only)

**Given** whisper binary or model is missing
**When** pre-flight check runs
**Then** prints specific error to stderr and exits code 1 — no session written, no capture spawned

**Given** `kayman start` is run
**When** before spawning `kayman-capture`
**Then** makes a lightweight request to AI provider to verify API key (5s timeout — warns but proceeds if timeout)

**Given** AI API key is invalid
**When** pre-flight check runs
**Then** prints: `AI provider authentication failed. Check ai_api_key in config.yaml.` — exits code 1

**Given** `kayman start` is run
**When** before spawning `kayman-capture`
**Then** calls `notion.databases.retrieve(database_id)` to verify access (5s timeout — warns but proceeds if timeout)

**Given** Notion token or database ID is invalid
**When** pre-flight check runs
**Then** prints: `Notion access failed. Check notion_token and notion_database_id in config.yaml.` — exits code 1

**Given** `kayman start --skip-checks` is run
**When** command executes
**Then** all pre-flight validation is skipped, recording begins immediately (escape hatch for offline use)

**Given** `kayman memo` is run
**When** command executes
**Then** same pre-flight checks run as `kayman start`

### Story 5.4: Per-Project AI Prompt Templates

As a power user,
I want to configure custom AI summary prompts per project,
So that standup notes are formatted differently from client demo summaries.

**Acceptance Criteria:**

**Given** a project in `config.yaml` has a `prompt_template` field
**When** summarization runs for that project
**Then** the custom template is used instead of the default prompt in `buildPrompt()`
**And** the transcript is appended after the template
**And** AI still returns the standard structured output (`title`, `tldr`, `keyPoints`, `fullSummary`)

**Given** a project has no `prompt_template` field
**When** summarization runs
**Then** the default prompt is used unchanged

**Given** a memo recording (no project)
**When** summarization runs
**Then** the default prompt is used

**Given** `prompt_template` is configured
**When** config is loaded
**Then** `Config.projects` type includes `promptTemplate?: string`

**Given** `prompt_template` is an empty string
**When** summarization runs
**Then** the default prompt is used (empty treated as unset)

**Given** `prompt_template` omits the transcript section
**When** summarization runs
**Then** system auto-appends `\nTranscript:\n<transcript>` after the template

### Story 5.5: `kayman help` — Interactive Command Guide

As a new or infrequent user,
I want a friendly help command that explains all available commands with examples,
So that I can understand what kayman can do without reading docs.

**Acceptance Criteria:**

**Given** `kayman help` is run with no arguments
**When** the command executes
**Then** it prints a grouped overview of all commands organized by workflow:
- **Recording**: `start`, `stop`, `status`, `memo`
- **Results**: `last`, `list`, `retry`
- **Setup**: `config`, `verify`, `models`, `offline`, `online`
- **Help**: `help`
**And** each command shows a one-line description
**And** output uses the styling from Story 5.1 (colors, icons) when in a TTY

**Given** `kayman help start` is run
**When** the command executes
**Then** it prints detailed help for the `start` command including:
- Description of what it does
- Usage: `kayman start [project] [--tags tag1 tag2] [--skip-checks]`
- All flags with descriptions
- 2-3 real examples (e.g., `kayman start "Daily Standup" --tags daily`, `kayman start` for interactive picker)

**Given** `kayman help` is run
**When** output is displayed
**Then** it shows a "Quick Start" section at the top for first-time users:
```
Quick Start:
  1. kayman verify        — check your setup
  2. kayman start         — pick a project and record
  3. kayman stop          — stop and process
  4. kayman last          — see the summary
```

**Given** `kayman help <invalid-command>` is run
**When** the command executes
**Then** it prints: `Unknown command: "<invalid-command>". Run kayman help for all commands.` and exits code 0

**Given** `kayman` is run with no arguments and no subcommand
**When** the command executes
**Then** it shows the same output as `kayman help` (not an error)

**Given** `kayman --help` (the standard flag) is run
**When** commander processes the flag
**Then** it delegates to the same `kayman help` output instead of the default commander help format

## Epic 6: Local-First Mode & CLI Config

Full local inference pipeline via Ollama — no API calls except Notion. Quick `offline`/`online` mode switching. General-purpose `kayman config` command for editing settings from the terminal. Local model management for whisper.

### Story 6.1: Ollama Provider Support

As a privacy-conscious user,
I want to use Ollama for local AI summarization,
So that my meeting transcripts never leave my machine.

**Acceptance Criteria:**

**Given** `config.yaml` has `ai_provider: ollama` and `ai_model: llama3.2`
**When** summarization runs
**Then** it uses `@ai-sdk/ollama` to call the local Ollama server
**And** the `generateText()` call and Zod structured output schema work identically to cloud providers
**And** the `Summary` object has the same shape (`title`, `tldr`, `keyPoints`, `fullSummary`)

**Given** `ai_provider: ollama` is configured
**When** config is loaded
**Then** `ai_api_key` is NOT required (optional for Ollama)
**And** an optional `ai_base_url` field defaults to `http://localhost:11434` if not set

**Given** Ollama is not running locally
**When** summarization runs
**Then** it throws `PipelineError(Summarizing, "Ollama not reachable at http://localhost:11434. Start Ollama or switch to an API provider with: kayman online")` 

**Given** the configured Ollama model is not downloaded
**When** summarization runs
**Then** it throws `PipelineError(Summarizing, "Model 'llama3.2' not found in Ollama. Run: ollama pull llama3.2")`

**Given** `provider.ts` handles the new provider
**When** `createProviderModel(config)` is called with `aiProvider: 'ollama'`
**Then** it returns a valid `LanguageModel` via `createOllama({ baseURL })(aiModel)`
**And** `SUPPORTED_PROVIDERS` is updated to include `'ollama'`

### Story 6.2: Local Whisper Model Management

As a new user,
I want to manage whisper models from the CLI,
So that I don't have to manually find, download, and place model files.

**Acceptance Criteria:**

**Given** `kayman models list` is run
**When** the command executes
**Then** it shows all available whisper model sizes (tiny, base, small, medium, large) with their disk size and whether each is downloaded locally
**And** the currently configured model is highlighted

**Given** `kayman models download medium` is run
**When** the command executes
**Then** it downloads the whisper model to `~/.cache/whisper/` with a progress indicator
**And** on completion prints the path and sets `whisper_model_path` in config to point to it

**Given** `kayman models download` is run with an invalid model name
**When** the command executes
**Then** it prints available model names and exits code 1

**Given** a model is already downloaded
**When** `kayman models download base` is run
**Then** it prints `Model "base" already downloaded at <path>.` and exits code 0

**Given** `kayman models remove large` is run
**When** the command executes
**Then** it deletes the model file and prints confirmation
**And** if the deleted model was the configured one, prints a warning: `Warning: active model removed. Run kayman models download <size> to get a new one.`

### Story 6.3: Offline-Ready Pipeline

As a power user,
I want the pipeline to work fully offline when using Ollama,
So that I can record and summarize meetings without any internet connection (except for Notion export).

**Acceptance Criteria:**

**Given** `ai_provider: ollama` is configured
**When** `kayman start` runs pre-flight checks (Story 5.3)
**Then** it checks that Ollama is running locally instead of making network API calls
**And** it skips the Notion reachability check (export will retry later via `kayman retry`)

**Given** the pipeline runs with `ai_provider: ollama` and no internet
**When** transcription and summarization complete
**Then** both stages succeed fully offline
**And** the Notion export stage fails with a network error, preserves `summary.json`, and notifies: `Export failed: no network. Run kayman retry when back online.`

**Given** `ai_provider: ollama` and Notion export fails due to no network
**When** the user regains internet and runs `kayman retry`
**Then** the export succeeds and the `.exported` marker is written

**Given** the pipeline runs offline
**When** `last-summary.json` is written
**Then** `kayman last` works fully offline (reads local file only)

### Story 6.4: Ollama Auto-Pull

As a new user,
I want kayman to automatically pull the Ollama model if it's not downloaded yet,
So that setup is frictionless — just set the model name and go.

**Acceptance Criteria:**

**Given** `ai_provider: ollama` and `ai_model: llama3.2` are configured but the model is not pulled in Ollama
**When** `kayman verify` runs
**Then** it detects the missing model and prompts: `Model "llama3.2" not found. Pull it now? [Y/n]`
**And** on confirmation, runs `ollama pull llama3.2` with progress output
**And** on completion, the verify check passes

**Given** `kayman start` runs and the Ollama model is not pulled
**When** pre-flight checks run
**Then** it prints: `Ollama model "llama3.2" not available. Run: kayman verify to set up.` and exits code 1
**And** does NOT auto-pull during `start` (to avoid blocking before a meeting)

**Given** `kayman verify` auto-pull is declined by the user
**When** the user answers `n`
**Then** the check is marked as failed with: `Model not pulled. Run manually: ollama pull llama3.2`

**Given** Ollama is not installed at all
**When** `kayman verify` runs
**Then** it prints: `Ollama not found. Install from https://ollama.com and try again.`

### Story 6.5: `kayman config` — CLI Config Editor

As a power user,
I want to view and change kayman settings from the terminal,
So that I don't have to manually edit YAML files.

**Acceptance Criteria:**

**Given** `kayman config list` is run
**When** the command executes
**Then** it prints all current config values in a readable key-value format
**And** sensitive values (`ai_api_key`, `notion_token`) are masked (e.g., `sk-...abc123`)

**Given** `kayman config get ai_provider` is run
**When** the command executes
**Then** it prints the current value of that field

**Given** `kayman config set ai_provider ollama` is run
**When** the command executes
**Then** it updates `~/.config/kayman/config.yaml` with the new value
**And** validates the value (e.g., `ai_provider` must be one of the supported providers)
**And** prints confirmation: `ai_provider set to "ollama"`

**Given** `kayman config set ai_provider invalid_provider` is run
**When** the command executes
**Then** it prints: `Invalid value for ai_provider. Supported: openai, anthropic, google, ollama` and exits code 1
**And** the config file is NOT modified

**Given** `kayman config set user_name "Szymon"` is run
**When** the command executes
**Then** it updates `user_name` in the YAML file preserving all other fields and comments

**Given** `kayman config set nonexistent_field value` is run
**When** the command executes
**Then** it prints: `Unknown config field: nonexistent_field` and exits code 1

**Given** `kayman config path` is run
**When** the command executes
**Then** it prints the full path to the config file: `~/.config/kayman/config.yaml`

### Story 6.6: `kayman offline` / `kayman online` — Quick Mode Toggle

As a power user,
I want to quickly switch between local and cloud AI with a single command,
So that I can go offline before a flight or switch back when I have connectivity.

**Acceptance Criteria:**

**Given** `kayman online` is run
**When** the command executes
**Then** it checks if `ai_provider` is already a cloud provider (openai/anthropic/google)
**And** if already online, prints: `Already in online mode (provider: openai).`

**Given** `kayman online` is run while `ai_provider: ollama`
**When** the command executes
**Then** it restores the previous cloud provider settings from a saved `.online-config` snapshot at `~/.config/kayman/.online-config`
**And** if no snapshot exists, prompts the user to pick a provider and enter API key via interactive prompts
**And** prints: `Switched to online mode (provider: openai, model: gpt-4o-mini).`

**Given** `kayman offline` is run
**When** the command executes
**Then** it saves the current cloud provider settings (`ai_provider`, `ai_model`, `ai_api_key`) to `~/.config/kayman/.online-config`
**And** sets `ai_provider: ollama` and `ai_model` to a default local model (e.g., `llama3.2`)
**And** prints: `Switched to offline mode (provider: ollama, model: llama3.2). Your API settings are saved — run kayman online to restore.`

**Given** `kayman offline` is run while already in offline mode
**When** the command executes
**Then** prints: `Already in offline mode (provider: ollama, model: llama3.2).`

**Given** `kayman offline --model mistral` is run
**When** the command executes
**Then** it sets `ai_model: mistral` instead of the default

**Given** the user has never configured a cloud provider
**When** `kayman online` is run and no `.online-config` snapshot exists
**Then** it prompts interactively: provider selection → model name → API key
**And** saves and applies the new settings
