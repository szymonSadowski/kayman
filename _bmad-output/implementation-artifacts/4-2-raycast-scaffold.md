# Story 4.2: Raycast Extension Scaffold & Command Stubs

Status: ready-for-dev

## Story

As a developer,
I want the Raycast extension package wired up with all command stubs and `execa` integration ready,
so that Raycast can invoke CLI commands and all extension entry points exist for full implementation in Story 4.3.

## Acceptance Criteria

1. **Given** the Raycast extension is loaded as a development extension in Raycast (`ray develop`)
   **When** the kayman namespace is opened
   **Then** all 6 commands (start, stop, last, memo, status, menu-bar) appear in the Raycast command list with the correct titles, descriptions, and modes from `packages/raycast/package.json`.
2. **Given** any Raycast command stub invokes the CLI
   **When** it executes
   **Then** it uses `await execa('kayman', [...args], { reject: true })` — never raw `child_process` (FR27).
   **And** `node-linker=hoisted` is set in `packages/raycast/.npmrc`.
3. **Given** the extension is built
   **When** `pnpm --filter @kayman/raycast typecheck` (or `tsc --noEmit`) runs
   **Then** it passes with zero errors and `@raycast/api`, `@kayman/shared`, `execa` all resolve cleanly.
4. **Given** the user runs the kayman CLI globally
   **When** Raycast invokes any stub
   **Then** the stub locates the CLI via PATH (no hard-coded absolute paths) and surfaces "kayman not found in PATH" with an actionable error toast if missing.

## Tasks / Subtasks

- [ ] Task 1: Audit existing scaffold against AC1 (AC: 1)
  - [ ] Confirm `packages/raycast/package.json` lists all 6 commands (start, stop, last, memo, status, menu-bar) with correct `mode` values — already present, verify no drift
  - [ ] Confirm `packages/raycast/.npmrc` contains `node-linker=hoisted` — already present, verify
  - [ ] Confirm all 6 stub files exist under `packages/raycast/src/` (start.tsx, stop.tsx, last.tsx, memo.tsx, status.tsx, menu-bar.tsx) — already present, verify
  - [ ] Confirm `packages/raycast/package.json` `dependencies` includes `@raycast/api`, `@kayman/shared` (workspace), `execa`
- [ ] Task 2: Add a small shared helper for invoking the CLI via execa (AC: 2, 4)
  - [ ] Create `packages/raycast/src/lib/cli.ts` exporting `runKayman(args: string[]): Promise<{ stdout: string; stderr: string }>`
  - [ ] Use `execa('kayman', args, { reject: true })`
  - [ ] On `ENOENT` (binary not on PATH) → throw a typed error `KaymanNotFoundError` with a friendly message: `"kayman CLI not found in PATH. Run \`pnpm link --global\` from packages/cli."`
  - [ ] Export a `showKaymanError(err: unknown)` helper that calls `showToast({ style: Toast.Style.Failure, ... })` with the error message
