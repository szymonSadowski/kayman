# Story 6.4: Ollama Auto-Pull

Status: review

## Story

As a new user,
I want kayman to automatically pull the Ollama model if it's not downloaded yet,
So that setup is frictionless — just set the model name and go.

## Acceptance Criteria

1. **Given** `ai_provider: ollama` and `ai_model: llama3.2` are configured but the model is not pulled in Ollama
   **When** `kayman verify` runs
   **Then** it detects the missing model and prompts: `Model "llama3.2" not found. Pull it now? [Y/n]`
   **And** on confirmation, runs `ollama pull llama3.2` with progress output
   **And** on completion, the verify check passes

2. **Given** `kayman start` runs and the Ollama model is not pulled
   **When** pre-flight checks run
   **Then** it prints: `Ollama model "llama3.2" not available. Run: kayman verify to set up.` and exits code 1
   **And** does NOT auto-pull during `start` (to avoid blocking before a meeting)

3. **Given** `kayman verify` auto-pull is declined by the user
   **When** the user answers `n`
   **Then** the check is marked as failed with: `Model not pulled. Run manually: ollama pull llama3.2`

4. **Given** Ollama is not installed at all
   **When** `kayman verify` runs
   **Then** it prints: `Ollama not found. Install from https://ollama.com and try again.`

## Tasks / Subtasks

- [x] Task 1: Add `checkOllamaModel()` to `verify.ts` (AC: 1, 3, 4)
  - [x] Only run this check when `config.aiProvider === 'ollama'`
  - [x] Replace/augment the existing `checkAiProvider()` for Ollama path in `verify.ts`
  - [x] Step 1: Check Ollama is reachable via `fetch(baseURL + '/api/tags')` — if fails, return `{ pass: false, message: 'Ollama not found. Install from https://ollama.com and try again.' }`
  - [x] Step 2: Parse response JSON to get list of pulled models — each model has a `name` field like `"llama3.2:latest"`
  - [x] Step 3: Check if `config.aiModel` (or `config.aiModel + ':latest'`) is in the list
  - [x] Step 4: If missing — print prompt and call `@inquirer/confirm` (already used in other commands) for `Y/n`
  - [x] Step 5: On `Y` — spawn `ollama pull <model>` with `stdio: 'inherit'` so progress streams to terminal; wait for completion
  - [x] Step 6: On `n` — return `{ pass: false, message: 'Model not pulled. Run manually: ollama pull <model>' }`
  - [x] Re-run the model check after pull to confirm success

- [x] Task 2: Update `preflight.ts` — model-not-available fast-fail for Ollama (AC: 2)
  - [x] In the Ollama branch of step 3 (after confirming Ollama is reachable), also check if model is pulled
  - [x] Call `GET /api/tags` and check model list (same logic as verify.ts — extract to shared helper or inline)
  - [x] If model not in list: `process.stderr.write(error('Ollama model "X" not available. Run: kayman verify to set up.') + '\n')` then `process.exit(1)`
  - [x] Do NOT prompt — preflight must be non-interactive

- [x] Task 3: Write tests (AC: 1–4)
  - [x] `packages/cli/src/commands/verify.test.ts`: Ollama model present → pass; model missing + Y → pull + pass; model missing + n → fail; Ollama unreachable → "not found" message
  - [x] `packages/cli/src/commands/preflight.test.ts`: Ollama model missing → exits 1 with guidance message

## Dev Notes

### Ollama `/api/tags` response shape

```json
{
  "models": [
    { "name": "llama3.2:latest", "model": "llama3.2:latest", "size": 2019393189, ... },
    { "name": "mistral:latest", ... }
  ]
}
```

Model name matching: `config.aiModel` may be `"llama3.2"` while Ollama lists it as `"llama3.2:latest"`. Normalize by appending `:latest` if no `:` in model name, then compare.

### `ollama pull` subprocess

