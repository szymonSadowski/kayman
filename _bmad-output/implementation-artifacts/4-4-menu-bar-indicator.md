# Story 4.4: Menu Bar Recording Indicator

Status: review

## Story

As a power user,
I want a live recording duration indicator in the macOS menu bar while a session is active,
so that I can confirm recording is running without switching windows (FR28).

## Acceptance Criteria

1. **Given** `kayman start` has been run and a session is active
   **When** the menu-bar extension is running
   **Then** the menu-bar item shows the recording duration updating every second in the format `⏺ MM:SS` (e.g. `⏺ 12:34`).
2. **Given** no session is active
   **When** the menu-bar extension is running
   **Then** the menu-bar item shows a neutral/inactive title `⏺ kayman` (do **not** hide the item — Raycast menu-bar extras render `null` titles oddly; keep a stable presence).
3. **Given** the extension polls `session.json` every 1 second
   **When** `kayman stop` is run and `session.json` is deleted
   **Then** the menu-bar indicator updates to inactive state within 1–2 seconds (one poll cycle).
4. **Given** the menu-bar extra is open
   **When** the user clicks `Stop Recording`
   **Then** it invokes `kayman stop` via execa (reusing `runKayman` from Story 4.2) and the indicator transitions to inactive on the next poll.
5. **Given** the menu-bar extra is open and a session is active
   **When** the user clicks `Show Status`
   **Then** the kayman `status` Raycast command is opened (or — if simpler — a toast displays the same info).

## Tasks / Subtasks

- [x] Task 1: Implement `menu-bar.tsx` with polling (AC: 1, 2, 3)
  - [x] Use `MenuBarExtra` from `@raycast/api`
  - [x] Poll `readSession()` from `@kayman/shared` every 1000ms via `setInterval` inside `useEffect`
  - [x] Compute elapsed seconds → `MM:SS` (zero-padded)
  - [x] Active title: `⏺ ${MM}:${SS}` ; inactive title: `⏺ kayman`
  - [x] Clear interval on unmount
- [x] Task 2: Add `MenuBarExtra.Item` actions (AC: 4, 5)
  - [x] When active: show `MenuBarExtra.Item title="Stop Recording"` calling `runKayman(['stop'])` then `showToast` on success/error
  - [x] When active: show `MenuBarExtra.Item title="Project: <name>"` (display only, no action) for context
  - [x] When inactive: show `MenuBarExtra.Item title="No active recording"` (display only)
- [x] Task 3: Verify `package.json` declares `menu-bar` command with `mode: "menu-bar"` (AC: 1)
  - [x] Already declared per current `packages/raycast/package.json` — verify only
- [ ] Task 4: Manual smoke test the full lifecycle (AC: 1–5)
  - [ ] `pnpm dev` (Raycast dev mode)
  - [ ] Enable menu-bar extra in Raycast preferences
  - [ ] Run `kayman start <project>` from terminal → menu bar shows `⏺ 00:01`, `⏺ 00:02`, …
  - [ ] Wait 30s, confirm `⏺ 00:30`
  - [ ] Click menu bar → "Stop Recording" → confirm runs `kayman stop`
  - [ ] Within 1–2 seconds, menu bar shows `⏺ kayman`

## Dev Notes

### Why Polling, Not Watching

`fs.watch` on `~/.config/kayman/session.json` is unreliable on macOS for files in user home (FSEvents quirks, kqueue limits with deleted files). Polling at 1Hz is **simpler, robust, and matches the AC** ("polls `session.json` every 1 second"). CPU cost of one `readFileSync` per second is negligible.

### Why `readSession` (not raw `fs.readFileSync`)?

`readSession()` already:
- Returns `null` cleanly when file is missing
- Validates session shape
- Calls `isProcessAlive(pid)` and clears stale session files

That third behavior is important: if the recording process crashes without cleanup, the menu bar will *correctly* show inactive on the next poll because `readSession` self-heals stale files.

**One subtlety:** because `readSession` mutates state (deletes stale files), running it from the menu bar process is fine, but be aware that the menu bar can race with the CLI on file deletion. The race is benign — both cases end with `null`.

### Implementation Skeleton

```typescript
import { useEffect, useState } from 'react'
import { MenuBarExtra, showToast, Toast, launchCommand, LaunchType } from '@raycast/api'
import { readSession } from '@kayman/shared'
import type { Session } from '@kayman/shared'
import { runKayman, showKaymanError } from './lib/cli'

export default function MenuBar() {
  const [session, setSession] = useState<Session | null>(null)
  const [now, setNow] = useState<number>(Date.now())

  useEffect(() => {
    const tick = () => {
      setSession(readSession())
      setNow(Date.now())
    }
    tick() // initial render with real state
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!session) {
    return (
      <MenuBarExtra title="⏺ kayman" tooltip="No active recording">
        <MenuBarExtra.Item title="No active recording" />
      </MenuBarExtra>
    )
  }

  const elapsedSec = Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000))
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')
  const project = session.project ?? 'memo'

  return (
    <MenuBarExtra title={`⏺ ${mm}:${ss}`} tooltip={`Recording: ${project}`}>
      <MenuBarExtra.Item title={`Project: ${project}`} />
      <MenuBarExtra.Item
        title="Stop Recording"
        onAction={async () => {
          try {
            await runKayman(['stop'])
            await showToast({ style: Toast.Style.Success, title: 'Recording stopped' })
          } catch (err) {
            await showKaymanError(err)
          }
        }}
      />
      <MenuBarExtra.Item
        title="Show Status"
        onAction={async () => {
          try {
            await launchCommand({ name: 'status', type: LaunchType.UserInitiated })
          } catch {
            // launchCommand can fail if status command is disabled — ignore silently
          }
        }}
      />
    </MenuBarExtra>
  )
}
```

