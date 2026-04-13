# Story 6.2: Local Whisper Model Management

Status: done

## Story

As a new user,
I want to manage whisper models from the CLI,
So that I don't have to manually find, download, and place model files.

## Acceptance Criteria

1. **Given** `kayman models list` is run
   **When** the command executes
   **Then** it shows all available whisper model sizes (tiny, base, small, medium, large) with their disk size and whether each is downloaded locally
   **And** the currently configured model is highlighted

2. **Given** `kayman models download medium` is run
   **When** the command executes
   **Then** it downloads the whisper model to `~/.cache/whisper/` with a progress indicator
   **And** on completion prints the path and sets `whisper_model_path` in config to point to it

3. **Given** `kayman models download` is run with an invalid model name
   **When** the command executes
   **Then** it prints available model names and exits code 1

4. **Given** a model is already downloaded
   **When** `kayman models download base` is run
   **Then** it prints `Model "base" already downloaded at <path>.` and exits code 0

5. **Given** `kayman models remove large` is run
   **When** the command executes
   **Then** it deletes the model file and prints confirmation
   **And** if the deleted model was the configured one, prints a warning: `Warning: active model removed. Run kayman models download <size> to get a new one.`

## Tasks / Subtasks

- [x] Task 1: Create `packages/cli/src/commands/models.ts` with `modelsCommand(args: string[])` (AC: 1–5)
  - [x] Define `WHISPER_MODELS` constant — array of `{ name, filename, sizeMb }` for tiny/base/small/medium/large
  - [x] Model filenames follow whisper.cpp convention: `ggml-{name}.bin` (e.g. `ggml-base.bin`)
  - [x] Download URL: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{name}.bin`
  - [x] Models dir: `~/.cache/whisper/` (already used as `DEFAULT_WHISPER_MODEL_DIR` in `transcribe.ts`)
  - [x] Implement `handleList(config)`: print table with model name, size, downloaded status, highlight active
  - [x] Implement `handleDownload(modelName, config)`: validate name, check if exists, stream download with progress, update config YAML
  - [x] Implement `handleRemove(modelName, config)`: validate name, delete file, warn if active model removed
  - [x] Export `modelsCommand(args: string[], config: Config): Promise<void>`

- [x] Task 2: Register `models` command in `packages/cli/src/index.ts` (AC: 1–5)
  - [x] Add `import { modelsCommand } from './commands/models'`
  - [x] Register: `program.command('models [subcommand] [model]').description(...).action(...)`
  - [x] Add `'models'` to the skip-config-load list in `preAction` hook? No — models needs config to know current model. Keep it requiring config.
  - [x] Remove "(coming soon)" wording from `help.ts` COMMAND_GROUPS entry for `models`
  - [x] Add `models` entry to `COMMAND_DETAILS` in `help.ts`

- [x] Task 3: Config YAML updater utility (AC: 2)
  - [x] Create `packages/cli/src/commands/config-writer.ts` with `setConfigValue(key: string, value: string): void`
  - [x] Use `fs.readFileSync` + regex replacement to update YAML field in-place, preserving comments
  - [x] Config path: `~/.config/kayman/config.yaml` — use the same path logic as `loadConfig()` in `@kayman/shared`
  - [x] Export `CONFIG_PATH` constant for reuse in Story 6.5

- [x] Task 4: Write tests (AC: 1–5)
  - [x] `packages/cli/src/commands/models.test.ts`
  - [x] Mock `fetch` for download, mock `fs` for file existence/deletion
  - [x] Test: list shows correct available/downloaded state
  - [x] Test: download streams to correct path and updates config
  - [x] Test: invalid model name exits code 1
  - [x] Test: already downloaded — no re-download
  - [x] Test: remove deletes file and warns if active

## Dev Notes

### Model filenames and download URLs

whisper.cpp uses `ggml-{name}.bin` naming. The canonical source is:
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{name}.bin
```

Models dir constant already exists in `transcribe.ts`:
```typescript
const DEFAULT_WHISPER_MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper')
```

Move this to `@kayman/shared` or re-declare it in `models.ts`. Don't import from `transcribe.ts` just to reuse this constant.

