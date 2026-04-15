# Story 6.6: `kayman offline` / `kayman online` — Quick Mode Toggle

Status: done

## Story

As a power user,
I want to quickly switch between local and cloud AI with a single command,
So that I can go offline before a flight or switch back when I have connectivity.

## Acceptance Criteria

1. **Given** `kayman online` is run
   **When** the command executes
   **Then** it checks if `ai_provider` is already a cloud provider (openai/anthropic/google)
   **And** if already online, prints: `Already in online mode (provider: openai).`

2. **Given** `kayman online` is run while `ai_provider: ollama`
   **When** the command executes
   **Then** it restores the previous cloud provider settings from a saved `.online-config` snapshot at `~/.config/kayman/.online-config`
   **And** if no snapshot exists, prompts the user to pick a provider and enter API key via interactive prompts
   **And** prints: `Switched to online mode (provider: openai, model: gpt-4o-mini).`

3. **Given** `kayman offline` is run
   **When** the command executes
   **Then** it saves the current cloud provider settings (`ai_provider`, `ai_model`, `ai_api_key`) to `~/.config/kayman/.online-config`
   **And** sets `ai_provider: ollama` and `ai_model` to a default local model (e.g., `llama3.2`)
   **And** prints: `Switched to offline mode (provider: ollama, model: llama3.2). Your API settings are saved — run kayman online to restore.`

4. **Given** `kayman offline` is run while already in offline mode
   **When** the command executes
   **Then** prints: `Already in offline mode (provider: ollama, model: llama3.2).`

5. **Given** `kayman offline --model mistral` is run
   **When** the command executes
   **Then** it sets `ai_model: mistral` instead of the default

6. **Given** the user has never configured a cloud provider
   **When** `kayman online` is run and no `.online-config` snapshot exists
   **Then** it prompts interactively: provider selection → model name → API key
   **And** saves and applies the new settings

## Tasks / Subtasks

