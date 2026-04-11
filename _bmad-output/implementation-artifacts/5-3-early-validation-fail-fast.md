# Story 5.3: Early Validation — Fail Fast on Missing Dependencies

Status: done

## Story

As a power user,
I want `kayman start` to check whisper, AI provider, and Notion are reachable before recording begins,
so that I discover problems immediately, not minutes later when the pipeline fails.

## Acceptance Criteria

1. **Given** `kayman start` is run
   **When** before spawning `kayman-capture`
   **Then** it checks whisper binary exists and is executable, and whisper model file exists
   **And** both checks complete in under 50ms (filesystem stat only)

2. **Given** whisper binary or model is missing
   **When** pre-flight check runs
   **Then** prints specific error to stderr and exits code 1 — no session written, no capture spawned

3. **Given** `kayman start` is run
   **When** before spawning `kayman-capture`
   **Then** makes a lightweight request to AI provider to verify API key (5s timeout — warns but proceeds if timeout)

4. **Given** AI API key is invalid
   **When** pre-flight check runs
   **Then** prints: `AI provider authentication failed. Check ai_api_key in config.yaml.` — exits code 1

5. **Given** `kayman start` is run
   **When** before spawning `kayman-capture`
   **Then** calls `notion.databases.retrieve(database_id)` to verify access (5s timeout — warns but proceeds if timeout)

6. **Given** Notion token or database ID is invalid
   **When** pre-flight check runs
   **Then** prints: `Notion access failed. Check notion_token and notion_database_id in config.yaml.` — exits code 1

7. **Given** `kayman start --skip-checks` is run
   **When** command executes
   **Then** all pre-flight validation is skipped, recording begins immediately (escape hatch for offline use)

8. **Given** `kayman memo` is run
   **When** command executes
   **Then** same pre-flight checks run as `kayman start`

## Tasks / Subtasks

- [x] Task 1: Create `packages/cli/src/commands/preflight.ts` with `runPreflightChecks()` (AC: 1, 2, 3, 4, 5, 6)
  - [x] Implement `async function runPreflightChecks(config: Config): Promise<void>`
  - [x] Whisper binary check (sync): `fs.accessSync(binaryPath, fs.constants.X_OK)` — on failure: `format.error(...)` to stderr + `process.exit(1)`
  - [x] Whisper model check (sync, only if `config.whisperModelPath` is set): `fs.accessSync(modelPath, fs.constants.R_OK)` — on failure: `format.error(...)` to stderr + `process.exit(1)`
  - [x] AI provider check (async, 5s AbortController timeout): reuse pattern from `verify.ts:checkAiProvider` — on timeout: `format.warn('AI provider check timed out — proceeding anyway.')` to stdout; on auth error: `format.error('AI provider authentication failed. Check ai_api_key in config.yaml.')` to stderr + `process.exit(1)`
  - [x] Notion check (async, 5s AbortController timeout): reuse pattern from `verify.ts:checkNotion` — on timeout: `format.warn('Notion check timed out — proceeding anyway.')` to stdout; on auth error: `format.error('Notion access failed. Check notion_token and notion_database_id in config.yaml.')` to stderr + `process.exit(1)`
  - [x] Write `packages/cli/src/commands/preflight.test.ts` with tests for all 4 check scenarios

- [x] Task 2: Add `--skip-checks` flag to `start` command in `packages/cli/src/index.ts` (AC: 7)
  - [x] Add `.option('--skip-checks', 'Skip pre-flight dependency checks')` to the `start` command
  - [x] Pass `skipChecks: boolean` to `startCommand()` call
  - [x] Add `.option('--skip-checks', 'Skip pre-flight dependency checks')` to the `memo` command
  - [x] Pass `skipChecks: boolean` to `memoCommand()` call

- [x] Task 3: Update `packages/cli/src/commands/start.ts` to run pre-flight (AC: 1–7)
  - [x] Add `skipChecks: boolean = false` parameter to `startCommand(project, config, tags, skipChecks)`
  - [x] At the top of `startCommand`, before any existing logic: `if (!skipChecks) await runPreflightChecks(config)`
  - [x] Pre-flight runs BEFORE session check, project picker, audio dir creation, and capture spawn
  - [x] Update start.test.ts: verify preflight is called when `skipChecks=false`, skipped when `true`