```typescript
import { spawnSync } from 'child_process'
const result = spawnSync('ollama', ['pull', modelName], { stdio: 'inherit' })
if (result.status !== 0) {
  return { pass: false, message: `ollama pull failed for model "${modelName}"` }
}
```

Use `spawnSync` (blocking) since `verify.ts` is already structured as async sequential checks. The `stdio: 'inherit'` passes Ollama's progress output directly to terminal.

### Ollama not installed detection

If `fetch(baseURL + '/api/tags')` throws `ECONNREFUSED` — Ollama is installed but not running. If `ollama` binary is not found (check via `which ollama` or catch `ENOENT` from `spawnSync`) — Ollama is not installed. Distinguish these two cases for better error messages:
- ECONNREFUSED → "Ollama not running. Start it with: ollama serve"
- ENOENT / unreachable → "Ollama not found. Install from https://ollama.com and try again."

Actually the epics AC says the "not found" message applies when Ollama is not installed at all. Reachability failures (ECONNREFUSED) are handled by Story 6.1. Keep consistent with 6.1 behavior.

### `verify.ts` existing `checkAiProvider` for Ollama

Currently `checkAiProvider()` in `verify.ts` calls `createProviderModel(config)` then `generateText()` — this works for cloud providers. For Ollama it will make a real network call to localhost. After Story 6.1, preflight already has a proper Ollama reachability check. The verify command's `checkAiProvider` should also be branched:

```typescript
async function checkAiProvider(config: Config): Promise<CheckResult> {
  if (config.aiProvider === 'ollama') {
    return checkOllamaModel(config)  // new function
  }
  // existing cloud check...
}
```

This avoids calling `generateText()` for Ollama in verify, which would fail if the model isn't pulled yet.

### `@inquirer/confirm` usage

`@inquirer/select` is already used in `start.ts`. Use `@inquirer/confirm` for the Y/n prompt — it's from the same family and should already be available or easily added:
```typescript
const { default: confirm } = await import('@inquirer/confirm')
const shouldPull = await confirm({ message: `Model "${model}" not found. Pull it now?`, default: true })
```

### Project Structure Notes

**New files:**
- None

**Modified files:**
- `packages/cli/src/commands/verify.ts` — new `checkOllamaModel()` function, branch in `checkAiProvider()`
- `packages/cli/src/commands/preflight.ts` — model availability check in Ollama branch

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.4] — full ACs
- [Source: packages/cli/src/commands/verify.ts] — existing check structure, `checkAiProvider()` to modify
- [Source: packages/cli/src/commands/preflight.ts] — Ollama branch (from Story 6.1) to extend
- [Source: packages/cli/src/commands/start.ts] — @inquirer/select usage pattern for dynamic import
- [Source: packages/cli/src/pipeline/preflight.ts:29-41] — existing Ollama reachability check (fetch /api/tags)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation was straightforward, no debugging required.

### Completion Notes List

- Added `@inquirer/confirm` dep to `packages/cli/package.json`
- Added `checkOllamaModel()` in `verify.ts`: fetches `/api/tags`, normalizes model name (appends `:latest` if needed), prompts via `@inquirer/confirm`, spawns `ollama pull` with `stdio: 'inherit'`, re-checks after pull
- Branched `checkAiProvider()` in `verify.ts` to route ollama configs to `checkOllamaModel()`
- Extended Ollama branch in `preflight.ts` to parse `/api/tags` JSON and exit 1 with guidance if model not in list (non-interactive)
- Added 4 Ollama-specific tests to `verify.test.ts` (model present, Y pull, n decline, not reachable)
- Added 2 Ollama model tests to `preflight.test.ts` (model missing exits 1, model available passes)
- All 170 tests pass, typecheck clean

### File List

- `packages/cli/package.json`
- `pnpm-lock.yaml`
- `packages/cli/src/commands/verify.ts`
- `packages/cli/src/commands/preflight.ts`
- `packages/cli/src/commands/verify.test.ts`
- `packages/cli/src/commands/preflight.test.ts`