- [x] Task 1: Create `packages/cli/src/commands/offline.ts` with `offlineCommand(opts: { model?: string })` (AC: 3, 4, 5)
  - [x] Load current config via `loadConfig()`
  - [x] If `config.aiProvider === 'ollama'`: print "Already in offline mode" and exit 0
  - [x] Otherwise: read raw YAML config to save snapshot, write snapshot to `~/.config/kayman/.online-config`
  - [x] Snapshot format: JSON with `{ ai_provider, ai_model, ai_api_key }` — simple JSON, not YAML
  - [x] Call `setConfigValue('ai_provider', 'ollama')` and `setConfigValue('ai_model', opts.model ?? 'llama3.2')`
  - [x] Also call `setConfigValue('ai_api_key', '')` to clear API key from config (it's saved in snapshot)
  - [x] Print success message

- [x] Task 2: Create `packages/cli/src/commands/online.ts` with `onlineCommand()` (AC: 1, 2, 6)
  - [x] Load current config via `loadConfig()`
  - [x] If `config.aiProvider !== 'ollama'`: print "Already in online mode (provider: X)." and exit 0
  - [x] Try to read snapshot from `~/.config/kayman/.online-config`
  - [x] If snapshot exists: apply it — call `setConfigValue()` for each field; print "Switched to online mode (provider: X, model: Y)."
  - [x] If no snapshot: run interactive prompts (see Task 3)

- [x] Task 3: Interactive setup for `kayman online` with no snapshot (AC: 6)
  - [x] Use `@inquirer/select` for provider selection: `['openai', 'anthropic', 'google']`
  - [x] Use `@inquirer/input` for model name (with sensible defaults per provider)
  - [x] Use `@inquirer/input` for API key
  - [x] Write snapshot to `~/.config/kayman/.online-config`
  - [x] Apply settings via `setConfigValue()`

- [x] Task 4: Register `offline` and `online` commands in `packages/cli/src/index.ts` (AC: 1–6)
  - [x] Add imports for `offlineCommand` and `onlineCommand`
  - [x] `offline` command: `.option('--model <name>', 'Local model to use (default: llama3.2)')`
  - [x] Both commands manage config themselves — add to `preAction` skip list
  - [x] Update `help.ts`: remove "(coming soon)", add `COMMAND_DETAILS['offline']` and `COMMAND_DETAILS['online']`

- [x] Task 5: Write tests (AC: 1–6)
  - [x] `packages/cli/src/commands/offline.test.ts`
  - [x] `packages/cli/src/commands/online.test.ts`
  - [x] Test: offline from cloud → writes snapshot, updates config to ollama
  - [x] Test: offline from ollama → prints "already offline"
  - [x] Test: offline --model mistral → sets mistral
  - [x] Test: online from cloud → prints "already online"
  - [x] Test: online from ollama with snapshot → restores settings
  - [x] Test: online from ollama without snapshot → triggers interactive prompts (mock inquirer)

## Dev Notes

### `.online-config` snapshot format

Store as JSON (not YAML) for simplicity — no risk of comment stripping:
```json
{
  "ai_provider": "openai",
  "ai_model": "gpt-4o-mini",
  "ai_api_key": "sk-..."
}
```

Path: `path.join(os.homedir(), '.config', 'kayman', '.online-config')`

### `setConfigValue` from Story 6.5

This story depends on `config-writer.ts` created in Story 6.5 (or 6.2). Import `setConfigValue` and `CONFIG_PATH` from there. If Story 6.5 hasn't landed yet, inline the utility temporarily.

### Clearing `ai_api_key` in offline mode

When going offline, the `ai_api_key` field in config is no longer needed (Ollama doesn't use it). Store it in the snapshot but clear it from the active config to avoid confusing `loadConfig()` behavior. Set it to an empty string or remove the line entirely. The simplest: set to empty string — `loadConfig()` treats empty string as absent for the conditional api key check added in Story 6.1.

Actually: `loadConfig()` checks `if (ai_provider !== 'ollama' && !parsed.ai_api_key) throw`. Empty string is falsy — this would fail for non-ollama providers. But since we're switching TO ollama, this is fine. When switching back (online), we restore the api key from snapshot.

### Interactive prompts for `online` with no snapshot

Default models per provider:
- openai → `gpt-4o-mini`
- anthropic → `claude-haiku-4-5-20251001`
- google → `gemini-2.0-flash`

```typescript
const { default: select } = await import('@inquirer/select')
const { default: input } = await import('@inquirer/input')
const provider = await select({ message: 'Select AI provider:', choices: ['openai', 'anthropic', 'google'].map(v => ({ name: v, value: v })) })
const defaultModels = { openai: 'gpt-4o-mini', anthropic: 'claude-haiku-4-5-20251001', google: 'gemini-2.0-flash' }
const model = await input({ message: 'Model name:', default: defaultModels[provider] })
const apiKey = await input({ message: `${provider} API key:` })
```

### `loadConfig()` may throw if config is in broken state

`offlineCommand` and `onlineCommand` call `loadConfig()` to read current state. If the config is invalid (e.g., mid-migration state), this throws. Wrap in try/catch and fall back to reading raw YAML for the provider field if needed. This edge case is unlikely but worth noting.

### Both commands skip the `preAction` config loading

Add `'offline'` and `'online'` to the skip list in `index.ts` `preAction` hook — same pattern as `'verify'`, `'completion'`, `'help'`. These commands manage their own config loading.

### Project Structure Notes

**New files:**
- `packages/cli/src/commands/offline.ts`
- `packages/cli/src/commands/online.ts`
- `packages/cli/src/commands/offline.test.ts`
- `packages/cli/src/commands/online.test.ts`

**Modified files:**
- `packages/cli/src/index.ts` — register `offline`/`online` commands, add to preAction skip list
- `packages/cli/src/commands/help.ts` — update descriptions + add COMMAND_DETAILS entries

**Depends on (must be completed first):**
- Story 6.5 for `config-writer.ts` (`setConfigValue`, `CONFIG_PATH`) — or inline if 6.5 not done yet

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.6] — full ACs
- [Source: packages/cli/src/index.ts] — command registration + preAction skip list pattern
- [Source: packages/cli/src/commands/start.ts] — @inquirer/select dynamic import pattern
- [Source: packages/cli/src/commands/help.ts] — COMMAND_GROUPS/COMMAND_DETAILS patterns
- [Source: packages/cli/src/commands/config-writer.ts] — setConfigValue (from Story 6.5/6.2)
- [Source: packages/shared/src/config.ts] — loadConfig(), SUPPORTED_AI_PROVIDERS

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — clean implementation.

### Completion Notes List

- Created `offline.ts`: saves cloud settings snapshot to `~/.config/kayman/.online-config` (JSON), switches to ollama; handles already-offline case; supports `--model` override.
- Created `online.ts`: restores from snapshot if present; falls back to interactive `@inquirer/select`+`@inquirer/input` prompts for provider/model/apiKey when no snapshot exists; handles already-online case.
- Registered both commands in `index.ts`; added `'offline'` and `'online'` to preAction skip list.
- Updated `help.ts`: removed "(coming soon)", added `COMMAND_DETAILS['offline']` and `COMMAND_DETAILS['online']`.
- 191/191 tests pass; typecheck clean; pre-existing lint error in `config-command.test.ts` not introduced here.

### File List

- `packages/cli/src/commands/offline.ts` (new)
- `packages/cli/src/commands/online.ts` (new)
- `packages/cli/src/commands/offline.test.ts` (new)
- `packages/cli/src/commands/online.test.ts` (new)
- `packages/cli/src/commands/config-writer.ts` (modified)
- `packages/cli/src/index.ts` (modified)
- `packages/cli/src/commands/help.ts` (modified)
- `_bmad-output/sprint-board.md` (modified)

### Change Log

- 2026-04-15: Story 6.6 implemented — `kayman offline` / `kayman online` quick mode toggle commands.
