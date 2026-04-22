# Story 5.2: Audio Capture Failure Recovery

Status: review

## Story

As a power user,
I want kayman to detect and handle `kayman-capture` crashes or mic disconnects during recording,
so that I do not lose an entire meeting to a mid-recording failure.

## Acceptance Criteria

1. **Given** `kayman-capture` crashes during recording
   **When** `kayman status` is run
   **Then** it detects the dead PID, clears the stale session, reports `Recording: inactive (capture process died unexpectedly)`
   **And** a macOS notification fires: `Recording lost: capture process exited unexpectedly.`

2. **Given** `kayman-capture` crashes during recording
   **When** `kayman stop` is run afterward
   **Then** it detects the dead PID, clears session, prints: `Capture process is no longer running. Session cleared.`
   **And** if partial `audio.caf` exists (size > 0), prints: `Partial audio file found at <path>. Run kayman retry to attempt processing.`

3. **Given** a partial `.caf` file from a crashed capture
   **When** pipeline transcription runs on it
   **Then** if whisper exits code 0, pipeline continues normally
   **And** if whisper exits non-zero, throws `PipelineError` with: `Transcription failed: audio file may be corrupted or too short.`

4. **Given** `kayman start` spawns `kayman-capture`
   **When** capture exits within the first 2 seconds (immediate crash)
   **Then** `kayman start` detects the early exit, clears session, prints: `Capture failed to start: <exit code>. Check audio permissions in System Settings > Privacy & Security > Screen & System Audio Recording.` — exits code 1

5. **Given** mic is disconnected during recording (capture produces silence)
   **When** pipeline processes the audio
   **Then** summarizer handles empty/silence transcript, producing title `"Empty Recording"` and TL;DR stating no speech detected

## Tasks / Subtasks

- [x] Task 1: Add `readSessionFile()` to `packages/shared/src/session.ts` and export it (AC: 1, 2)
  - [x] Implement `readSessionFile(): Session | null` — reads and validates `session.json` WITHOUT checking PID liveness (returns raw session or null if missing/invalid)
  - [x] Export `readSessionFile` from `packages/shared/src/index.ts` (already re-exports from session via `export * from './session'` — no index change needed if exported from session.ts)
  - [x] Add unit tests in `packages/shared/src/session.test.ts` (or co-located test file): `readSessionFile` returns session when file exists even if PID is dead

- [x] Task 2: Add `notifyCustom(message: string)` to `packages/shared/src/notify.ts` (AC: 1)
  - [x] Implement `notifyCustom(message: string): void` — calls `notifier.notify({ title: 'kayman', message })` directly
  - [x] Export from `packages/shared/src/notify.ts` (exported via `index.ts` already)
  - [x] Add unit test: `notifyCustom('foo')` calls notifier with correct title and message

- [x] Task 3: Update `packages/cli/src/commands/status.ts` for dead-PID detection (AC: 1)
  - [x] Replace `readSession()` call with `readSessionFile()` + manual `isProcessAlive()` check
  - [x] If `readSessionFile()` returns non-null and `!isProcessAlive(session.pid)`:
    - `clearSession()`
    - `notifyCustom('Recording lost: capture process exited unexpectedly.')`
    - print `format.warn('Recording: inactive (capture process died unexpectedly)')` to stdout
    - return (do not fall through to active-session path)
  - [x] If `readSessionFile()` returns null: existing "Recording: inactive" behavior unchanged
  - [x] If `readSessionFile()` returns non-null and PID alive: existing active-session display unchanged
  - [x] Update status.test.ts: add test for dead-PID scenario

- [x] Task 4: Update `packages/cli/src/commands/stop.ts` for dead-PID detection (AC: 2)
  - [x] Replace `readSession()` call with `readSessionFile()` + manual `isProcessAlive()` check
  - [x] If `readSessionFile()` returns non-null and `!isProcessAlive(session.pid)`:
    - `clearSession()`
    - print `format.warn('Capture process is no longer running. Session cleared.')` to stdout
    - check `fs.existsSync(session.audioPath)` and `fs.statSync(session.audioPath).size > 0`
    - if partial audio: print `format.info(`Partial audio file found at ${session.audioPath}. Run kayman retry to attempt processing.`)` to stdout
    - return (do not proceed to pipeline spawn)
  - [x] If `readSessionFile()` returns null: existing "No active recording session" error unchanged
  - [x] Update stop.test.ts: add tests for dead-PID scenario (with and without partial audio)

