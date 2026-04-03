# Story 3.5: Pipeline Runner & `kayman stop` Integration

Status: review

## Story

As a power user,
I want `kayman stop` to hand off to a fully detached background pipeline that transcribes, summarizes, and exports — with notifications throughout and transcript preservation on any failure,
so that I never need to babysit the pipeline and silent failures are impossible.

## Acceptance Criteria

1. `kayman stop` spawns `pipeline/runner.ts` detached (`detached: true`, `child.unref()`), CLI exits within 1 second (NFR3), and user receives a `"Transcribing..."` notification shortly after
2. Pipeline executes in sequence: Transcribing → Summarizing → Exporting → Done notifications fire
3. On success: `LAST_SUMMARY_PATH` pointer file written; `audio.caf` and `transcript.txt` deleted
4. On any pipeline stage failure: failure notification fires with stage + error message (FR13); `transcript.txt` preserved; runner exits non-zero (FR11)
5. Runner receives positional args: `node runner.js <audioPath> <project|""> <transcriptSaveDir>`

## Tasks / Subtasks

- [x] Task 1: Implement pipeline runner in `packages/cli/src/pipeline/runner.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Parse positional args: `process.argv[2]` = audioPath, `[3]` = project (empty string = null), `[4]` = transcriptSaveDir
  - [x] Call `loadConfig()` from `@kayman/shared`
  - [x] `notify(PipelineStage.Transcribing)` → `runTranscribe(...)` → transcriptPath
  - [x] `notify(PipelineStage.Summarizing)` → `runSummarize(...)` → Summary object
  - [x] `notify(PipelineStage.Exporting)` → `runExport(...)` → Notion page ID
  - [x] `notify(PipelineStage.Done)` → write `LAST_SUMMARY_PATH` pointer → delete audio.caf + transcript.txt
  - [x] Wrap all in try/catch: PipelineError → notifyError(err.stage, ...) → exit(1)
  - [x] Unknown error → notifyError(PipelineStage.Transcribing, ...) → exit(1)
- [x] Task 2: Update `packages/cli/src/commands/stop.ts` to spawn runner detached (AC: 1)
  - [x] Resolve pipelineRunnerPath via path.resolve(__dirname, '../pipeline/runner.js')
  - [x] transcriptSaveDir = path.dirname(session.audioPath)
  - [x] spawn(process.execPath, [runner, audioPath, project ?? '', transcriptSaveDir], { detached: true, stdio: 'ignore' })
  - [x] child.unref()
  - [x] Print "Recording stopped. Processing in background..."
- [x] Task 3: Update stop.test.ts to verify runner spawn args (AC: 1)
  - [x] Test: spawns runner with correct args including audioPath, project, transcriptSaveDir
  - [x] Test: memo mode passes empty string for project
  - [x] Test: no session → error (existing)
- [ ] Task 4: Integration smoke test (skipped — requires real whisper + API keys)

## Dev Notes

### Runner Entry Point

```typescript
#!/usr/bin/env node
// Positional args: <audioPath> <project|""> <transcriptSaveDir>
const [,, audioPath, projectArg, transcriptSaveDir] = process.argv
const project = projectArg === '' ? null : projectArg
```

### Stop Command Spawn Pattern (from architecture)

```typescript
import { spawn } from 'child_process'
import path from 'path'

const pipelineRunnerPath = path.resolve(__dirname, '../pipeline/runner.js')
const transcriptSaveDir = path.dirname(session.audioPath) // same recording dir

const child = spawn(
  process.execPath,
  [pipelineRunnerPath, session.audioPath, session.project ?? '', transcriptSaveDir],
  { detached: true, stdio: 'ignore' }
)
child.unref()
```

### LAST_SUMMARY_PATH Pointer

```typescript
import { LAST_SUMMARY_PATH } from '@kayman/shared'
import fs from 'fs'
import path from 'path'

// Write pointer file on success
const summaryPath = path.join(transcriptSaveDir, 'summary.json')
fs.mkdirSync(path.dirname(LAST_SUMMARY_PATH), { recursive: true })
fs.writeFileSync(LAST_SUMMARY_PATH, JSON.stringify({ summaryPath }), 'utf8')
```

### Cleanup on Success

```typescript
fs.unlinkSync(audioPath)           // delete audio.caf
fs.unlinkSync(transcriptPath)      // delete transcript.txt
// summary.json preserved at summaryPath (referenced by LAST_SUMMARY_PATH)
```

### Error Handling in Runner

```typescript
try {
  // ... pipeline stages
} catch (err) {
  if (err instanceof PipelineError) {
    notifyError(err.stage, err, transcriptPath)
  } else {
    notifyError(PipelineStage.Transcribing, err as Error)
  }
  process.exit(1)
}
```

### tsup Dual Entry

`packages/cli/tsup.config.ts` already builds both `src/index.ts` and `src/pipeline/runner.ts` as separate entries — no change needed.

### Build Path

Runner compiles to `packages/cli/dist/pipeline/runner.js` — this is the path to reference in stop.ts with `__dirname`.

### Previous Story Dependencies

- Story 3.2: `runTranscribe` must be complete
- Story 3.3: `runSummarize` must be complete
- Story 3.4: `runExport` must be complete

### Project Structure Notes

- Modify: `packages/cli/src/pipeline/runner.ts` (replace stub)
- Modify: `packages/cli/src/commands/stop.ts` (spawn runner instead of stub message)
- Modify: `packages/cli/src/commands/stop.test.ts` (update spawn assertions)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment] — detached spawn pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns] — positional args format
- [Source: _bmad-output/planning-artifacts/architecture.md#Gap-Analysis-Results] — LAST_SUMMARY_PATH pointer
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.5]
- [Source: packages/shared/src/paths.ts] — LAST_SUMMARY_PATH
- [Source: packages/shared/src/notify.ts] — notify, notifyError
- [Source: packages/cli/src/commands/stop.ts] — current stop implementation

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- runner.ts orchestrates transcribe→summarize→export with notifications at each stage
- On success: writes LAST_SUMMARY_PATH pointer, deletes audio.caf + transcript.txt
- On PipelineError: notifyError with stage; on unknown error: uses Transcribing stage
- stop.ts updated to spawn runner detached (detached: true, stdio: 'ignore', child.unref())
- transcriptSaveDir derived from path.dirname(session.audioPath)
- stop.test.ts updated to verify spawn args and memo mode (project → empty string)

### File List

- packages/cli/src/pipeline/runner.ts (updated from stub)
- packages/cli/src/commands/stop.ts (updated to spawn runner)
- packages/cli/src/commands/stop.test.ts (updated tests)

### Change Log

- 2026-04-03: Implemented. 41 total tests passing, typecheck clean, lint clean.
