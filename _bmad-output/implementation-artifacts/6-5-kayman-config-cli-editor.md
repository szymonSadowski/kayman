# Story 6.5: `kayman config` — CLI Config Editor

Status: done

## Story

As a power user,
I want to view and change kayman settings from the terminal,
So that I don't have to manually edit YAML files.

## Acceptance Criteria

1. **Given** `kayman config list` is run
   **When** the command executes
   **Then** it prints all current config values in a readable key-value format
   **And** sensitive values (`ai_api_key`, `notion_token`) are masked (e.g., `sk-...abc123`)

2. **Given** `kayman config get ai_provider` is run
   **When** the command executes
   **Then** it prints the current value of that field

3. **Given** `kayman config set ai_provider ollama` is run
   **When** the command executes
   **Then** it updates `~/.config/kayman/config.yaml` with the new value
   **And** validates the value (e.g., `ai_provider` must be one of the supported providers)
   **And** prints confirmation: `ai_provider set to "ollama"`

4. **Given** `kayman config set ai_provider invalid_provider` is run
   **When** the command executes
   **Then** it prints: `Invalid value for ai_provider. Supported: openai, anthropic, google, ollama` and exits code 1
   **And** the config file is NOT modified

5. **Given** `kayman config set user_name "Szymon"` is run
   **When** the command executes
   **Then** it updates `user_name` in the YAML file preserving all other fields and comments

6. **Given** `kayman config set nonexistent_field value` is run
   **When** the command executes
   **Then** it prints: `Unknown config field: nonexistent_field` and exits code 1

7. **Given** `kayman config path` is run
   **When** the command executes
   **Then** it prints the full path to the config file: `~/.config/kayman/config.yaml`

## Tasks / Subtasks

- [x] Task 1: Create `packages/cli/src/commands/config-writer.ts` (if not already created in Story 6.2) (AC: 3, 5)
  - [x] Export `CONFIG_PATH: string` — `path.join(os.homedir(), '.config', 'kayman', 'config.yaml')`
  - [x] Export `setConfigValue(key: string, value: string): void` — in-place YAML field update preserving comments
  - [x] Uses regex: if key exists → replace; if not → append
  - [x] Never use a YAML round-trip library (strips comments)

- [x] Task 2: Define `CONFIG_FIELDS` schema for validation (AC: 3, 4, 6)
  - [x] In `config-command.ts`, define `CONFIG_FIELDS` map: `{ [yamlKey: string]: { type: 'string' | 'enum', values?: string[] } }`
  - [x] Validated enum fields: `ai_provider` → `['openai', 'anthropic', 'google', 'ollama']`
  - [x] Known string fields (no enum validation): `ai_model`, `ai_api_key`, `ai_base_url`, `notion_token`, `notion_database_id`, `whisper_binary_path`, `whisper_model_path`, `audio_source`, `user_name`
  - [x] Keep `projects` as known but non-editable via `config set` (too complex for simple key-value)

- [x] Task 3: Create `packages/cli/src/commands/config-command.ts` with `configCommand(args: string[])` (AC: 1–7)
  - [x] `list` subcommand: call `loadConfig()`, format all fields as `key: value`, mask `ai_api_key` and `notion_token`
  - [x] `get <key>` subcommand: call `loadConfig()`, find and print the field value (unmask — user asked for it explicitly)
  - [x] `set <key> <value>` subcommand: validate key exists, validate value if enum, call `setConfigValue()`
  - [x] `path` subcommand: print `CONFIG_PATH`
  - [x] Masking: show first 3 chars + `...` + last 6 chars, e.g. `sk-...abc123`
  - [x] YAML key → Config field name mapping: use snake_case YAML keys directly (same as in config.ts)

- [x] Task 4: Register `config` command in `packages/cli/src/index.ts` (AC: 1–7)
  - [x] Add `import { configCommand } from './commands/config-command'`
  - [x] Register: `program.command('config [subcommand] [args...]').description(...).action(...)`
  - [x] `config` command needs config loaded? For `list`/`get`/`set`, yes (uses loadConfig). For `path`, no.
  - [x] Actually: `list` and `get` call `loadConfig()` themselves internally. `set` reads raw YAML. So it's fine to skip the `preAction` hook loading — handle config loading inside the command.
  - [x] Add `'config'` to the skip-config-load list in `preAction` hook
  - [x] Update `help.ts`: remove "(coming soon)", add `COMMAND_DETAILS['config']`