- [x] Task 5: Update `packages/cli/src/commands/start.ts` for early-crash detection (AC: 4)
  - [x] After `spawn()`, do NOT call `child.unref()` immediately
  - [x] Instead: `await new Promise(resolve => setTimeout(resolve, 2000))`
  - [x] Check `isProcessAlive(child.pid!)` after the 2s wait
  - [x] If dead (early crash):
    - `clearSession()` if session was written (or avoid writing session until after liveness check)
    - print `format.error(`Capture failed to start: ${child.exitCode ?? 'unknown'}. Check audio permissions in System Settings > Privacy & Security > Screen & System Audio Recording.`)` to stderr
    - `process.exit(1)`
  - [x] If alive: call `child.unref()`, proceed as normal (write session + print success)
  - [x] **IMPORTANT**: write `writeSession()` AFTER the liveness check (not before), so no stale session is left on early crash
  - [x] Update start.test.ts: add test for early-crash scenario

- [x] Task 6: Update `packages/cli/src/pipeline/transcribe.ts` for partial-audio error message (AC: 3)
  - [x] When whisper exits non-zero, change error message from `whisper exited with code ${code}` to `Transcription failed: audio file may be corrupted or too short.`
  - [x] Keep `PipelineStage.Transcribing` as the stage for the `PipelineError`
  - [x] Update transcribe.test.ts: assert new error message on non-zero whisper exit

- [x] Task 7: Update `packages/cli/src/pipeline/summarize.ts` for silence handling (AC: 5)
  - [x] After reading transcript file, check if transcript is empty or whitespace-only (`.trim() === ''`)
  - [x] If empty: return early with hardcoded Summary
  - [x] Write this summary to `summary.json` at the normal path before returning
  - [x] Do NOT call AI API for empty transcripts (save API call + avoid nonsensical AI output)
  - [x] Update summarize.test.ts: add test for empty transcript → hardcoded "Empty Recording" summary

## Dev Notes

### Key Insight: `readSession()` vs `readSessionFile()`

**Current `readSession()` behavior** (`packages/shared/src/session.ts:37`): silently deletes session.json and returns `null` when PID is dead. This means `status.ts` and `stop.ts` currently cannot distinguish "session never existed" from "capture died unexpectedly."

**Solution**: add `readSessionFile(): Session | null` that skips the `isProcessAlive()` check. Status and stop commands call `readSessionFile()` + `isProcessAlive()` manually to distinguish the two cases.

```typescript
// packages/shared/src/session.ts — new function
export function readSessionFile(): Session | null {
  let raw: string
  try {
    raw = fs.readFileSync(SESSION_PATH, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!isValidSession(parsed)) return null
  return parsed
}
```

`isValidSession` and `isProcessAlive` are already defined in `session.ts` — `readSessionFile` uses only `isValidSession`.

### Pattern for status.ts dead-PID detection

```typescript
// packages/cli/src/commands/status.ts
import { readSessionFile, isProcessAlive, clearSession, notifyCustom, ... } from '@kayman/shared'

const raw = readSessionFile()
if (raw && !isProcessAlive(raw.pid)) {
  clearSession()
  notifyCustom('Recording lost: capture process exited unexpectedly.')
  process.stdout.write(format.warn('Recording: inactive (capture process died unexpectedly)') + '\n')
  return
}
const session = raw  // PID alive or null
```

### Pattern for stop.ts dead-PID detection

