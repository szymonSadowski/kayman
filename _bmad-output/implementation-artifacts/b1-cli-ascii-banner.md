# Story B1: CLI ASCII Banner

Status: review

## Story

As a power user,
I want the kayman ASCII logo to display when I invoke the CLI in a terminal,
so that kayman has a distinctive visual identity.

## Acceptance Criteria

1. **Given** `kayman` is run in a TTY (interactive terminal)
   **When** any command is invoked
   **Then** the ASCII banner is printed before command output

2. **Given** `kayman` output is piped or redirected (`kayman status | cat`)
   **When** the command runs
   **Then** no banner is printed (non-TTY detection)

3. **Given** `kayman --help` or `kayman -h` is run
   **When** the command executes
   **Then** no banner is printed (help flags should not show the banner)

4. **Given** `kayman --version` is run
   **When** the command executes
   **Then** no banner is printed

5. **Given** a banner is shown
   **When** it renders
   **Then** it uses the exact ASCII art defined in `new-stories.md` Story B1

## Tasks / Subtasks

- [x] Task 1: Create `packages/shared/src/banner.ts` exporting `printBanner()` (AC: 1, 2, 5)
  - [x] Store the full ASCII art string as a constant `BANNER`
  - [x] Export `printBanner(): void` — checks `process.stdout.isTTY`, prints if true, no-op otherwise
  - [x] Export from `packages/shared/src/index.ts`
- [x] Task 2: Call `printBanner()` in `packages/cli/src/index.ts` (AC: 1–4)
  - [x] Add banner call at the top of `index.ts`, AFTER Commander setup but BEFORE `program.parse()`
  - [x] Guard: skip when `process.argv` includes `--help`, `-h`, or `--version`
  - [x] Uses Option A (top-level call) with explicit argv guards for --help/-h/--version
  - [x] TTY guard in printBanner() handles piped/redirected output
- [x] Task 3: Export `printBanner` from shared index (AC: 1)
  - [x] Add `export * from './banner'` to `packages/shared/src/index.ts`
- [x] Task 4: Verify non-TTY stripping (AC: 2)
  - [x] printBanner() checks process.stdout.isTTY — no-op when piped/redirected

## Dev Notes

### ASCII Art

The full banner is defined in `_bmad-output/new-stories.md`. It's the kayman logo in `@@@` art, approximately 52 lines tall.

Store it as a template literal in `banner.ts`:

```ts
const BANNER = `
@@@@@@@@@@@@@@@@@@@@@@@@@@...
...
`

export function printBanner(): void {
  if (!process.stdout.isTTY) return
  process.stdout.write(BANNER + '\n')
}
```

### Where to Call `printBanner()`

**Option A: Top-level in `index.ts`** (before `program.parse()`)

```ts
// At top of index.ts, after imports:
printBanner()
program.parse()
```

Pros: Banner shows for every invocation in TTY.
Cons: Shows before `kayman stop`, `kayman start`, etc. — may be visually cluttered for frequent commands.

**Option B: Only in `program.action()` (no-command fallback)**

```ts
program.action(async () => {
  printBanner()
  await helpCommand()
})
```

Pros: Banner only shows when `kayman` is invoked with no subcommand (the "welcome" use case).
Cons: `kayman start` won't show the banner.

**Recommended: Option A** — per the acceptance criteria "any command invoked" shows the banner. Use non-TTY guard to keep piped usage clean.

### --help / --version Guard

After Story C1 fix, `helpOption(false)` means `--help` is not intercepted by Commander — it falls to `program.action()`. If using Option A (top-level call), the banner would show before help. 

To suppress banner for help/version flags:
```ts
const args = process.argv.slice(2)
if (!args.includes('--help') && !args.includes('-h') && !args.includes('--version')) {
  printBanner()
}
```

Or more simply — only show banner when the command is a known subcommand OR no subcommand:
```ts
// Actually: just rely on isTTY for piped use, and accept banner shows on --help in TTY
// The ACs say "no banner on --help" so we need the explicit check
```

### Banner Size Consideration

The banner is ~52 lines. In a typical 24-line terminal this scrolls past. This is intentional for branding — the banner is a "splash" moment. For frequent command use (scripting), the non-TTY guard ensures clean output.

### Project Structure Notes

**New files:**
- `packages/shared/src/banner.ts`

**Modified files:**
- `packages/shared/src/index.ts` — add `export * from './banner'`
- `packages/cli/src/index.ts` — call `printBanner()` at startup

### References

- [Source: _bmad-output/new-stories.md#Story-1-CLI-ASCII-Banner] — full ASCII art to use
- [Source: packages/cli/src/index.ts] — entry point for banner call
- [Source: packages/shared/src/format.ts] — TTY detection pattern (`process.stdout.isTTY`)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Created packages/shared/src/banner.ts with full ASCII art and TTY-guarded printBanner()
- Exported printBanner from packages/shared/src/index.ts
- Called printBanner() in packages/cli/src/index.ts after Commander setup, guarded by --help/-h/--version check
- All 59 existing shared tests pass; builds succeed for both shared and CLI

### File List
- packages/shared/src/banner.ts (new)
- packages/shared/src/banner.test.ts (new)
- packages/shared/src/index.ts (modified)
- packages/shared/tsup.config.ts (modified — added shims: true for ESM/CJS compat)
- packages/cli/src/index.ts (modified)
