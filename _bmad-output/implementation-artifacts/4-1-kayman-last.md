# Story 4.1: `kayman last` — Terminal Summary Access

Status: review

## Story

As a power user,
I want to run `kayman last` in the terminal and see the most recent meeting TL;DR,
so that I can get meeting context without opening Notion (FR20).

## Acceptance Criteria

1. **Given** a completed pipeline has written `~/.local/share/kayman/last-summary.json`
   **When** `kayman last` is run in the terminal
   **Then** it reads the pointer file, loads `summary.json`, and prints the TL;DR to stdout within 1 second (NFR4)
   **And** output includes the meeting title and project name for context.
2. **Given** no pipeline has completed yet (no `last-summary.json` exists)
   **When** `kayman last` is run
   **Then** it prints `"No meeting summaries yet. Run kayman stop after your next meeting."` and exits with code 0.
3. **Given** the pointer file exists but the referenced `summary.json` is missing or malformed
   **When** `kayman last` is run
   **Then** it prints a clear error to stderr and exits non-zero (FR31).

## Tasks / Subtasks

- [x] Task 1: Implement `lastCommand` in `packages/cli/src/commands/last.ts` (AC: 1, 2, 3)
  - [x] Read `LAST_SUMMARY_PATH` from `@kayman/shared`
  - [x] If file does not exist (`ENOENT`) → print empty-state message, exit 0
  - [x] Parse pointer JSON: `{ summaryPath: string }`
  - [x] Read `summary.json` at `summaryPath`, parse as `Summary`
  - [x] Format and print: title, project (or `memo`), then TL;DR — see "Output Format" below
  - [x] On read/parse error of either file → write error to stderr, `process.exit(1)`
- [x] Task 2: Add tests in `packages/cli/src/commands/last.test.ts` (AC: 1, 2, 3)
  - [x] Happy path: pointer + summary present → stdout contains title, project, tldr
  - [x] Empty state: no pointer file → empty-state message, no throw
  - [x] Pointer present but `summary.json` missing → stderr message + non-zero exit
  - [x] Memo case: `summary.project === null` → renders as `memo`
  - [x] Use `tmp` dir for `LAST_SUMMARY_PATH`/`DATA_DIR` overrides via mocking `@kayman/shared` paths (mirror `list.test.ts` / `retry.test.ts` patterns)
- [x] Task 3: Verify CLI registration unchanged in `packages/cli/src/index.ts` (already wired by Story 3.5)

## Dev Notes

### Pointer File Contract

Written by the pipeline runner on success (Story 3.5):

```json
{ "summaryPath": "/Users/.../recordings/2026-04-08-kayman/summary.json" }
```

`LAST_SUMMARY_PATH` is `~/.local/share/kayman/last-summary.json` — see `packages/shared/src/paths.ts:7`.

### Summary Type

```typescript
// packages/shared/src/types.ts
export interface Summary {
  title: string
  tldr: string
  keyPoints: string[]
  fullSummary: string
  project: string | null
  recordedAt: string
  transcriptPath: string
}
```

Only `title`, `project`, and `tldr` are needed for `kayman last`. Do **not** load/print keyPoints or fullSummary — that's Notion's job.

### Output Format

Terminal output should be compact and scannable. Suggested:

```
<title>  (<project|memo>)

<tldr>
```

Example:

```
Roadmap planning Q2  (kayman)

We aligned on shipping Epic 4 next sprint and parking the local-first work until Epic 5 lands. Owners: Szymon for Raycast, decisions captured in Notion.
```

Plain text, no ANSI styling for now — Story 5.1 adds CLI styling globally.

### Implementation Skeleton

```typescript
import fs from 'fs'
import { LAST_SUMMARY_PATH } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

export async function lastCommand(_config: Config): Promise<void> {
  let pointerRaw: string
  try {
    pointerRaw = fs.readFileSync(LAST_SUMMARY_PATH, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      process.stdout.write('No meeting summaries yet. Run kayman stop after your next meeting.\n')
      return
    }
    throw err
  }

  let summaryPath: string
  try {
    summaryPath = (JSON.parse(pointerRaw) as { summaryPath: string }).summaryPath
  } catch {
    process.stderr.write(`kayman last: malformed pointer file at ${LAST_SUMMARY_PATH}\n`)
    process.exit(1)
  }

  let summary: Summary
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Summary
  } catch {
    process.stderr.write(`kayman last: summary not found or unreadable at ${summaryPath}\n`)
    process.exit(1)
  }

  const project = summary.project ?? 'memo'
  process.stdout.write(`${summary.title}  (${project})\n\n${summary.tldr}\n`)
}
```

### Why This Story Matters

- Unlocks Story 4.3 (Raycast `last.tsx` calls `kayman last` via execa)
- Closes the loop on FR20 — terminal users get summaries without leaving the shell
- NFR4 (sub-1s) is trivially met: two `readFileSync` calls of small JSON

### Project Structure Notes

- Modify: `packages/cli/src/commands/last.ts` (replace stub from Story 3.5 wiring)
- Add: `packages/cli/src/commands/last.test.ts` (new file)
- No changes to `packages/shared/` — `LAST_SUMMARY_PATH` and `Summary` already exported

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements-to-Structure-Mapping] — FR19/20 → `commands/last.ts`
- [Source: packages/shared/src/paths.ts:7] — `LAST_SUMMARY_PATH`
- [Source: packages/shared/src/types.ts:40] — `Summary` interface
- [Source: packages/cli/src/pipeline/runner.ts] — writes the pointer (Story 3.5)
- [Source: packages/cli/src/commands/list.test.ts] — test pattern for command tests
- [Source: _bmad-output/implementation-artifacts/3-5-pipeline-runner.md#LAST_SUMMARY_PATH-Pointer]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation followed story spec on first pass; all 90 CLI tests + 33 shared tests pass.

### Completion Notes List

- Replaced `last.ts` stub with full implementation per story spec.
- Pointer file `ENOENT` → empty-state message on stdout, exit 0 (AC2).
- Malformed pointer JSON, missing `summaryPath` field, missing/malformed `summary.json` → error to stderr, `process.exit(1)` (AC3).
- Output format `<title>  (<project|memo>)\n\n<tldr>\n` plain text, no ANSI (AC1).
- Only `title`, `project`, `tldr` are printed — `keyPoints`/`fullSummary` intentionally omitted (test asserts this).
- Added 7 tests in `last.test.ts` covering happy path, scope (no kp/fullSummary leak), empty state, missing summary, malformed summary, malformed pointer, memo project.
- Test mock pattern: `vi.hoisted` to create tmp dir + `testLastSummaryPath`, then `vi.mock('@kayman/shared')` to return only `LAST_SUMMARY_PATH` (mirrors list.test.ts).
- CLI registration in `index.ts` was already wired by Story 3.5 — no changes needed.
- Typecheck (`tsc --noEmit`) and lint (`eslint`) pass clean.

### Change Log

- 2026-04-08: Implemented Story 4.1 — `kayman last` reads pointer + summary and prints TL;DR; added 7 tests.

### File List

- Modified: `packages/cli/src/commands/last.ts` (replaced Story 3.5 stub with full implementation)
- Added: `packages/cli/src/commands/last.test.ts` (new file, 7 tests)
