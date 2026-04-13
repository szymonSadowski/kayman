# Story 6.3: Offline-Ready Pipeline

Status: done

## Story

As a power user,
I want the pipeline to work fully offline when using Ollama,
So that I can record and summarize meetings without any internet connection (except for Notion export).

## Acceptance Criteria

1. **Given** `ai_provider: ollama` is configured
   **When** `kayman start` runs pre-flight checks (Story 5.3)
   **Then** it checks that Ollama is running locally instead of making network API calls
   **And** it skips the Notion reachability check (export will retry later via `kayman retry`)

2. **Given** the pipeline runs with `ai_provider: ollama` and no internet
   **When** transcription and summarization complete
   **Then** both stages succeed fully offline
   **And** the Notion export stage fails with a network error, preserves `summary.json`, and notifies: `Export failed: no network. Run kayman retry when back online.`

3. **Given** `ai_provider: ollama` and Notion export fails due to no network
   **When** the user regains internet and runs `kayman retry`
   **Then** the export succeeds and the `.exported` marker is written

4. **Given** the pipeline runs offline
   **When** `last-summary.json` is written
   **Then** `kayman last` works fully offline (reads local file only)

## Tasks / Subtasks

- [x] Task 1: Update `preflight.ts` — skip Notion check for Ollama (AC: 1)
  - [x] In `runPreflightChecks()`, wrap step 4 (Notion check) in `if (config.aiProvider !== 'ollama')`
  - [x] The Ollama reachability check (step 3) was already added in Story 6.1 — no change needed there
  - [x] No new config fields required

- [x] Task 2: Update `runner.ts` — graceful export failure for Ollama (AC: 2, 4)
  - [x] In `runner.ts`, after `runSummarize()` succeeds, write `summary.json` to `transcriptSaveDir` BEFORE calling `runExport()`
  - [x] Currently `summary.json` is only written as part of `last-summary.json` pointer after export succeeds — move the `summary.json` write earlier
  - [x] Wrap `runExport()` in a try/catch that checks if `config.aiProvider === 'ollama'`
  - [x] On network error in Ollama mode: call `notifyError` with a custom message, write `.export-failed` marker (so `kayman retry` can find it), and exit 0 (not 1 — pipeline "succeeded" locally)
  - [x] Still write `LAST_SUMMARY_PATH` pointer even when export is skipped/failed
  - [x] The `.export-failed` marker approach: `kayman retry` already scans for dirs WITHOUT `.exported` marker — verify this works with the existing `retry.ts` logic

- [x] Task 3: Verify `kayman retry` works for offline-deferred exports (AC: 3)
  - [x] Read `packages/cli/src/commands/retry.ts` to confirm it finds recordings without `.exported`
  - [x] If `retry.ts` already works by scanning for missing `.exported` markers, no code change needed — just add a test
  - [x] If any Ollama-specific handling is needed (e.g., config validation before retry), add it

- [x] Task 4: Verify `kayman last` works offline (AC: 4)
  - [x] Read `packages/cli/src/commands/last.ts` to confirm it only reads `LAST_SUMMARY_PATH` (local file)
  - [x] If it makes any network calls, remove them — it should be purely local
  - [x] If already purely local (likely), just add a comment and test

- [x] Task 5: Write tests (AC: 1–4)
  - [x] `packages/cli/src/commands/preflight.test.ts`: Ollama mode skips Notion check
  - [x] `packages/cli/src/pipeline/runner.test.ts`: export network failure in Ollama mode → notify + write markers + exit 0
  - [x] `packages/cli/src/commands/retry.test.ts`: offline-deferred recording gets exported on retry
  - [x] `packages/cli/src/commands/last.test.ts`: reads local file only (no network)

## Dev Notes

### Current preflight flow (Story 6.1 state)

```
preflight.ts:
  1. Whisper binary check (sync)
  2. Whisper model check (sync, only if path configured)
  3. AI provider check:
     - if ollama → fetch /api/tags with 3s timeout
     - else → generateText('Reply with OK') with 5s timeout
  4. Notion check (always runs currently)
```

Change: wrap step 4 in `if (config.aiProvider !== 'ollama')`. Simple one-liner.

### runner.ts summary.json write order

Current flow in `runner.ts`:
1. runTranscribe → transcriptPath
2. runSummarize → summary
3. runExport → writes to Notion
4. write `.exported` marker
5. write LAST_SUMMARY_PATH (pointer to summary.json)
6. cleanup audio + transcript

