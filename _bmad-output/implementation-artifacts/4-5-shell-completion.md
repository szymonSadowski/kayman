# Story 4.5: Shell Tab Completion

Status: done

## Story

As a power user,
I want tab completion for `kayman start <project>` in my shell,
so that I never have to type project names in full (FR30).

## Acceptance Criteria

1. **Given** the shell completion script is sourced in `~/.zshrc` or `~/.bashrc`
   **When** the user types `kayman start ` and presses Tab
   **Then** a list of project names from `~/.config/kayman/config.yaml` is shown.
2. **Given** the user types `kayman start Kay` and presses Tab
   **When** completion runs
   **Then** it completes to `kayman start Kayman` (prefix matching, case-insensitive).
3. **Given** the config file is updated with a new project
   **When** tab completion runs next time
   **Then** the new project name appears in completions (sourced live from config every invocation, **not** cached).
4. **Given** completion is invoked for `kayman <Tab>` (no subcommand yet)
   **When** Tab is pressed
   **Then** the list of subcommands (`start`, `stop`, `last`, `memo`, `status`, `list`, `retry`, `verify`) is shown.
5. **Given** the user runs `kayman completion install`
   **When** the command executes
   **Then** it prints clear instructions for sourcing the completion script in zsh and bash, with copy-pasteable lines.

## Tasks / Subtasks

- [x] Task 1: Create `packages/cli/src/completion/completion.ts` (AC: 1, 2, 3, 4)
  - [x] Export `completionCommand(args: string[]): Promise<void>` — handles two modes:
    - `kayman completion script [zsh|bash]` → prints the static completion script
    - `kayman completion projects` → reads `loadConfig()` and prints project names, one per line (consumed by the script)
    - `kayman completion install` → prints sourcing instructions
- [x] Task 2: Add the completion script as a string constant (AC: 1, 2, 4)
  - [x] zsh version using `compdef` and `_kayman` function
  - [x] bash version using `complete -F _kayman kayman`
  - [x] Both call `kayman completion projects` at completion time (live, no cache)
  - [x] Both handle the subcommand list inline (no CLI roundtrip needed for that)
- [x] Task 3: Wire `completion` subcommand into `packages/cli/src/index.ts` (AC: 5)
  - [x] Register `program.command('completion [action] [shell]')` calling `completionCommand`
  - [x] Add to `preAction` skip list alongside `verify` — completion script generation MUST work without a valid config (so users can install completion before configuring kayman)
