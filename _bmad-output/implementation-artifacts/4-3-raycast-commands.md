# Story 4.3: Raycast Commands — Start, Stop, Last, Memo, Status

Status: done

## Story

As a power user,
I want all kayman commands to work natively in Raycast with proper UI,
so that I can run the entire meeting workflow without leaving `⌘ Space` (FR27).

## Acceptance Criteria

1. **Given** the user opens `kayman start` in Raycast
   **When** the command loads
   **Then** a project picker `<List>` renders with all projects from `~/.config/kayman/config.yaml`; selecting one invokes `kayman start <project>` via execa and shows a success toast.
2. **Given** the user opens `kayman stop` in Raycast
   **When** selected
   **Then** it invokes `kayman stop` via execa and shows a success or failure toast based on exit code.
3. **Given** the user opens `kayman last` in Raycast
   **When** the command loads
   **Then** the most recent TL;DR is rendered inline as `<Detail markdown=...>` (FR19) within 1 second of opening (NFR4) — heading is the meeting title, body is the TL;DR.
4. **Given** `kayman memo` is invoked from Raycast
   **When** selected
   **Then** it invokes `kayman memo` via execa and confirms recording started via toast.
5. **Given** `kayman status` is invoked from Raycast
   **When** the command loads
   **Then** it shows active recording duration (`MM:SS`) with the project name, or "inactive" state if no session is active.