### Approximate model sizes
| Name   | Size  |
|--------|-------|
| tiny   | 75 MB |
| base   | 142 MB |
| small  | 466 MB |
| medium | 1.5 GB |
| large  | 2.9 GB |

### Progress indicator for download

Use a streaming fetch + track `Content-Length` response header:
```typescript
const response = await fetch(url)
const total = parseInt(response.headers.get('content-length') ?? '0', 10)
let downloaded = 0
const writer = fs.createWriteStream(destPath)
for await (const chunk of response.body as any) {
  writer.write(chunk)
  downloaded += chunk.length
  const pct = total ? Math.floor((downloaded / total) * 100) : 0
  process.stdout.write(`\rDownloading ${modelName}... ${pct}%`)
}
writer.end()
process.stdout.write('\n')
```

### Config YAML in-place update

`loadConfig()` in `@kayman/shared` reads from `~/.config/kayman/config.yaml`. To update `whisper_model_path` after download:
1. Read the raw YAML string
2. Replace existing `whisper_model_path: ...` line, or append if not present
3. Write back

Use a simple regex approach — do NOT use a YAML round-trip library (it strips comments). Pattern:
```typescript
const raw = fs.readFileSync(configPath, 'utf8')
const updated = raw.includes('whisper_model_path:')
  ? raw.replace(/^whisper_model_path:.*/m, `whisper_model_path: ${newValue}`)
  : raw + `\nwhisper_model_path: ${newValue}\n`
fs.writeFileSync(configPath, updated, 'utf8')
```

This same utility will be needed in Story 6.5 (`kayman config set`) — create `config-writer.ts` now to avoid duplication.

### Determining "currently configured model"

From `config.whisperModelPath`: if it's a file path ending in `.bin`, extract basename and strip `ggml-` prefix and `.bin` suffix to get the model name. If it's a short name like `base`, match directly.

### `help.ts` update required

`COMMAND_GROUPS` already has `models` listed with "(coming soon)" description. Update it and add a `COMMAND_DETAILS['models']` entry showing the three subcommands.

### Project Structure Notes

**New files:**
- `packages/cli/src/commands/models.ts`
- `packages/cli/src/commands/models.test.ts`
- `packages/cli/src/commands/config-writer.ts` (shared utility for YAML updates)

**Modified files:**
- `packages/cli/src/index.ts` — register `models` command
- `packages/cli/src/commands/help.ts` — update `models` description + add `COMMAND_DETAILS['models']`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.2] — full ACs
- [Source: packages/cli/src/pipeline/transcribe.ts] — DEFAULT_WHISPER_MODEL_DIR, model filename conventions
- [Source: packages/cli/src/commands/verify.ts] — checkWhisperModel, existing model path logic
- [Source: packages/cli/src/commands/preflight.ts] — whisperModelPath check pattern
- [Source: packages/cli/src/index.ts] — command registration pattern, preAction hook
- [Source: packages/cli/src/commands/help.ts] — COMMAND_GROUPS and COMMAND_DETAILS patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

- Created `models.ts` with list/download/remove subcommands; streaming download with progress %; WHISPER_MODELS constant with 5 sizes
- Created `config-writer.ts` with `setConfigValue` (regex in-place YAML update) and exported `CONFIG_PATH` for Story 6.5 reuse
- Registered `models [subcommand] [model]` command in `index.ts`; updated `help.ts` COMMAND_GROUPS + added COMMAND_DETAILS entry
- 10 tests across list/download/remove scenarios; all 158 tests pass; lint and typecheck clean

### Code Review Fixes (2026-04-13)

- `config-writer.ts`: handle missing config file (ENOENT) — reads empty string, creates parent dirs before write
- `config-writer.ts`: fixed key matching — use `RegExp.test()` instead of `String.includes()` to avoid substring false-positives
- `models.ts`: added `try/finally` around download stream — destroys writer and removes partial file on failure
- `models.test.ts`: fixed weak `?.()` assertion in "already downloaded" test; added missing test for remove-non-downloaded branch

### File List

- packages/cli/src/commands/models.ts (new)
- packages/cli/src/commands/models.test.ts (new)
- packages/cli/src/commands/config-writer.ts (new)
- packages/cli/src/index.ts (modified)
- packages/cli/src/commands/help.ts (modified)