- [x] Task 4: Add tests `packages/cli/src/completion/completion.test.ts` (AC: 1, 2, 3, 4, 5)
  - [x] `completion projects` with mocked config → prints project names line-separated
  - [x] `completion projects` with no config file → prints nothing, exits 0 (graceful degrade — completion shouldn't error mid-tab)
  - [x] `completion projects` with config but zero projects → prints nothing, exits 0
  - [x] `completion script zsh` → contains `compdef _kayman kayman` and `kayman completion projects`
  - [x] `completion script bash` → contains `complete -F _kayman kayman`
  - [x] `completion install` → prints both zsh and bash sourcing instructions
- [x] Task 5: Document install in README (AC: 5)
  - [x] Brief section: "Tab Completion" with the two install lines (one for zsh, one for bash)

## Dev Notes

### Why Not Use a Library

Existing libraries (`omelette`, `yargs/completion`, `commander/completion`) are heavy and opinionated. The completion surface here is **tiny**: 8 subcommands + dynamic projects for `start`. A hand-rolled 30-line shell function is simpler, easier to debug, and doesn't add dependency risk (per Epic 3 retro lesson T1 — pin/minimize external deps).

### Why `kayman completion projects` Instead of Reading Config from Shell

Two reasons:
1. **Single source of truth.** `loadConfig()` already validates the YAML and resolves projects. Re-implementing YAML parsing in shell is fragile.
2. **Live updates.** Every Tab press shells out → reads config fresh → no cache invalidation problems (AC 3).

Cost: ~30ms per Tab press for Node startup. Acceptable — Tab is user-initiated, not in a hot loop.

### Graceful Degrade on Missing Config

If `~/.config/kayman/config.yaml` is missing or malformed, `completion projects` MUST exit 0 with empty output — **not** throw. A user pressing Tab in a fresh shell shouldn't see a wall of error text.

This means the `completion` command **must NOT go through the `preAction` config validation hook** in `index.ts`. Add it to the skip list alongside `verify`.

### zsh Completion Script

```zsh
#compdef kayman

_kayman() {
  local -a subcommands
  subcommands=(
    'start:Start a recording session'
    'stop:Stop the active recording session'
    'last:Show the most recent meeting summary TL;DR'
    'memo:Start a memo recording (no project picker)'
    'status:Check whether a recording is active'
    'list:List past meeting recordings'
    'retry:Re-export failed Notion exports'
    'verify:Validate kayman setup and dependencies'
    'completion:Shell completion helpers'
  )

  if (( CURRENT == 2 )); then
    _describe 'subcommand' subcommands
    return
  fi

  case "${words[2]}" in
    start)
      local -a projects
      projects=(${(f)"$(kayman completion projects 2>/dev/null)"})
      _describe 'project' projects
      ;;
  esac
}

compdef _kayman kayman
```

### bash Completion Script

```bash
_kayman() {
  local cur prev subcommands
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  subcommands="start stop last memo status list retry verify completion"

  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "$subcommands" -- "$cur") )
    return 0
  fi

  if [ "${COMP_WORDS[1]}" = "start" ] && [ "$COMP_CWORD" -eq 2 ]; then
    local projects
    projects=$(kayman completion projects 2>/dev/null)
    COMPREPLY=( $(compgen -W "$projects" -- "$cur") )
    return 0
  fi
}

complete -F _kayman kayman
```

### `completionCommand` Skeleton

```typescript
import { loadConfig } from '@kayman/shared'

const ZSH_SCRIPT = `#compdef kayman
... (string above)
`

const BASH_SCRIPT = `_kayman() {
... (string above)
}
complete -F _kayman kayman
`

export async function completionCommand(args: string[]): Promise<void> {
  const [action, shell] = args

  if (action === 'projects') {
    try {
      const config = loadConfig()
      for (const p of config.projects) process.stdout.write(`${p.name}\n`)
    } catch {
      // Graceful degrade — empty output, exit 0
    }
    return
  }

  if (action === 'script') {
    if (shell === 'zsh') process.stdout.write(ZSH_SCRIPT)
    else if (shell === 'bash') process.stdout.write(BASH_SCRIPT)
    else {
      process.stderr.write('Usage: kayman completion script [zsh|bash]\n')
      process.exit(1)
    }
    return
  }

  if (action === 'install' || action === undefined) {
    process.stdout.write(`# zsh — add to ~/.zshrc:
eval "$(kayman completion script zsh)"

# bash — add to ~/.bashrc:
eval "$(kayman completion script bash)"
`)
    return
  }

  process.stderr.write(`Unknown completion action: ${action}\n`)
  process.exit(1)
}
```

### Wiring in `index.ts`

```typescript
// Add to preAction skip list (around line 23):
program.hook('preAction', (_thisCommand, actionCommand) => {
  if (actionCommand.name() === 'verify') return
  if (actionCommand.name() === 'completion') return  // ← new
  // ... rest unchanged
})

// Register the command:
program
  .command('completion [action] [shell]')
  .description('Shell completion helpers (run "kayman completion install" for setup)')
  .action(async (action: string | undefined, shell: string | undefined) => {
    await completionCommand([action, shell].filter((x): x is string => Boolean(x)))
  })
```

### Why Project Matching is Case-Insensitive (AC 2)

zsh's `_describe` and bash's `compgen` handle prefix matching by default but are case-sensitive. The architecture spec wants `Kay<Tab>` → `Kayman`. zsh users can opt in via `setopt CASE_INSENSITIVE_GLOB` or `_kayman` can normalize — but to keep the script portable, **we accept zsh's default behavior** (case-sensitive prefix) and document that users wanting case-insensitive completion should add `setopt CASE_INSENSITIVE_GLOB` to their `.zshrc`. Note this trade-off in the README install section.

### Project Structure Notes

- Add: `packages/cli/src/completion/completion.ts` (new directory + file)
- Add: `packages/cli/src/completion/completion.test.ts` (new file)
- Modify: `packages/cli/src/index.ts` — register `completion` command + add to preAction skip list
- Modify: `README.md` — add "Tab Completion" install section
- No new dependencies

### Testing Standards

- Vitest for `completionCommand` unit tests; mock `loadConfig` via `vi.mock('@kayman/shared', ...)` (mirror `list.test.ts` pattern)
- Tests must verify graceful degrade on missing/invalid config (the AC users will hit first)
- Tests must verify both shell scripts contain the expected sentinel strings (`compdef`, `complete -F`)
- No integration test against a real shell — testing actual zsh/bash completion behavior is fragile and high-cost; manual smoke test only

### Known Risks

- **`kayman` not on PATH:** The completion script calls `kayman completion projects` at Tab time. If `kayman` isn't on PATH, users won't even reach the completion phase (shell can't find the binary). No special handling needed.
- **Slow Tab response:** ~30ms Node startup per Tab press. If users complain, can revisit with a cached file written by `kayman start` — but **don't pre-optimize**, AC 3 wants live config reads.
- **zsh `compinit` not run:** Users on minimal `.zshrc` may not have `compinit` loaded. Document this in README: `autoload -U compinit && compinit` must come before sourcing kayman completion. Note this once, don't paper over it.
- **bash on macOS is bash 3.2:** macOS ships with ancient bash. The `compgen`/`complete` syntax above is bash 3.2 compatible — verify with `bash --version` && manual smoke test.

### Manual Smoke Test (Completion Notes)

After implementing, run:

```bash
pnpm --filter @kayman/cli build
cd packages/cli && pnpm link --global

# zsh
eval "$(kayman completion script zsh)"
kayman <TAB>          # → list of subcommands
kayman start <TAB>    # → list of projects from config
kayman start Kay<TAB> # → completes to first matching project

# bash (if available)
eval "$(kayman completion script bash)"
kayman <TAB>
kayman start <TAB>
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Directory-Structure] — `cli/src/completion/completion.ts` location
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements-to-Structure-Mapping] — FR30 → `cli/src/completion/completion.ts`
- [Source: packages/cli/src/index.ts] — commander setup + preAction hook to extend
- [Source: packages/cli/src/commands/verify.ts] — sibling command that also bypasses preAction config validation
- [Source: packages/shared/src/config.ts] — `loadConfig()` for project enumeration
- [Source: _bmad-output/implementation-artifacts/epic-3-retro-2026-04-08.md#T1] — "minimize external deps" guidance

## Senior Developer Review (AI)

**Reviewer:** Szymonsadowski | **Date:** 2026-04-09

### Findings Fixed

- **H1** — AC 2 (case-insensitive): zsh now uses `compadd -M 'm:{a-zA-Z}={A-Za-z}'` instead of `_describe`; bash manually lowercases both input and project names for prefix comparison. No user opt-in required.
- **H2** — Removed `list`, `retry`, `verify` from both completion scripts — commands not yet registered in `index.ts`.
- **M1** — Bash completion rewritten to use `while IFS= read -r` loop (bash 3.2 compatible, space-safe) instead of `compgen -W "$projects"`.
- **M2** — Removed unused `prev` variable from bash script.
- **M3** — Added test for `completionCommand(['script'])` with no shell arg (falls to stderr + exit 1).
- **L3** — Added `expect(exitSpy).not.toHaveBeenCalled()` assertion to the "exits 0" test.

### Remaining Notes (Low / Won't Fix)

- **L1** — `packages/cli/src/commands/verify.ts` referenced in Dev Notes doesn't exist; it's a future story.
- **L2** — Section title "Why Project Matching is Case-Insensitive" is now moot (matching is case-insensitive); section can be cleaned up in a future pass.

**Outcome:** Approved — all High and Medium issues resolved, 71 tests pass.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `packages/cli/src/completion/completion.ts` with `completionCommand`, ZSH_SCRIPT, and BASH_SCRIPT constants
- Wired `completion` command into `packages/cli/src/index.ts` with preAction skip so it works without a valid config
- Added 9 unit tests covering all ACs: projects output, graceful degrade (no config, empty projects), script sentinel strings, install instructions, unknown action error
- Created root `README.md` with Tab Completion install section including zsh/bash copy-paste lines and notes on case-sensitivity and bash 3.2 compatibility
- All 70 tests pass, typecheck and lint clean

### File List

- `packages/cli/src/completion/completion.ts` (new)
- `packages/cli/src/completion/completion.test.ts` (new)
- `packages/cli/src/index.ts` (modified — added completion import, preAction skip, completion command)
- `README.md` (new)

## Change Log

- 2026-04-09: Implemented story 4.5 — shell tab completion for zsh and bash (9 tests, no new deps)