- [ ] Task 3: Update each stub to import the helper (without implementing real logic — that's Story 4.3) (AC: 2)
  - [ ] All 6 stubs import `runKayman` and `showKaymanError` from `./lib/cli` (even if unused yet) so Story 4.3 starts wired
  - [ ] Leave the existing "Not yet implemented (Story 4.3)" rendering in place
- [ ] Task 4: Verify build & types (AC: 3)
  - [ ] `pnpm --filter kayman typecheck` (or `cd packages/raycast && tsc --noEmit`) passes
  - [ ] `pnpm --filter kayman lint` passes
  - [ ] Confirm `tsconfig.json` `jsx` is set for Raycast (`react-jsx`) — verify, do not regress
- [ ] Task 5: Document local Raycast dev workflow (AC: 1)
  - [ ] Add a section to repo `README.md` (or `packages/raycast/README.md`) covering: `pnpm install`, `cd packages/cli && pnpm link --global`, `cd packages/raycast && pnpm dev` (which runs `ray develop`)

## Dev Notes

### Current State Snapshot (2026-04-08)

Most of the scaffold is **already present** from earlier work (per `architecture.md` and the existing files):

- ✅ `packages/raycast/package.json` declares all 6 commands
- ✅ `packages/raycast/.npmrc` has `node-linker=hoisted`
- ✅ `packages/raycast/src/{start,stop,last,memo,status,menu-bar}.tsx` exist as stubs
- ✅ `execa@^9.0.0` and `@raycast/api@^1.104.5` are dependencies
- ❌ No shared `runKayman` helper exists yet — this is the main net-new code

This story is **mostly verification + the small `lib/cli.ts` helper**. Do not over-engineer.

### `lib/cli.ts` Skeleton

```typescript
import { execa, ExecaError } from 'execa'
import { showToast, Toast } from '@raycast/api'

export class KaymanNotFoundError extends Error {
  constructor() {
    super('kayman CLI not found in PATH. Run `pnpm link --global` from packages/cli.')
    this.name = 'KaymanNotFoundError'
  }
}

export async function runKayman(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execa('kayman', args, { reject: true })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new KaymanNotFoundError()
    }
    throw err
  }
}

export async function showKaymanError(err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await showToast({ style: Toast.Style.Failure, title: 'kayman error', message })
}
```

### Why `node-linker=hoisted` is Mandatory

Raycast's bundler (esbuild via `ray develop`) does **not** follow pnpm's symlinked `node_modules` layout — it requires hoisted modules. Without `.npmrc`, `@kayman/shared` and React types fail to resolve. This was discovered during the original Raycast scaffold (see architecture.md line 116).

### Boundary Rules

Per architecture (line 578):

| Package | DOES | DOES NOT |
|---|---|---|
| `raycast` | Render Raycast UI, invoke CLI via execa | Call whisper / AI SDK / Notion API directly |

**Story 4.3 will be the first to render real UI.** This story keeps all logic in stubs and only adds the shared helper.

### What This Story Does NOT Do

- Implement any real command logic (that's Story 4.3)
- Add a menu-bar polling loop (that's Story 4.4)
- Publish to the Raycast Store
- Add CLI args parsing or completion (Story 4.5)

If you find yourself writing more than the `lib/cli.ts` helper + 6 import lines in the stubs, you're doing too much. Stop and re-read this story.

### Project Structure Notes

- Add: `packages/raycast/src/lib/cli.ts` (new file)
- Modify: `packages/raycast/src/start.tsx`, `stop.tsx`, `last.tsx`, `memo.tsx`, `status.tsx`, `menu-bar.tsx` (add imports only)
- Verify only (no edits expected): `packages/raycast/package.json`, `packages/raycast/.npmrc`, `packages/raycast/tsconfig.json`
- Optional: add `packages/raycast/README.md` with dev workflow

### Testing Standards

- No unit tests for Raycast stubs (Raycast UI testing is non-trivial and not worth the harness for a stub-wiring story)
- Manual test plan: `pnpm dev`, open Raycast, confirm all 6 commands listed under "kayman"
- Smoke test: trigger one stub, confirm "Not yet implemented (Story 4.3)" renders

### Known Risks

- **`kayman` not on PATH:** First-time users who haven't run `pnpm link --global` will hit `ENOENT`. The `KaymanNotFoundError` path covers this with an actionable message — Story 4.3 must surface it via `showKaymanError`.
- **execa v9 ESM-only:** Already a dep. Raycast extensions are ESM-friendly, no concern.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Directory-Structure] — `packages/raycast/` layout
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries] — Raycast → CLI via execa rule
- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation] — `node-linker=hoisted` rationale (line 116)
- [Source: packages/raycast/package.json] — current scaffold
- [Source: packages/raycast/.npmrc] — already configured
- [Source: packages/raycast/src/last.tsx] — stub pattern to mirror

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