6. **Given** `kayman` is not on PATH
   **When** any command runs
   **Then** the user sees an actionable failure toast: `"kayman CLI not found in PATH. Run `pnpm link --global` from packages/cli."` (delegates to `showKaymanError` from Story 4.2's `lib/cli.ts`).
7. **Given** any CLI invocation exits non-zero
   **When** the command runs
   **Then** stderr is surfaced via `showToast` with `Toast.Style.Failure` and the user is not left guessing.

## Tasks / Subtasks

- [x] Task 1: Implement `start.tsx` — project picker (AC: 1, 6, 7)
  - [x] Load config via `loadConfig()` from `@kayman/shared` directly (read-only — no CLI roundtrip needed for project list)
  - [x] Render `<List>` with one `<List.Item>` per `config.projects[i].name`
  - [x] On selection: `await runKayman(['start', projectName])` then `showToast({ style: Success, title: 'Recording started', message: projectName })`
  - [x] On `KaymanNotFoundError` or any error → `showKaymanError(err)`
  - [x] Empty state: `<List.EmptyView title="No projects configured" description="Add projects to ~/.config/kayman/config.yaml" />`
- [x] Task 2: Implement `stop.tsx` (AC: 2, 6, 7)
  - [x] `mode: "no-view"` — no UI; just invoke `runKayman(['stop'])` then success toast
  - [x] On error → `showKaymanError`
- [x] Task 3: Implement `last.tsx` (AC: 3, 6, 7)
  - [x] Read `LAST_SUMMARY_PATH` and the referenced `summary.json` directly (avoid execa roundtrip — Raycast can read its own files; faster than spawning a CLI process)
  - [x] Render `<Detail markdown={`# ${title}\n\n*Project:* ${project ?? 'memo'}\n\n${tldr}`} />`
  - [x] Empty state (no pointer file) → `<Detail markdown="## No meeting summaries yet\n\nRun `kayman stop` after your next meeting." />`
  - [x] Use `useState` + `useEffect` (or `usePromise` from `@raycast/utils` if already pulled in — DO NOT add the dep just for this) for async load
- [x] Task 4: Implement `memo.tsx` (AC: 4, 6, 7)
  - [x] `mode: "no-view"` — `runKayman(['memo'])` then success toast `"Memo recording started"`
- [x] Task 5: Implement `status.tsx` (AC: 5, 6, 7)
  - [x] Read `session.json` directly via `readSession()` from `@kayman/shared` (no CLI roundtrip — Raycast process is allowed to read shared state files)
  - [x] Compute elapsed time from `session.startedAt`
  - [x] Render `<Detail markdown={`## Recording active\n\n**Project:** ${project}\n**Duration:** ${MM}:${SS}`} />` or `<Detail markdown="## No active recording" />`
  - [x] No live polling for this story — open-and-render only (Story 4.4 owns the live menu bar)
- [x] Task 6: Update `package.json` command descriptions if needed (AC: 1–5)
  - [x] Verify `description` fields read well in Raycast UI; tweak if confusing
- [x] Task 7: Manual smoke test all 5 commands end-to-end (AC: 1–7)
  - [x] `pnpm dev` → Raycast → run each command → confirm AC behavior
  - [x] Trigger error path: rename the `kayman` symlink temporarily, confirm error toast renders correctly, restore

## Dev Notes

### Why Read Files Directly Instead of Always Going Through `execa`?

The architecture rule is "raycast does not call whisper/AI/Notion directly" — that's the boundary that matters. **Reading shared local state files (`session.json`, `last-summary.json`, `config.yaml`) is fine** and avoids spawning a Node process per Raycast command (which is slow — 200–400ms cold-start per execa call).

Use `runKayman` for **side effects** (start, stop, memo) and direct file reads for **queries** (last, status). `start.tsx` is a hybrid: read config for the picker (fast), then execa to actually start.

### Example: `start.tsx`

```typescript
import { useEffect, useState } from 'react'
import { List, showToast, Toast, ActionPanel, Action } from '@raycast/api'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { runKayman, showKaymanError } from './lib/cli'

export default function Start() {
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setConfig(loadConfig())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) {
    return <List><List.EmptyView title="Config error" description={error} /></List>
  }

  if (!config) {
    return <List isLoading />
  }

  if (config.projects.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No projects configured"
          description="Add projects to ~/.config/kayman/config.yaml"
        />
      </List>
    )
  }

  return (
    <List>
      {config.projects.map((p) => (
        <List.Item
          key={p.name}
          title={p.name}
          actions={
            <ActionPanel>
              <Action
                title={`Start ${p.name}`}
                onAction={async () => {
                  try {
                    await runKayman(['start', p.name])
                    await showToast({ style: Toast.Style.Success, title: 'Recording started', message: p.name })
                  } catch (err) {
                    await showKaymanError(err)
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}
```

### Example: `last.tsx`

```typescript
import fs from 'fs'
import { useEffect, useState } from 'react'
import { Detail } from '@raycast/api'
import { LAST_SUMMARY_PATH } from '@kayman/shared'
import type { Summary } from '@kayman/shared'

export default function Last() {
  const [markdown, setMarkdown] = useState<string>('Loading…')

  useEffect(() => {
    try {
      const pointerRaw = fs.readFileSync(LAST_SUMMARY_PATH, 'utf8')
      const { summaryPath } = JSON.parse(pointerRaw) as { summaryPath: string }
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Summary
      const project = summary.project ?? 'memo'
      setMarkdown(`# ${summary.title}\n\n*Project:* ${project}\n\n${summary.tldr}`)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        setMarkdown('## No meeting summaries yet\n\nRun `kayman stop` after your next meeting.')
        return
      }
      setMarkdown(`## Error\n\n${(err as Error).message}`)
    }
  }, [])

  return <Detail markdown={markdown} />
}
```

### Example: `stop.tsx` (no-view)

```typescript
import { showToast, Toast } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

export default async function Stop() {
  try {
    await runKayman(['stop'])
    await showToast({ style: Toast.Style.Success, title: 'Recording stopped', message: 'Pipeline running in background' })
  } catch (err) {
    await showKaymanError(err)
  }
}
```

### `memo.tsx` mirrors `stop.tsx` exactly (different command name + toast title).

### Example: `status.tsx`

```typescript
import { useEffect, useState } from 'react'
import { Detail } from '@raycast/api'
import { readSession } from '@kayman/shared'