The `summary.json` file isn't explicitly written by runner — only the pointer is. Actually `runSummarize()` in `summarize.ts` should be checked — it likely writes `summary.json` to `recordingDir`. Let me note: verify whether `summary.json` is already written by `runSummarize()` before export. If it is, AC 2 (preserves summary.json) may already be satisfied by the existing code.

### Ollama export failure handling

When `ai_provider: ollama` and network is absent, `runExport()` will throw a `PipelineError(Exporting, ...)` with a network-related message. Intercept this:

```typescript
// In runner.ts catch block or via special try/catch around runExport:
if (config.aiProvider === 'ollama' && isNetworkError(err)) {
  notifyError(PipelineStage.Exporting, new Error('Export failed: no network. Run kayman retry when back online.'), transcriptPath)
  // Still write last-summary pointer
  fs.mkdirSync(path.dirname(LAST_SUMMARY_PATH), { recursive: true })
  const summaryPath = path.join(transcriptSaveDir, 'summary.json')
  fs.writeFileSync(LAST_SUMMARY_PATH, JSON.stringify({ summaryPath }), 'utf8')
  process.exit(0) // Pipeline succeeded locally
}
```

Network error detection: check for `ENOTFOUND`, `ECONNREFUSED`, `fetch failed`, `network` in error message.

### `kayman retry` compatibility

`retry.ts` likely works by scanning recording dirs for the absence of `.exported` marker and presence of `summary.json`. The offline-failed recordings will have `summary.json` but no `.exported` — exactly the pattern `retry` handles. Verify this assumption by reading `retry.ts` before implementing.

### `kayman last` is already offline-safe

`last.ts` reads `LAST_SUMMARY_PATH` which points to a local `summary.json`. No network calls. Just ensure `LAST_SUMMARY_PATH` is written before any early exit in the runner.

### Project Structure Notes

**New files:**
- None expected

**Modified files:**
- `packages/cli/src/commands/preflight.ts` — skip Notion check for Ollama (1-line change)
- `packages/cli/src/pipeline/runner.ts` — graceful export failure + early LAST_SUMMARY_PATH write

**Unchanged (verify and document):**
- `packages/cli/src/commands/retry.ts` — should already work
- `packages/cli/src/commands/last.ts` — already offline-safe

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.3] — full ACs
- [Source: packages/cli/src/commands/preflight.ts] — step 4 Notion check to conditionally skip
- [Source: packages/cli/src/pipeline/runner.ts] — pipeline flow, error handling, marker writes
- [Source: packages/cli/src/pipeline/export.ts] — error types thrown by runExport
- [Source: packages/cli/src/commands/retry.ts] — verify existing retry scan logic
- [Source: packages/cli/src/commands/last.ts] — verify offline safety

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `summary.json` confirmed already written by `runSummarize()` before export — AC 2 pre-satisfied
- `retry.ts` confirmed already scans for `summary.json` without `.exported` — no code change needed
- `last.ts` confirmed purely local (reads `LAST_SUMMARY_PATH`) — no code change needed

### Completion Notes List

- Wrapped step 4 Notion check in `if (config.aiProvider !== 'ollama')` in `preflight.ts`
- Added `isNetworkError()` helper to `runner.ts`; wrapped `runExport()` in Ollama-aware try/catch that writes `.export-failed`, writes `LAST_SUMMARY_PATH`, calls `notifyError`, exits 0
- `LAST_SUMMARY_PATH` now written before early exit so `kayman last` works offline
- Verified `retry.ts` and `last.ts` required no code changes
- Added 4 new tests across preflight, runner, retry, last — 164 tests pass total

### File List

- `packages/cli/src/commands/preflight.ts`
- `packages/cli/src/pipeline/runner.ts`
- `packages/cli/src/commands/preflight.test.ts`
- `packages/cli/src/pipeline/runner.test.ts`
- `packages/cli/src/commands/retry.test.ts`
- `packages/cli/src/commands/last.test.ts`

## Change Log

- 2026-04-13: Implemented Story 6.3 — offline-ready pipeline for Ollama mode
- 2026-04-13: Code review (AI) — 3 medium issues fixed:
  - Removed `.export-failed` dead code from runner.ts (never read by retry.ts)
  - Removed `'network'` substring from `isNetworkError()` — too broad, replaced with specific tokens only
  - Fixed runner.test.ts Ollama network failure test to mock `PipelineError` (matching production export.ts behavior) instead of plain Error