- [x] Task 4: Update `packages/cli/src/commands/memo.ts` to run pre-flight (AC: 8)
  - [x] Add `skipChecks: boolean = false` parameter to `memoCommand(config, skipChecks)`
  - [x] At the top of `memoCommand`: `if (!skipChecks) await runPreflightChecks(config)`
  - [x] Pre-flight runs BEFORE session check, audio dir creation, and capture spawn
  - [x] Update memo.test.ts: verify preflight is called when `skipChecks=false`, skipped when `true`

- [x] Task 5: Run full test suite and validate no regressions

## Dev Notes

### Key Insight: Reuse `verify.ts` check patterns, don't refactor `verify.ts`

`packages/cli/src/commands/verify.ts` already has working implementations of all 4 checks: `checkWhisperBinary`, `checkWhisperModel`, `checkAiProvider`, `checkNotion`. **Do NOT refactor verify.ts** — it returns `CheckResult` objects for display, while `preflight.ts` has different failure modes (exit vs warn+proceed). Copy the logic patterns, not the code.

**Critical difference — `verify.ts` vs `preflight.ts`:**
- `verify.ts`: runs all checks, reports results, never exits (user reviews output)
- `preflight.ts`: on hard failure → `process.exit(1)`; on network timeout → `warn + proceed`

### `preflight.ts` implementation

```typescript
// packages/cli/src/commands/preflight.ts
import fs from 'fs'
import { Client } from '@notionhq/client'
import { generateText } from 'ai'
import { warn, error } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { createProviderModel } from '../pipeline/provider.js'

export async function runPreflightChecks(config: Config): Promise<void> {
  // 1. Whisper binary (sync filesystem check, < 50ms)
  const binaryPath = config.whisperBinaryPath ?? '/usr/local/bin/whisper'
  try {
    fs.accessSync(binaryPath, fs.constants.X_OK)
  } catch {
    process.stderr.write(error(`Whisper binary not found or not executable at ${binaryPath}. Install whisper.cpp.`) + '\n')
    process.exit(1)
  }

  // 2. Whisper model (sync filesystem check — only if explicit path configured)
  if (config.whisperModelPath) {
    try {
      fs.accessSync(config.whisperModelPath, fs.constants.R_OK)
    } catch {
      process.stderr.write(error(`Whisper model not found at ${config.whisperModelPath}. Download the model or update whisper_model_path in config.yaml.`) + '\n')
      process.exit(1)
    }
  }

  // 3. AI provider (async, 5s timeout)
  try {
    const model = createProviderModel(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      await generateText({ model, prompt: 'Reply with OK', maxOutputTokens: 1, abortSignal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('abort') || msg.toLowerCase().includes('timeout')) {
      process.stdout.write(warn('AI provider check timed out — proceeding anyway.') + '\n')
    } else {
      process.stderr.write(error('AI provider authentication failed. Check ai_api_key in config.yaml.') + '\n')
      process.exit(1)
    }
  }

  // 4. Notion (async, 5s timeout)
  try {
    const notion = new Client({ auth: config.notionToken })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      await notion.databases.retrieve({ database_id: config.notionDatabaseId })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND') || msg.includes('abort')) {
      process.stdout.write(warn('Notion check timed out — proceeding anyway.') + '\n')
    } else {
      process.stderr.write(error('Notion access failed. Check notion_token and notion_database_id in config.yaml.') + '\n')
      process.exit(1)
    }
  }
}
```

### Integration point in `start.ts`

Pre-flight call goes BEFORE any other logic in `startCommand`:

```typescript
export async function startCommand(
  project: string | undefined,
  config: Config,
  tags: string[] = [],
  skipChecks = false,      // new param
): Promise<void> {
  if (!skipChecks) await runPreflightChecks(config)  // NEW — first line
  
  const existing = readSession()  // existing logic follows unchanged
  ...
}
```

Same pattern for `memoCommand(config, skipChecks = false)`.

### `index.ts` changes

```typescript
// start command — add --skip-checks option
program
  .command('start [project]')
  .description('Start a recording session')
  .option('--tags <tags...>', 'Tags for the recording session')
  .option('--skip-checks', 'Skip pre-flight dependency checks')   // NEW
  .action(async (project: string | undefined, opts: { tags?: string[]; skipChecks?: boolean }) => {
    await startCommand(project, config, opts.tags ?? [], opts.skipChecks ?? false)
  })

// memo command — add --skip-checks option
program
  .command('memo')
  .description('Start a memo recording (no project picker)')
  .option('--skip-checks', 'Skip pre-flight dependency checks')   // NEW
  .action(async (opts: { skipChecks?: boolean }) => {
    await memoCommand(config, opts.skipChecks ?? false)
  })
```

