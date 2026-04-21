# Story C1: Fix Double Help Output

Status: done

## Story

As a power user,
I want `kayman --help`, `kayman -h`, and `kayman` (no args) to print help exactly once,
so that the output isn't cluttered with duplicate content.

## Acceptance Criteria

1. **Given** `kayman` is run with no arguments
   **When** the command executes
   **Then** help is printed exactly once

2. **Given** `kayman --help` is run
   **When** the command executes
   **Then** help is printed exactly once and the process exits

3. **Given** `kayman -h` is run
   **When** the command executes
   **Then** help is printed exactly once and the process exits

4. **Given** `kayman help <command>` is run
   **When** the command executes
   **Then** detailed command help is printed (no regression)

5. **Given** `kayman help` is run
   **When** the command executes
   **Then** full help is printed exactly once (no regression)

## Tasks / Subtasks

- [x] Task 1: Remove duplicate help trigger in `packages/cli/src/index.ts` (AC: 1, 2, 3)
  - [~] Keep `program.option('-h, --help', 'Show help')` registration (removal caused "too many arguments" on `-h`/`--help`; kept so Commander accepts the flags)
  - [x] Remove `program.on('option:help', () => { helpCommand().then(() => process.exit(0)) })` block — this was the cause of double-invocation
  - [x] Verify `program.action(async () => { await helpCommand() })` remains as no-command fallback
  - [x] Verify `helpOption(false)` stays set (already present — suppresses Commander's built-in help)
- [x] Task 2: Manual smoke test (AC: 1–4)
  - [x] Run `kayman` — help appears once
  - [x] Run `kayman --help` — help appears once then exits (Commander passes unknown `--help` to default action OR Commander ignores it since `helpOption(false)`)
  - [x] Run `kayman -h` — same as above
  - [x] Run `kayman help start` — detailed start help appears once
- [x] Task 3: Update help.test.ts if needed (AC: 1–4)
  - [x] Ensure no test relies on the `program.on('option:help')` path
  - [ ] [AI-Review][MEDIUM] Add CLI-level integration test verifying `helpCommand` fires exactly once for `kayman`, `kayman --help`, `kayman -h` (requires process-spawn test setup or refactoring index.ts to export `createProgram()`)

## Dev Notes

### Root Cause

`packages/cli/src/index.ts` registers two independent help triggers:

```ts
// Trigger 1 — async, non-blocking:
program.option('-h, --help', 'Show help')
program.on('option:help', () => {
  helpCommand().then(() => process.exit(0))   // async — returns immediately
})

// Trigger 2 — default action (fires for any unmatched invocation):
program.action(async () => {
  await helpCommand()
})
```

When `kayman --help` or `kayman -h` is run:
1. `program.on('option:help')` fires and calls `helpCommand()` — but because the promise is not awaited, it returns before printing and `process.exit(0)` hasn't run yet.
2. `program.parse()` continues to the default `program.action()` which also calls `helpCommand()`.
3. Both async `helpCommand()` calls resolve concurrently — output is printed twice.

### Fix

Remove the option+listener pair entirely. `helpOption(false)` already suppresses Commander's built-in help. The only remaining path is `program.action()` as the no-command fallback.

```ts
// REMOVE these two lines:
program.option('-h, --help', 'Show help')
program.on('option:help', () => {
  helpCommand().then(() => process.exit(0))
})
```

After this fix: `kayman`, `kayman --help`, and `kayman -h` all fall through to `program.action()` → `helpCommand()` exactly once.

Note: With `helpOption(false)`, Commander does not intercept `--help` or `-h` at all — they are treated as unknown options/arguments. Since the root program's `action()` fires for all unmatched invocations, this is fine.

### What NOT to Change

- `program.addHelpCommand(false)` — keep (suppresses `help` subcommand duplication from Commander)
- `program.helpOption(false)` — keep
- `program.action(async () => helpCommand())` — keep
- The `help [command]` subcommand registration — keep (handles `kayman help <cmd>`)

### Project Structure Notes

**Modified files:**
- `packages/cli/src/index.ts` — remove 2 lines

### References

- [Source: packages/cli/src/index.ts#L27-L30] — the duplicate trigger to remove
- [Source: packages/cli/src/commands/help.ts] — `helpCommand()` implementation (no changes needed)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Dev Notes suggested removing the option+listener pair entirely, but `--help`/`-h` then became unknown positional args causing "too many arguments" error. Fixed by keeping `program.option('-h, --help', 'Show help')` registration (without the async listener) so Commander accepts the flags and routes to action().

### Completion Notes List

- Removed `program.on('option:help', ...)` async listener that caused double helpCommand() execution
- Kept `program.option('-h, --help', 'Show help')` registration so Commander accepts the flags without erroring
- Fixed `preAction` hook: added `actionCommand === program` guard so `kayman` / `kayman --help` (default action path) does not attempt `loadConfig()` — prevents config-missing error for first-time users
- All 196 tests pass, all AC smoke tests verified

### File List

- packages/cli/src/index.ts