### NFR3 Reminder

NFR3 says `kayman stop` must return within 1 second — already handled by Story 3.5's detached spawn. The menu bar's "Stop Recording" action also benefits because `runKayman(['stop'])` resolves as soon as the CLI exits (which is sub-1s).

### Performance Budget

- 1 `setInterval` at 1Hz
- 1 `readSession()` per tick = 1 `readFileSync` of a small JSON + 1 `process.kill(pid, 0)` syscall
- 2 `useState` updates per tick (re-render)

Total: well under 1% CPU on modern Macs. If Raycast warns about menu-bar refresh rates, this is below their threshold.

### Edge Cases

- **Session file appears mid-poll:** next tick picks it up — display lag at most 1s. Acceptable.
- **System sleep / wake:** `setInterval` may fire late, but the elapsed-time calculation uses `Date.now()` against `session.startedAt`, so the displayed duration is **wall-clock correct** even if the menu bar was paused.
- **Multiple sessions (shouldn't happen):** `readSession` returns the single canonical session — if `kayman start` is run twice, the second errors out (already enforced by Story 2.3). No menu-bar work needed.
- **Raycast restart:** menu bar re-mounts, polling resumes — no persisted state needed.

### Boundary Reminder

Menu bar reads `session.json` directly (allowed — local state file) and invokes the CLI for side effects via execa (allowed — the boundary rule). Do not import anything from `packages/cli/src/`.

### Project Structure Notes

- Modify (replace stub): `packages/raycast/src/menu-bar.tsx`
- Verify only: `packages/raycast/package.json` declares `menu-bar` command
- Depends on: Story 4.2's `packages/raycast/src/lib/cli.ts`

### Testing Standards

- No unit test (Raycast `MenuBarExtra` runtime is impractical to mock)
- **Mandatory manual test plan** in Completion Notes — include the 5 ACs as a checklist after `pnpm dev`
- Verify the inactive ⇄ active transition specifically (the 1–2s poll-cycle window)

### Known Risks

- **`launchCommand` may fail** if the user has disabled the `status` command in Raycast preferences. Catch and ignore — non-critical UX.
- **Menu bar item width:** `⏺ 12:34` is 7 chars — comfortably narrow. Adding emoji + project name to the title would push it wider; we keep project in the dropdown only.
- **Idle CPU on long sessions:** at 1Hz polling with read-and-validate, ~0.5% CPU sustained. Acceptable.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project-Directory-Structure] — `menu-bar.tsx` location
- [Source: _bmad-output/planning-artifacts/architecture.md#Requirements-to-Structure-Mapping] — FR28 → `raycast/src/menu-bar.tsx`
- [Source: packages/shared/src/session.ts] — `readSession()` self-healing behavior
- [Source: packages/cli/src/commands/status.ts] — elapsed-time formatting reference
- [Source: packages/raycast/src/lib/cli.ts] — Story 4.2 helper (must exist first)
- [Source: packages/raycast/package.json] — `menu-bar` command declaration

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented `menu-bar.tsx` replacing the stub. Uses `useEffect`+`setInterval` at 1Hz polling `readSession()`. Active state shows `⏺ MM:SS` title with Stop Recording and Show Status actions; inactive shows `⏺ kayman` with "No active recording" item.
- Task 3 verified: `packages/raycast/package.json` already declares `menu-bar` command with `mode: "menu-bar"` — no changes needed.
- No unit tests (Raycast `MenuBarExtra` runtime cannot be mocked — per Dev Notes testing standards).
- TypeScript typecheck and ESLint both pass with zero errors.
- **Manual test plan (Task 4 — requires Raycast dev mode):**
  - [ ] AC1: Active → title shows `⏺ 00:01`, `⏺ 00:02`, … incrementing each second
  - [ ] AC2: Inactive → title shows `⏺ kayman`, dropdown shows "No active recording"
  - [ ] AC3: After `kayman stop`, title returns to `⏺ kayman` within 1–2s
  - [ ] AC4: Click "Stop Recording" → `kayman stop` runs, success toast appears
  - [ ] AC5: Click "Show Status" → status command launches (or silently fails if disabled)

### File List

- packages/raycast/src/menu-bar.tsx (modified — replaced stub with full polling implementation)

## Change Log

- 2026-04-09: Implemented Story 4.4 — menu-bar polling indicator with 1Hz readSession(), MM:SS title, Stop Recording and Show Status actions.
