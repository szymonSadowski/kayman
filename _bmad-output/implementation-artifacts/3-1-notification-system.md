# Story 3.1: Notification System

Status: done

## Story

As a power user,
I want macOS notifications to fire at each pipeline stage with consistent messaging,
so that I know the pipeline is progressing without watching a terminal.

## Acceptance Criteria

1. `notify(PipelineStage.Transcribing)` fires a macOS notification: `"Transcribing..."`
2. `notifyError(PipelineStage.Summarizing, err, transcriptPath)` fires: `"Summarizing failed: [error message]. Transcript saved to [path]."`
3. `notify(PipelineStage.Done)` fires: `"Done — entry created in Notion"`
4. All notification helpers exported from `@kayman/shared/notify.ts` — `node-notifier` never called directly elsewhere

## Tasks / Subtasks

- [x] Task 1: Implement `notify(stage)` helper (AC: 1, 3)
  - [x] Define STAGE_MESSAGES map for all PipelineStage values
  - [x] Wrap node-notifier with consistent title "kayman"
- [x] Task 2: Implement `notifyError(stage, err, transcriptPath?)` helper (AC: 2)
  - [x] Include transcript path in message when provided
- [x] Task 3: Export from `@kayman/shared/index.ts` (AC: 4)

## Dev Notes

Implementation already exists at `packages/shared/src/notify.ts`.
No code changes required — story documents existing implementation.

### References

- [Source: packages/shared/src/notify.ts]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — pre-existing implementation verified.

### Completion Notes List

- notify.ts implemented as part of repo initialization, verified complete.
- All PipelineStage values covered in STAGE_MESSAGES map.
- notifyError includes optional transcriptPath for failure messages.

### File List

- packages/shared/src/notify.ts (pre-existing)
- packages/shared/src/index.ts (re-exports notify)

### Change Log

- 2026-04-03: Story file created retroactively — implementation already complete.
