# Story B2: Raycast Extension Icon

Status: ready-for-dev

## Story

As a power user,
I want the kayman Raycast extension to display the kayman logo as its icon,
so that the extension is visually identifiable in Raycast's command list.

## Acceptance Criteria

1. **Given** the kayman Raycast extension is loaded
   **When** viewed in Raycast's extension list or command results
   **Then** the kayman logo is shown as the extension icon

2. **Given** `packages/raycast/assets/icon.png` exists
   **When** the extension is built or run in dev mode
   **Then** Raycast uses it as the icon (no placeholder or default icon)

3. **Given** `packages/raycast/package.json` has `"icon": "icon.png"`
   **When** the extension loads
   **Then** no change to `package.json` is needed (already correct)

## Tasks / Subtasks

- [ ] Task 1: Copy `packages/shared/assets/kayman.png` to `packages/raycast/assets/icon.png` (AC: 1, 2)
  - [ ] Ensure `packages/raycast/assets/` directory exists (check first)
  - [ ] Copy the file: `cp packages/shared/assets/kayman.png packages/raycast/assets/icon.png`
  - [ ] Verify the file was copied and is a valid PNG
- [ ] Task 2: Verify `packages/raycast/package.json` icon field (AC: 3)
  - [ ] Confirm `"icon": "icon.png"` is already set (it is — line 4 of current package.json)
  - [ ] No changes needed
- [ ] Task 3: Verify extension loads with new icon
  - [ ] Open Raycast → trigger any kayman command → confirm the logo appears
  - [ ] Check: Raycast requires 512×512 PNG — verify `kayman.png` meets this requirement

## Dev Notes

### Source File

`packages/shared/assets/kayman.png` — exists and is tracked in git (shows as untracked in current working tree, likely recently added).

### Destination

`packages/raycast/assets/icon.png` — Raycast reads this file based on `"icon": "icon.png"` in `package.json`. The `assets/` directory is the conventional location for Raycast extension assets.

### Raycast Icon Requirements

- Format: PNG
- Size: 512×512 pixels (recommended)
- Raycast will scale it for display, but 512×512 ensures sharp rendering

If `kayman.png` is not exactly 512×512, Raycast will still use it but may appear pixelated or letterboxed. Check the dimensions before copying:
```bash
file packages/shared/assets/kayman.png
# or:
sips -g pixelWidth -g pixelHeight packages/shared/assets/kayman.png
```

If resize is needed, use `sips`:
```bash
sips -z 512 512 packages/shared/assets/kayman.png --out packages/raycast/assets/icon.png
```

### Current State

`packages/shared/assets/` directory is untracked in git (per git status). The file `kayman.png` needs to be committed first OR this story can commit both the shared asset and the raycast icon in one go.

### Project Structure Notes

**New files:**
- `packages/raycast/assets/icon.png` (copied from shared assets)

**No code changes** — asset copy only.

**Note:** If `packages/raycast/assets/` doesn't exist yet, create it:
```bash
mkdir -p packages/raycast/assets
```

### References

- [Source: packages/raycast/package.json#L4] — `"icon": "icon.png"` confirms expected path
- [Source: packages/shared/assets/kayman.png] — source asset to copy

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
