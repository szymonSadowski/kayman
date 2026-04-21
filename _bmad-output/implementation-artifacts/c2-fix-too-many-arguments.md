# Story C2: Fix "too many arguments" on `kayman offline`, `kayman online`, `kayman models`

Status: done

## Story

As a power user,
I want `kayman offline`, `kayman online`, and `kayman models` to run without errors,
so that I can switch modes and manage models without workarounds.

## Acceptance Criteria

1. **Given** `kayman offline` is run
   **When** the command executes
   **Then** `offlineCommand` runs without a "too many arguments" error

2. **Given** `kayman online` is run
   **When** the command executes
   **Then** `onlineCommand` runs without a "too many arguments" error

3. **Given** `kayman models` (or `kayman models list`) is run
   **When** the command executes
   **Then** `modelsCommand` runs without a "too many arguments" error

4. **Given** `kayman offline --model mistral` is run
   **When** the command executes
   **Then** it runs `offlineCommand` with `{ model: 'mistral' }` (no regression on option)

5. **Given** working commands (`start`, `stop`, `last`, `status`, `memo`, `list`, `retry`, `verify`, `config`)
   **When** run normally
   **Then** no regression introduced

## Tasks / Subtasks

- [x] Task 1: Diagnose root cause (AC: 1–3)
  - [x] Run `kayman offline` with `DEBUG=commander:*` or add `console.log(process.argv)` to narrow down what Commander sees
  - [x] Check if `program.action()` default handler is consuming `offline`/`online`/`models` as arguments before subcommand dispatch
  - [x] Check Commander version in `packages/cli/package.json` — Commander 12 changed `allowExcessArguments` default
  - [x] Determine if the issue is `program.option('-h, --help')` causing argument count confusion (see Story C1 — may be fixed by C1's removal of that line)
- [x] Task 2: Apply fix based on diagnosis (AC: 1–5)
  - [x] **If** caused by C1's duplicate help option: removing that option (C1 fix) resolves this — verify
  - [x] **If** caused by `allowExcessArguments` default: add `.allowExcessArguments(false)` explicitly on affected commands OR ensure Commander version compatibility
  - [x] **If** caused by Commander version quirk: check if upgrading/pinning Commander resolves it
  - [x] **If** caused by command registration order: reorder so default `program.action()` is registered last (it already is — line 155 in index.ts)
- [x] Task 3: Smoke test all affected commands (AC: 1–5)
  - [x] `kayman offline` — runs offlineCommand
  - [x] `kayman online` — runs onlineCommand
  - [x] `kayman models` — runs modelsCommand (shows list subcommand help)
  - [x] `kayman models list` — works
  - [x] `kayman models download base` — works
  - [x] All working commands still work

## Dev Notes

### Observed Error

```
error: too many arguments. Expected 0 arguments but got 1.
```

This means Commander received 1 positional argument for a command that expects 0.

### Likely Root Cause: Interaction with `program.option('-h, --help')`

When `program.option('-h, --help', 'Show help')` is registered at the root program level, Commander may treat unrecognized options on subcommands differently. More critically, the combination of `program.option('-h, --help')` with `program.on('option:help', ...)` and `program.action()` can cause Commander to not correctly dispatch to subcommands in some versions.

**Most likely fix: implementing C1 first** (removing `program.option('-h, --help')` and `program.on('option:help')`) may resolve this entirely, since the argument parsing pipeline becomes clean.

### Secondary Suspect: Commander Version

Check `packages/cli/package.json`:
```bash
cat packages/cli/package.json | grep commander
```

Commander 12 introduced stricter excess argument validation. If the installed version changed, commands defined with `[optional]` args might behave differently.

### Commander `allowExcessArguments` Workaround

If the issue persists after C1 fix, add per-command allowance:
```ts
program
  .command('offline')
  .allowExcessArguments(false)  // explicit — no ambiguity
  .description('Switch to offline mode (local AI)')
  .option('--model <name>', 'Local model to use (default: llama3.2)')
  .action(async (opts: { model?: string }) => {
    await offlineCommand(opts)
  })
```

Or at the program level:
```ts
program.allowExcessArguments(true)  // permissive — rely on per-command validation
```

### Registration Order (already correct)

In `index.ts`, `program.action()` is the last thing registered (line 155–157). Commander should correctly dispatch to named subcommands before falling back to the default action. This means the default action is NOT the cause — but verify this by checking if `offline` is reaching the default action.

### Project Structure Notes

**Modified files:**
- `packages/cli/src/index.ts` — targeted fix based on diagnosis (may be as small as removing 2 lines from C1)

**No new files needed.**

### References

- [Source: packages/cli/src/index.ts#L27-L30] — the `-h/--help` option that is the prime suspect
- [Source: packages/cli/src/index.ts#L141-L153] — offline/online command registrations
- [Source: packages/cli/src/index.ts#L131-L139] — models command registration
- Story C1 — fix the double help issue first; this may resolve C2 as a side effect

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Root cause: `program.on('option:help', ...)` async listener (removed in C1) was interfering with Commander's subcommand dispatch. After rebuilding with C1's fix, all three commands dispatch correctly.
- Commander version: ^13.0.0 — no `allowExcessArguments` issue found.
- `program.option('-h, --help', 'Show help')` retained (needed so Commander accepts `-h`/`--help` flags without erroring).

### Completion Notes List

- C1's fix (removing `program.on('option:help', ...)`) resolved C2 as a side effect — confirmed by smoke tests and 196-test suite.
- No code changes to `index.ts` beyond what C1 already applied.
- All ACs 1–5 verified: `offline`, `online`, `models`, `models list`, `offline --model mistral` all pass; no regressions in existing commands.

### File List

- packages/cli/src/index.ts (modified by C1, no additional changes needed)

### Change Log

- 2026-04-21: Story C2 verified complete — root cause was C1's `option:help` listener removal; no further code changes required.
