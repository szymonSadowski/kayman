# Story 3.2: Transcription Stage

Status: review

## Story

As a power user,
I want my recorded audio transcribed locally via whisper.cpp after a session ends,
so that my audio never leaves my machine (NFR5).

## Acceptance Criteria

1. `runTranscribe({ audioPath, transcriptDir, config })` spawns whisper, waits for completion, and returns the path to `transcript.txt`
2. Stage follows `runStage(input) → output | throws PipelineError` interface
3. If whisper binary not found: throws `PipelineError(PipelineStage.Transcribing, "whisper binary not found at ...")`
4. If whisper model file missing: throws `PipelineError(PipelineStage.Transcribing, "whisper model not found at ...")`
5. Non-zero whisper exit: throws `PipelineError(PipelineStage.Transcribing, "whisper exited with code ...")`

## Tasks / Subtasks

- [x] Task 1: Implement `runTranscribe` in `packages/cli/src/pipeline/transcribe.ts` (AC: 1, 2)
  - [x] Check `config.whisperBinaryPath` (or default path) existence with `fs.existsSync` — throw PipelineError if missing (AC: 3)
  - [x] Check `config.whisperModelPath` (or default path) existence — throw PipelineError if missing (AC: 4)
  - [x] Spawn whisper: `spawn(binary, ['--model', modelPath, '--output-txt', '--output-dir', transcriptDir, audioPath])`
  - [x] Wait for close event; non-zero exit code → throw PipelineError (AC: 5)
  - [x] Derive transcript filename: whisper outputs `<audio-basename>.txt`; return resolved path
- [x] Task 2: Write tests in `packages/cli/src/pipeline/transcribe.test.ts`
  - [x] Mock `child_process.spawn` (use vitest `vi.mock`)
  - [x] Test: binary missing → PipelineError with correct message (AC: 3)
  - [x] Test: model missing → PipelineError (AC: 4)
  - [x] Test: spawn exits non-zero → PipelineError (AC: 5)
  - [x] Test: happy path → returns transcript path (AC: 1)

## Dev Notes

### Whisper Invocation Pattern

Per architecture spec:
```typescript
spawn('whisper', ['--model', modelPath, '--output-txt', audioPath], { stdio: 'pipe' })
```

Whisper CLI names output file by stripping extension from input and appending `.txt`.
Example: `audio.caf` → `audio.txt` in `--output-dir`.

### Config Fields

- `config.whisperBinaryPath`: optional; default to a sensible path (e.g. `/usr/local/bin/whisper`)
- `config.whisperModelPath`: optional; default to `~/.cache/whisper/ggml-base.en.bin`

Both defined in `Config` interface at `packages/shared/src/types.ts`.

### PipelineError Usage

```typescript
throw new PipelineError(PipelineStage.Transcribing, 'whisper binary not found at /usr/local/bin/whisper')
// message becomes: "transcribing failed: whisper binary not found at ..."
```

Import from `@kayman/shared`.

### No New Dependencies

Uses Node.js built-in `child_process.spawn` — no new packages needed.

### Testing Pattern

Follow existing test patterns in `packages/shared/src/*.test.ts` — co-located, vitest, no snapshots.

### Project Structure Notes

- New file: `packages/cli/src/pipeline/transcribe.ts`
- New file: `packages/cli/src/pipeline/transcribe.test.ts`
- No changes to `@kayman/shared`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API-&-Communication-Patterns]
- [Source: _bmad-output/planning-artifacts/architecture.md#Infrastructure-&-Deployment]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.2]
- [Source: packages/shared/src/types.ts] — PipelineError, PipelineStage, Config

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- runTranscribe implemented with binary/model existence checks, spawn with close event handling
- Default paths: /usr/local/bin/whisper, ~/.cache/whisper/ggml-base.en.bin
- Transcript path derived by stripping audio extension and appending .txt
- 6 tests: binary missing, model missing, non-zero exit, happy path, default paths, PipelineError stage check

### File List

- packages/cli/src/pipeline/transcribe.ts (new)
- packages/cli/src/pipeline/transcribe.test.ts (new)

### Change Log

- 2026-04-03: Implemented and tested. 41 total tests passing.