```typescript
// packages/cli/src/commands/stop.ts
import { readSessionFile, isProcessAlive, clearSession, ... } from '@kayman/shared'

const raw = readSessionFile()
if (!raw) {
  process.stderr.write(format.error('No active recording session.') + '\n')
  process.exit(1)
}
if (!isProcessAlive(raw.pid)) {
  clearSession()
  process.stdout.write(format.warn('Capture process is no longer running. Session cleared.') + '\n')
  if (fs.existsSync(raw.audioPath)) {
    const stat = fs.statSync(raw.audioPath)
    if (stat.size > 0) {
      process.stdout.write(format.info(`Partial audio file found at ${raw.audioPath}. Run kayman retry to attempt processing.`) + '\n')
    }
  }
  return
}
// existing stop logic: process.kill(raw.pid, 'SIGTERM'), clearSession(), spawn pipeline...
```

### Pattern for start.ts 2s liveness check

```typescript
// packages/cli/src/commands/start.ts — after spawn()
const child = spawn(CAPTURE_BIN, ['--source', config.audioSource, '--output', audioPath], {
  detached: true,
  stdio: 'ignore',
})
// Wait 2s BEFORE unref and writeSession
await new Promise(resolve => setTimeout(resolve, 2000))
if (!isProcessAlive(child.pid!)) {
  process.stderr.write(format.error(`Capture failed to start: ${child.exitCode ?? 'unknown'}. Check audio permissions in System Settings > Privacy & Security > Screen & System Audio Recording.`) + '\n')
  process.exit(1)
}
child.unref()
writeSession({ pid: child.pid!, audioPath, project: resolvedProject, startedAt: new Date().toISOString(), tags })
process.stdout.write(format.success(`Recording started. ${bold(resolvedProject)}`) + '\n')
```

**Note**: This adds a 2s delay to `kayman start` for all invocations. This is acceptable per the story spec and still satisfies NFR2 (sub-2s) is NOT a constraint here since the story explicitly requires this detection.

### notifyCustom placement

`notifyCustom` is called from `status.ts` (CLI command), not from the pipeline. Architecture doc says to use `notify()` helpers from `@kayman/shared`. Since `notifyCustom` takes a plain string it's a general-purpose escape hatch for messages that don't fit the `PipelineStage` enum model.

### transcribe.ts error message

Current code at `packages/cli/src/pipeline/transcribe.ts:47`:
```typescript
reject(new PipelineError(PipelineStage.Transcribing, `whisper exited with code ${code}`))
```
Change to:
```typescript
reject(new PipelineError(PipelineStage.Transcribing, 'Transcription failed: audio file may be corrupted or too short.'))
```

### summarize.ts empty transcript detection

```typescript
// packages/cli/src/pipeline/summarize.ts — after reading transcript
const transcript = fs.readFileSync(transcriptPath, 'utf8')
if (!transcript.trim()) {
  const summary: Summary = {
    title: 'Empty Recording',
    tldr: 'No speech detected in this recording.',
    keyPoints: [],
    fullSummary: 'No speech was detected in this recording. The audio may have been silent or the microphone was disconnected.',
    project,
    recordedAt: new Date().toISOString(),
    transcriptPath,
  }
  const summaryPath = path.join(recordingDir, 'summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
  return summary
}
// ... rest of existing summarize logic
```

### What NOT to change

- `readSession()` — keep existing behavior unchanged; used by Raycast and other paths that already handle null correctly
- `pipeline/runner.ts` — no changes; failure propagation is already handled
- `notify.ts` — only ADDING `notifyCustom`; do not change `notify()` or `notifyError()`
- `completion.ts` — untouched
- Raycast commands — untouched

### Testing Standards