- [x] Task 5: Write tests (AC: 1–7)
  - [x] `packages/cli/src/commands/config-command.test.ts`
  - [x] Mock `fs.readFileSync`/`writeFileSync` and `loadConfig`
  - [x] Test: list masks sensitive fields
  - [x] Test: get returns correct value
  - [x] Test: set valid enum → writes file + prints confirmation
  - [x] Test: set invalid enum → exits 1, file unchanged
  - [x] Test: set unknown field → exits 1
  - [x] Test: path prints CONFIG_PATH

## Dev Notes

### Config YAML key → field name mapping

`loadConfig()` in `@kayman/shared/src/config.ts` parses snake_case YAML keys to camelCase Config fields. For `config list`, display the YAML keys (snake_case) since that's what users see in the file.

Known YAML keys based on `config.ts`: `ai_provider`, `ai_model`, `ai_api_key`, `ai_base_url`, `notion_token`, `notion_database_id`, `whisper_binary_path`, `whisper_model_path`, `audio_source`, `user_name`, `projects`.

Read `packages/shared/src/config.ts` before implementing to get the exact key list — do NOT guess.

### In-place YAML update (no comment stripping)

```typescript
export function setConfigValue(key: string, value: string): void {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
  const pattern = new RegExp(`^(${key}:\\s*).*`, 'm')
  const updated = pattern.test(raw)
    ? raw.replace(pattern, `$1${value}`)
    : raw.trimEnd() + `\n${key}: ${value}\n`
  fs.writeFileSync(CONFIG_PATH, updated, 'utf8')
}
```

For string values that may contain spaces, wrap in quotes in the YAML: `value: "Szymon Sadowski"`.

### Masking sensitive values

```typescript
function maskValue(value: string): string {
  if (value.length <= 9) return '***'
  return value.slice(0, 3) + '...' + value.slice(-6)
}
const SENSITIVE_KEYS = new Set(['ai_api_key', 'notion_token'])
```

### `config set` does NOT call loadConfig before writing

`config set` should write to the raw YAML file even if the current config is invalid (e.g., user is fixing a broken config). Use `setConfigValue()` directly, not `loadConfig()`. Validate enum constraints before writing.

### `projects` field

`projects` is an array in YAML — too complex for `config set`. If user tries `kayman config set projects ...`, print:
```
"projects" is a complex field. Edit ~/.config/kayman/config.yaml directly to manage projects.
```
And exit 0 (not an error, just a limitation).

### `config` command in `preAction` hook

Currently `preAction` calls `loadConfig()` for all commands except `completion`, `verify`, `help`. Add `'config'` to the skip list since the command manages its own config loading (and `config set` should work even with a broken config).

### Project Structure Notes

**New files:**
- `packages/cli/src/commands/config-command.ts`
- `packages/cli/src/commands/config-command.test.ts`
- `packages/cli/src/commands/config-writer.ts` (if not created in Story 6.2)

**Modified files:**
- `packages/cli/src/index.ts` — register `config` command, add to preAction skip list
- `packages/cli/src/commands/help.ts` — update `config` description + add COMMAND_DETAILS

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.5] — full ACs
- [Source: packages/shared/src/config.ts] — YAML key names, SUPPORTED_AI_PROVIDERS, loadConfig() return shape
- [Source: packages/shared/src/types.ts] — Config interface fields
- [Source: packages/cli/src/index.ts] — command registration + preAction hook skip list
- [Source: packages/cli/src/commands/help.ts] — COMMAND_GROUPS/COMMAND_DETAILS patterns
- [Source: packages/cli/src/commands/config-writer.ts] — (may be created in Story 6.2)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_none_

### Completion Notes List

- `config-writer.ts` already existed from Story 6.2 — used as-is
- `config-command.ts` created with all 4 subcommands: list, get, set, path
- `audio_source` added as enum field (system_and_mic, mic_only, system_only) per config.ts
- String values with spaces are quoted in YAML; inner double quotes are escaped
- `projects` set special-case: prints guidance message, exits 0
- Code review fixes: guard for missing value in `config set` (exits 1), quote escaping for YAML values, `(not set)` indicator for unset optional fields in `list`/`get`
- 14 tests covering all ACs; 185/185 full suite passing

### File List

- `packages/cli/src/commands/config-command.ts` (new)
- `packages/cli/src/commands/config-command.test.ts` (new)
- `packages/cli/src/index.ts` (modified — import, register command, preAction skip list)
- `packages/cli/src/commands/help.ts` (modified — updated config description + COMMAND_DETAILS)
