# Story B3: macOS Notification Icon

Status: review

## Story

As a power user,
I want kayman macOS notifications to show the kayman logo instead of the default terminal icon,
so that I can immediately identify kayman notifications in my notification center.

## Acceptance Criteria

1. **Given** any pipeline stage fires a notification (`notify`, `notifyCustom`, `notifyError`)
   **When** the notification appears
   **Then** the kayman logo is shown as the notification icon

2. **Given** the CLI is run from any working directory
   **When** a notification fires
   **Then** the asset path resolves correctly (absolute path, not relative to CWD)

3. **Given** all three notify functions (`notify`, `notifyCustom`, `notifyError`)
   **When** called
   **Then** all include the `contentImage` field pointing to `kayman.png`

4. **Given** notification content and title
   **When** icon is added
   **Then** no regression on message text, title, or notification behavior

## Tasks / Subtasks

- [x] Task 1: Resolve the absolute path to `kayman.png` in `packages/shared/src/notify.ts` (AC: 2)
  - [x] Added `shims: true` to shared tsup.config.ts so `__dirname` is shimmed for ESM builds
  - [x] Used `path.resolve(__dirname, '../assets/kayman.png')` — resolves correctly from dist/ to assets/
  - [x] Added `fs.existsSync` guard so notifications work even if asset is missing
- [x] Task 2: Add `contentImage` to all three notify functions (AC: 1, 3, 4)
  - [x] In `notify()`: spread `iconField` (contains `contentImage: ICON_PATH` when asset exists)
  - [x] In `notifyCustom()`: spread `iconField`
  - [x] In `notifyError()`: spread `iconField`
- [x] Task 3: Ensure asset is accessible at runtime (AC: 1, 2)
  - [x] `packages/shared/assets/kayman.png` is a sibling to `dist/` — accessible at runtime
  - [x] Path verified: resolves to correct location, fs.existsSync returns true

## Dev Notes

### Path Resolution Strategy

`notify.ts` is compiled by tsup to `packages/shared/dist/`. The source is at `packages/shared/src/notify.ts`. The asset is at `packages/shared/assets/kayman.png`.

**After build:** the compiled `dist/notify.js` is at `packages/shared/dist/notify.js`. The asset is at `packages/shared/assets/kayman.png`.

Relative path from `dist/notify.js` to the asset: `../assets/kayman.png`.

```ts
// For CJS output (tsup default for shared):
import path from 'path'
const ICON_PATH = path.resolve(__dirname, '../../assets/kayman.png')
// __dirname in dist/notify.js = packages/shared/dist/
// ../../assets/ = packages/shared/assets/  ✓
```

For ESM output:
```ts
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICON_PATH = path.resolve(__dirname, '../../assets/kayman.png')
```

**Check the tsup config first:**
```bash
cat packages/shared/package.json | grep -A5 tsup
# or check tsup.config.ts / tsup.config.js if present
```

### node-notifier `contentImage` Field

```ts
notifier.notify({
  title: 'kayman',
  message: STAGE_MESSAGES[stage],
  contentImage: ICON_PATH,   // ← add this to all three functions
})
```

`contentImage` sets the content image on macOS (shown below the notification text). For app icon (the small icon in the top-left), use `icon` field instead. The appropriate field depends on desired visual:
- `icon`: replaces the app icon (top-left) — requires absolute path to a `.png`
- `contentImage`: shown as content image below text

For maximum brand impact: use `icon` (replaces terminal icon). Try both and use whichever looks better.

### Runtime Existence Check

Add a guard to avoid silent failures if the asset is missing:
```ts
import fs from 'fs'
const ICON_PATH = path.resolve(__dirname, '../../assets/kayman.png')
const ICON_EXISTS = fs.existsSync(ICON_PATH)
```

Then in each notify call:
```ts
notifier.notify({
  title: 'kayman',
  message: ...,
  ...(ICON_EXISTS ? { contentImage: ICON_PATH } : {}),
})
```

This ensures notifications still work even if the asset is missing (e.g., in a stripped production install).

### Dependency on B2 (Partial)

Story B2 adds `packages/shared/assets/kayman.png` via copying. This story (B3) uses the same source file from `packages/shared/assets/`. Since `packages/shared/assets/kayman.png` already exists (visible in git status as untracked), this story can proceed independently.

### Project Structure Notes

**Modified files:**
- `packages/shared/src/notify.ts` — add `ICON_PATH` constant and `contentImage` field to all three notify calls

**No new files needed** (asset already exists at `packages/shared/assets/kayman.png`).

### References

- [Source: packages/shared/src/notify.ts] — all three notify functions to modify
- [Source: packages/shared/assets/kayman.png] — the icon asset (already present)
- [Source: _bmad-output/new-stories.md#Story-3-macOS-Notification-Icon] — full requirements

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Debug Log References
- Dev Notes path `../../assets/kayman.png` was incorrect; corrected to `../assets/kayman.png` (dist/ is one level below package root, not two)

### Completion Notes List
- Added `shims: true` to packages/shared/tsup.config.ts for __dirname ESM compatibility
- Added ICON_PATH and ICON_EXISTS constants to notify.ts using path.resolve(__dirname, '../assets/kayman.png')
- Spread iconField (contentImage when asset exists) into all three notify functions
- Updated notify.test.ts to use objectContaining to accommodate new contentImage field
- All 59 tests pass; builds succeed

### File List
- packages/shared/src/notify.ts (modified)
- packages/shared/src/notify.test.ts (modified)
- packages/shared/tsup.config.ts (modified)