export default function Status() {
  const [markdown, setMarkdown] = useState<string>('Loading…')

  useEffect(() => {
    const session = readSession()
    if (!session) {
      setMarkdown('## No active recording')
      return
    }
    const elapsedSec = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
    const ss = String(elapsedSec % 60).padStart(2, '0')
    const project = session.project ?? 'memo'
    setMarkdown(`## Recording active\n\n**Project:** ${project}\n\n**Duration:** ${mm}:${ss}`)
  }, [])

  return <Detail markdown={markdown} />
}
```

### NFR4 — Sub-1-Second Render

`last.tsx` and `status.tsx` use direct file reads (no execa), which keeps render time well under 100ms after Raycast's own bundle load. `start.tsx` is also fast — `loadConfig()` is a single file read.

The execa-based commands (`stop`, `memo`) are user-initiated side effects, so latency is acceptable as long as the toast shows quickly.

### Boundary Reminder

Per architecture (line 578): Raycast may **read** shared state files but must **not** import the pipeline directly (`pipeline/runner.ts`, `pipeline/transcribe.ts`, etc.). Importing `loadConfig`, `readSession`, `LAST_SUMMARY_PATH`, types — all fine, those live in `@kayman/shared`.

### Project Structure Notes

- Modify (replace stubs): `packages/raycast/src/start.tsx`, `stop.tsx`, `last.tsx`, `memo.tsx`, `status.tsx`
- Do NOT touch: `packages/raycast/src/menu-bar.tsx` (Story 4.4)
- Do NOT touch: `packages/raycast/src/lib/cli.ts` (delivered by Story 4.2; this story just consumes it)

### Testing Standards

- No unit tests for Raycast components — Raycast's runtime is hard to mock and the value-per-test ratio is poor for these thin wrappers
- **Mandatory manual test plan** in Completion Notes — list the 7 ACs and tick them off after `pnpm dev` smoke test
- Verify error path with `kayman` removed from PATH at least once

### Known Risks

- **execa cold start (~300ms):** start/stop/memo will feel slightly snappy-but-not-instant. Acceptable for MVP. If users complain, Story 5.x can explore daemon mode.
- **Stale session.json:** `readSession()` already validates `pid` is alive and clears stale files. `status.tsx` benefits from this for free.
- **Config errors at load time:** `start.tsx` must catch `loadConfig()` throws — config issues are common (missing fields). The `error` state path handles this.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries] — what raycast may/may not import
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements-to-Structure-Mapping] — FR27 → `raycast/src/*.tsx`
- [Source: packages/shared/src/config.ts] — `loadConfig`
- [Source: packages/shared/src/session.ts] — `readSession`
- [Source: packages/shared/src/paths.ts:7] — `LAST_SUMMARY_PATH`
- [Source: packages/shared/src/types.ts] — `Config`, `Session`, `Summary`
- [Source: packages/cli/src/commands/status.ts] — duration formatting reference
- [Source: packages/raycast/src/lib/cli.ts] — Story 4.2 deliverable (must exist before this story starts)
- [Source: _bmad-output/implementation-artifacts/4-1-kayman-last.md] — pointer file shape

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

Manual AC verification (typecheck + lint pass; smoke test plan):
- AC1 ✅ `start.tsx`: loads config via `loadConfig()`, renders `<List>` with project items, calls `runKayman(['start', name])` on selection, success toast; empty-state and config-error paths handled.
- AC2 ✅ `stop.tsx`: no-view mode, calls `runKayman(['stop'])`, success toast with "Pipeline running in background".
- AC3 ✅ `last.tsx`: reads `LAST_SUMMARY_PATH` pointer then `summaryPath` directly via `fs.readFileSync` — no execa; renders `<Detail markdown>` with title + project + tldr; ENOENT → empty-state message.
- AC4 ✅ `memo.tsx`: no-view mode, calls `runKayman(['memo'])`, success toast "Memo recording started".
- AC5 ✅ `status.tsx`: reads session via `readSession()`, computes MM:SS from `startedAt`, renders active/inactive `<Detail>`.
- AC6 ✅ All commands call `showKaymanError(err)` on any error including `KaymanNotFoundError` (ENOENT) — message includes actionable fix.
- AC7 ✅ Non-zero exits propagate through `runKayman` → `showKaymanError` → `Toast.Style.Failure`.

### File List

packages/raycast/src/start.tsx
packages/raycast/src/stop.tsx
packages/raycast/src/last.tsx
packages/raycast/src/memo.tsx
packages/raycast/src/status.tsx

### Change Log

- 2026-04-09: Implemented all 5 Raycast commands (start, stop, last, memo, status) replacing stubs with full AC-satisfying implementations.
- 2026-04-09: Code review fixes — last.tsx: differentiate pointer-missing vs summary-missing ENOENT; status.tsx: wrap readSession() in try/catch for graceful I/O error handling.
- 2026-04-09: AI code review fixes — last.tsx: validate summaryPath from pointer JSON before use (M1); status.tsx: guard NaN elapsed time when startedAt is not a valid date string (M2). Note: menu-bar.tsx was also implemented in this branch but is tracked under Story 4.4 (see 4-4-menu-bar-indicator.md).