- Use Vitest; co-locate test files with source files
- For `status.ts` / `stop.ts` tests: mock `readSessionFile`, `isProcessAlive`, `clearSession`, `notifyCustom`, `format.*` — do NOT mock `readSession` (that's a different function)
- For `start.ts` early-crash test: mock `spawn` to return a process that dies (exitCode set), mock `isProcessAlive` to return false after delay
- `vi.useFakeTimers()` + `vi.runAllTimersAsync()` can help avoid 2s real wait in start.test.ts
- For `summarize.ts` empty-transcript: mock `fs.readFileSync` to return `''` or `'   '`

### Project Structure Notes

**Modified files:**
- `packages/shared/src/session.ts` — add `readSessionFile()`
- `packages/shared/src/notify.ts` — add `notifyCustom()`
- `packages/cli/src/commands/status.ts` — dead-PID detection
- `packages/cli/src/commands/stop.ts` — dead-PID detection + partial audio check
- `packages/cli/src/commands/start.ts` — 2s early-crash detection
- `packages/cli/src/pipeline/transcribe.ts` — updated error message
- `packages/cli/src/pipeline/summarize.ts` — empty transcript handling

**New/updated test files:**
- `packages/shared/src/session.test.ts` — add `readSessionFile` tests
- `packages/shared/src/notify.test.ts` — add `notifyCustom` test (create if not exists)
- `packages/cli/src/commands/status.test.ts` — add dead-PID test
- `packages/cli/src/commands/stop.test.ts` — add dead-PID + partial audio tests
- `packages/cli/src/commands/start.test.ts` — add early-crash test
- `packages/cli/src/pipeline/transcribe.test.ts` — update error message assertion
- `packages/cli/src/pipeline/summarize.test.ts` — add empty transcript test

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.2] — full ACs
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture] — session.json format, stale state detection strategy
- [Source: _bmad-output/planning-artifacts/architecture.md#Error-Propagation-Standard] — PipelineError usage
- [Source: packages/shared/src/session.ts] — `isProcessAlive`, `isValidSession`, `readSession`, `clearSession` — patterns to follow
- [Source: packages/shared/src/notify.ts] — existing `notify`/`notifyError` — `notifyCustom` follows same pattern
- [Source: packages/cli/src/commands/start.ts] — current spawn pattern to modify
- [Source: packages/cli/src/commands/stop.ts] — current stop pattern to extend
- [Source: packages/cli/src/commands/status.ts] — current status pattern to extend
- [Source: packages/cli/src/pipeline/transcribe.ts:47] — line to update for error message
- [Source: packages/cli/src/pipeline/summarize.ts:45] — insertion point for empty transcript check

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward per Dev Notes patterns.

### Completion Notes List

- Added `readSessionFile()` to `session.ts` — skips PID liveness check, allows status/stop to distinguish dead PID from no session
- Added `notifyCustom()` to `notify.ts` — plain-string escape hatch for non-pipeline notifications
- Updated `status.ts` — uses `readSessionFile()` + `isProcessAlive()` to detect dead PID, clears session and fires macOS notification
- Updated `stop.ts` — uses `readSessionFile()` + `isProcessAlive()` to detect dead PID, checks partial audio, prints hint to retry
- Updated `start.ts` — 2s liveness check after spawn, writes session only after PID confirmed alive
- Updated `transcribe.ts` — improved error message for non-zero whisper exit
- Updated `summarize.ts` — short-circuits on empty/whitespace transcript, returns hardcoded "Empty Recording" summary without calling AI
- All 7 tasks complete; 36 new/updated test assertions pass; 0 regressions introduced

### File List

- `packages/shared/src/session.ts` — added `readSessionFile()`
- `packages/shared/src/notify.ts` — added `notifyCustom()`
- `packages/cli/src/commands/status.ts` — dead-PID detection
- `packages/cli/src/commands/stop.ts` — dead-PID detection + partial audio check
- `packages/cli/src/commands/start.ts` — 2s early-crash detection
- `packages/cli/src/pipeline/transcribe.ts` — updated error message
- `packages/cli/src/pipeline/summarize.ts` — empty transcript handling
- `packages/shared/src/session.test.ts` — `readSessionFile` tests
- `packages/shared/src/notify.test.ts` — new file, `notifyCustom` test
- `packages/cli/src/commands/status.test.ts` — dead-PID test
- `packages/cli/src/commands/stop.test.ts` — dead-PID + partial audio tests
- `packages/cli/src/commands/start.test.ts` — early-crash test
- `packages/cli/src/pipeline/transcribe.test.ts` — updated error message assertion
- `packages/cli/src/pipeline/summarize.test.ts` — empty transcript tests

## Change Log

- 2026-04-09: Story created
- 2026-04-10: Implementation complete — all 7 tasks done, status set to review
