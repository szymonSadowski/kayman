# Story 4.2: Raycast Extension Scaffold & Command Stubs

Status: done

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

- [x] Task 1: Audit existing scaffold against AC1 (AC: 1)
  - [x] Confirm `packages/raycast/package.json` lists all 6 commands (start, stop, last, memo, status, menu-bar) with correct `mode` values — already present, verify no drift
  - [x] Confirm `packages/raycast/.npmrc` contains `node-linker=hoisted` — already present, verify
  - [x] Confirm all 6 stub files exist under `packages/raycast/src/` (start.tsx, stop.tsx, last.tsx, memo.tsx, status.tsx, menu-bar.tsx) — already present, verify
  - [x] Confirm `packages/raycast/package.json` `dependencies` includes `@raycast/api`, `@kayman/shared` (workspace), `execa`
- [x] Task 2: Add a small shared helper for invoking the CLI via execa (AC: 2, 4)
  - [x] Create `packages/raycast/src/lib/cli.ts` exporting `runKayman(args: string[]): Promise<{ stdout: string; stderr: string }>`
  - [x] Use `execa('kayman', args, { reject: true })`
  - [x] On `ENOENT` (binary not on PATH) → throw a typed error `KaymanNotFoundError` with a friendly message: `"kayman CLI not found in PATH. Run \`pnpm link --global\` from packages/cli."`
  - [x] Export a `showKaymanError(err: unknown)` helper that calls `showToast({ style: Toast.Style.Failure, ... })` with the error message
- [x] Task 3: Update each stub to import the helper (without implementing real logic — that's Story 4.3) (AC: 2)
  - [x] All 6 stubs import `runKayman` and `showKaymanError` from `./lib/cli` (even if unused yet) so Story 4.3 starts wired
  - [x] Leave the existing "Not yet implemented (Story 4.3)" rendering in place
- [x] Task 4: Verify build & types (AC: 3)
  - [x] `pnpm --filter kayman typecheck` (or `cd packages/raycast && tsc --noEmit`) passes
  - [x] `pnpm --filter kayman lint` passes
  - [x] Confirm `tsconfig.json` `jsx` is set for Raycast (`react-jsx`) — verify, do not regress
- [x] Task 5: Document local Raycast dev workflow (AC: 1)
  - [x] Add a section to repo `README.md` (or `packages/raycast/README.md`) covering: `pnpm install`, `cd packages/cli && pnpm link --global`, `cd packages/raycast && pnpm dev` (which runs `ray develop`)

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

- `pnpm --filter kayman typecheck` → clean
- `pnpm --filter kayman lint` → clean
- `pnpm run typecheck` (full monorepo) → 4 tasks successful
- `pnpm run lint` (full monorepo) → 0 errors (3 pre-existing warnings in `@kayman/shared/src/session.test.ts`, unrelated)
- `pnpm run test` (full monorepo) → 60 tests passing across 10 files

### Completion Notes List

- AC1 ✅: All 6 commands declared in `packages/raycast/package.json` with correct titles, descriptions, and modes (start=view, stop=no-view, last=view, memo=no-view, status=view, menu-bar=menu-bar). `.npmrc` already had `node-linker=hoisted`. All 6 stub files present.
- AC2 ✅: `packages/raycast/src/lib/cli.ts` added with `runKayman(args)` (uses `execa('kayman', args, { reject: true })`), `KaymanNotFoundError` (typed `ENOENT` translation), and `showKaymanError()` helper. All 6 stubs import both helpers (referenced via `void` so unused-warning doesn't fire while real logic is deferred to Story 4.3 / 4.4).
- AC3 ✅: `tsc --noEmit` passes for `kayman` (raycast). `tsconfig.json` `jsx: "react-jsx"` confirmed. Eslint clean.
- AC4 ✅: `runKayman` invokes `execa('kayman', ...)` (no absolute path) and translates `ENOENT` to `KaymanNotFoundError` with the actionable message `"kayman CLI not found in PATH. Run \`pnpm link --global\` from packages/cli."`. Stubs are wired so Story 4.3 can call `showKaymanError(err)` to surface a Failure toast.
- Per story Testing Standards, no Raycast UI tests added (Raycast harness not worth it for stub-wiring).
- **Out-of-scope unblock:** Hook (`pnpm run typecheck && pnpm run lint`) was failing on pre-existing breakage in `@kayman/cli` from commit `3123b5a` (moduleResolution → Node16): `TS1479` on `@inquirer/select` static import in CJS, and `TS2835` on extension-less dynamic imports in 5 pipeline test files. Fixed in this story (with user approval) so the hook unblocks: converted `@inquirer/select` to a dynamic `await import()` in `start.ts`, replaced static mock import in `start.test.ts` with `vi.hoisted` + `selectMock`, added `.js` extensions to ~30 dynamic `await import('./xxx')` calls across `runner.test.ts`, `summarize.test.ts`, `transcribe.test.ts`, `provider.test.ts`, `export.test.ts`. All 60 cli tests still pass.

### File List

**Story 4.2 (in-scope):**
- `packages/raycast/src/lib/cli.ts` (new)
- `packages/raycast/src/start.tsx` (modified — wire helper imports)
- `packages/raycast/src/stop.tsx` (modified — wire helper imports)
- `packages/raycast/src/last.tsx` (modified — wire helper imports)
- `packages/raycast/src/memo.tsx` (modified — wire helper imports)
- `packages/raycast/src/status.tsx` (modified — wire helper imports)
- `packages/raycast/src/menu-bar.tsx` (modified — wire helper imports)
- `packages/raycast/README.md` (new — local dev workflow)
- `_bmad-output/implementation-artifacts/4-2-raycast-scaffold.md` (this story)

**Out-of-scope unblock (pre-existing cli breakage):**
- `packages/cli/src/commands/start.ts` (modified — dynamic import of `@inquirer/select`)
- `packages/cli/src/commands/start.test.ts` (modified — `vi.hoisted` mock for `@inquirer/select`)
- `packages/cli/src/pipeline/runner.test.ts` (modified — `.js` extensions on dynamic imports)
- `packages/cli/src/pipeline/summarize.test.ts` (modified — `.js` extensions on dynamic imports)
- `packages/cli/src/pipeline/transcribe.test.ts` (modified — `.js` extensions on dynamic imports)
- `packages/cli/src/pipeline/provider.test.ts` (modified — `.js` extensions on dynamic imports)
- `packages/cli/src/pipeline/export.test.ts` (modified — `.js` extensions on dynamic imports)

## Change Log

- 2026-04-08 — Story 4.2 implemented: added `lib/cli.ts` helper (runKayman / KaymanNotFoundError / showKaymanError), wired imports into all 6 Raycast stubs, added `packages/raycast/README.md`. Also fixed pre-existing `@kayman/cli` typecheck breakage from commit `3123b5a` (Node16 moduleResolution) so the test suite/hook unblocks.
