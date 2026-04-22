# Story R2: Auto-Updating Menubar Timer

Status: ready-for-dev

## Story

As a power user,
I want the menu bar timer to count up in real time without clicking,
so that I can glance at my menu bar and see the live recording duration.

## Acceptance Criteria

1. **Given** a recording is active and the menu bar extension is running
   **When** time passes
   **Then** the timer updates automatically (e.g. `⏺ 00:12` → `⏺ 00:13`) without any user interaction

2. **Given** `kayman stop` is run and the session is cleared
   **When** the next refresh cycle fires
   **Then** the menu bar returns to inactive state (`⏺ kayman`) within the interval

3. **Given** no recording is active
   **When** the extension is running
   **Then** it shows the inactive state without excessive refresh overhead

4. **Given** the `useEffect` interval runs alongside Raycast's refresh cycle
   **When** both fire
   **Then** no duplicate ticking, state corruption, or visible stutter occurs

## Tasks / Subtasks

- [ ] Task 1: Add `"interval"` to menu-bar command in `packages/raycast/package.json` (AC: 1, 2)
  - [ ] Locate the `menu-bar` entry in the `commands` array
  - [ ] Add `"interval": "1s"` to the menu-bar command object
  - [ ] This tells Raycast to re-execute the menubar command every 1 second
- [ ] Task 2: Audit `menu-bar.tsx` for interval/refresh conflicts (AC: 3, 4)
  - [ ] Verify that `useEffect` with `setInterval(tick, 1000)` still works correctly alongside Raycast's refresh cycle
  - [ ] When Raycast refreshes the component (re-mounts), the `useEffect` will re-run — this is correct behavior (cleanup via `clearInterval` return)
  - [ ] Check if `useState` for `now` is still needed given Raycast refreshes every 1s; simplify if redundant
- [ ] Task 3: Simplify `menu-bar.tsx` if `useEffect` interval is now redundant (AC: 4)
  - [ ] With `"interval": "1s"` in package.json, Raycast re-mounts the component every second
  - [ ] The `setInterval` in `useEffect` is now redundant — consider removing to avoid double-tick
  - [ ] Simplified version: remove `useEffect`, call `readSession()` and `Date.now()` directly at render time

## Dev Notes

### The Core Fix

Add `"interval": "1s"` to `menu-bar` entry in `packages/raycast/package.json`:

```json
{
  "name": "menu-bar",
  "title": "Recording Indicator",
  "description": "Live recording duration in the menu bar",
  "mode": "menu-bar",
  "interval": "1s"
}
```

Without this, Raycast only re-renders the menubar command on user interaction (clicking the icon). With `"interval": "1s"`, Raycast polls and re-renders every second automatically.

### Current Implementation Issue

`menu-bar.tsx` has a `useEffect` with `setInterval(tick, 1000)` that calls `setNow(Date.now())` and `setSession(readSession())`. This was the intended auto-update mechanism, but **Raycast menubar commands don't re-render from React state changes without the `interval` key** — React state updates only work if Raycast allows re-rendering.

### Simplified Implementation (Recommended)

With `"interval": "1s"`, Raycast re-mounts the component each second. The `useEffect` interval is no longer needed:

```tsx
export default function MenuBar() {
  // Raycast re-mounts every 1s — no need for setInterval
  const session = readSession()
  const now = Date.now()

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
          } catch { /* ignore */ }
        }}
      />
    </MenuBarExtra>
  )
}
```

This is cleaner and avoids any interaction between `setInterval` and Raycast's re-mount cycle.

### Note on `"interval"` Valid Values

Raycast supports: `"1s"`, `"5s"`, `"10s"`, `"30s"`, `"1m"`, `"5m"`, `"10m"`, `"30m"`, `"1h"`

Use `"1s"` for live timer precision.

### Project Structure Notes

**Modified files:**
- `packages/raycast/package.json` — add `"interval": "1s"` to menu-bar command
- `packages/raycast/src/menu-bar.tsx` — simplify by removing `useEffect`/`useState` if going with simplified approach

### References

- [Source: packages/raycast/src/menu-bar.tsx] — current implementation
- [Source: packages/raycast/package.json] — commands array where `interval` is added

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