### Testing `preflight.ts`

Mock the filesystem calls (`vi.spyOn(fs, 'accessSync')`), `generateText`, and Notion `Client.prototype.databases.retrieve`. Test scenarios:
- Whisper binary missing → `process.exit(1)` called with error message
- Whisper model missing (when `config.whisperModelPath` set) → exit 1
- AI check: auth error → exit 1 with correct message
- AI check: AbortError (timeout) → `warn` to stdout, continues
- Notion: auth error → exit 1 with correct message  
- Notion: network error → `warn` to stdout, continues
- All checks pass → no exit, no warnings

Use `vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit') })` to test exit calls without actually exiting.

### Ordering: Story 5.3 builds on 5.2

Story 5.2 adds a 2s early-crash detection in `start.ts`. The call order in `startCommand` after both stories are implemented:
1. `if (!skipChecks) await runPreflightChecks(config)` — Story 5.3
2. Existing session check (`readSession`)
3. Project picker
4. Spawn kayman-capture
5. 2s liveness check — Story 5.2
6. `child.unref()` + `writeSession()` + success message

If Story 5.2 is not yet merged, implement without the 2s liveness check — just add preflight to the current `start.ts` code.

### What NOT to change

- `verify.ts` — do NOT refactor; it has its own check implementations; leave as-is
- Pipeline files (`runner.ts`, `transcribe.ts`, etc.) — untouched
- `stop.ts`, `status.ts` — untouched in this story
- `completion.ts` — untouched

### Project Structure Notes

**New files:**
- `packages/cli/src/commands/preflight.ts`
- `packages/cli/src/commands/preflight.test.ts`

**Modified files:**
- `packages/cli/src/index.ts` — add `--skip-checks` to start and memo commands
- `packages/cli/src/commands/start.ts` — add `skipChecks` param + preflight call
- `packages/cli/src/commands/memo.ts` — add `skipChecks` param + preflight call
- `packages/cli/src/commands/start.test.ts` — add preflight integration tests
- `packages/cli/src/commands/memo.test.ts` — add preflight integration tests (create if not exists)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.3] — full ACs
- [Source: packages/cli/src/commands/verify.ts] — `checkWhisperBinary`, `checkWhisperModel`, `checkAiProvider`, `checkNotion` — patterns to replicate in preflight.ts
- [Source: packages/cli/src/index.ts:34-38] — `start` command registration to extend with `--skip-checks`
- [Source: packages/cli/src/index.ts:56-59] — `memo` command registration to extend
- [Source: packages/cli/src/commands/start.ts:9] — `startCommand` signature to extend
- [Source: packages/cli/src/commands/memo.ts:9] — `memoCommand` signature to extend
- [Source: packages/cli/src/pipeline/provider.ts] — `createProviderModel(config)` — used in AI check
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] — Notion `@notionhq/client`, AI Vercel SDK patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Existing `start.test.ts` tests for `memoCommand` needed `preflight.js` mocked; added `vi.mock('./preflight.js')` and `runPreflightChecksMock.mockResolvedValue(undefined)` in `beforeEach`.

### Completion Notes List

- Created `preflight.ts` with `runPreflightChecks()`: sync whisper binary/model checks + async AI/Notion checks with 5s timeouts; hard failures exit 1, network timeouts warn+proceed.
- Code review fixes: Notion timeout now uses `Client({ timeoutMs: 5000 })` (AbortController was created but signal never passed to retrieve — timeout was non-functional); AI abort detection checks `err.name === 'AbortError'` instead of fragile message-string match; tests updated to use correct error types.
- Added `--skip-checks` option to `start` and `memo` commands in `index.ts`.
- Updated `startCommand` and `memoCommand` signatures with `skipChecks = false`; preflight runs first.
- All 9 preflight scenarios covered in `preflight.test.ts`; added 4 integration tests in `start.test.ts`.
- 122 tests pass, 0 regressions.

### File List

- `packages/cli/src/commands/preflight.ts` (new)
- `packages/cli/src/commands/preflight.test.ts` (new)
- `packages/cli/src/index.ts` (modified)
- `packages/cli/src/commands/start.ts` (modified)
- `packages/cli/src/commands/memo.ts` (modified)
- `packages/cli/src/commands/start.test.ts` (modified)

## Change Log

- 2026-04-09: Story created
- 2026-04-10: Implemented — preflight checks, --skip-checks flag, 122 tests passing
- 2026-04-10: Code reviewed — fixed Notion timeout (H1), AI AbortError detection (L1), updated tests
