# Story R3: Raycast Installation & Usage Docs

Status: ready-for-dev

## Story

As a new user with kayman CLI installed,
I want clear instructions for installing and using the kayman Raycast extension,
so that I can get the Raycast integration running without asking anyone.

## Acceptance Criteria

1. **Given** a user with kayman CLI already installed reads the Raycast docs
   **When** they follow the instructions
   **Then** they can install and use the Raycast extension without additional help

2. **Given** the documentation covers installation
   **When** read
   **Then** it explains loading the extension in development mode via Raycast's extension panel

3. **Given** the documentation covers all commands
   **When** read
   **Then** every Raycast command is documented: Start, Stop, Status, Last, Memo, Menu Bar

4. **Given** the documentation covers the menu bar
   **When** read
   **Then** it explains how to pin it and what the live timer looks like

5. **Given** a troubleshooting section exists
   **When** a user encounters common issues
   **Then** CLI not found and config errors are addressed

## Tasks / Subtasks

- [ ] Task 1: Create `docs/raycast.md` with full Raycast extension documentation (AC: 1–5)
  - [ ] Prerequisites: kayman CLI installed and working, config at `~/.config/kayman/config.yaml`
  - [ ] Installation section: Raycast → Extensions → `+` → Add Script Directory → point to `packages/raycast`
  - [ ] Commands section: document all 6 commands with purpose and expected behavior
  - [ ] Menu Bar section: pinning instructions, live timer appearance (`⏺ 00:12`)
  - [ ] Troubleshooting section: CLI not found, config errors, extension not loading
- [ ] Task 2: Create `docs/` directory if it doesn't exist (also needed for C4)
  - [ ] Check if `docs/` exists at repo root

## Dev Notes

### Raycast Development Mode Installation

1. Open Raycast → `⌘,` → Extensions tab
2. Click `+` → "Add Script Directory"
3. Navigate to `<repo>/packages/raycast`
4. The extension loads immediately in development mode — no build step needed for usage
5. For a production-quality install: run `pnpm build` in `packages/raycast` first

### All 6 Commands to Document

From `packages/raycast/package.json` `commands` array:
1. **Start Recording** (`start`, mode: `view`) — project picker list; optional tag input (Story R1)
2. **Stop Recording** (`stop`, mode: `no-view`) — runs `kayman stop`, shows success/error toast
3. **Last Meeting** (`last`, mode: `view`) — renders most recent TL;DR inline
4. **Record Memo** (`memo`, mode: `no-view`) — runs `kayman memo`, no project picker
5. **Recording Status** (`status`, mode: `view`) — shows active duration or inactive state
6. **Recording Indicator** (`menu-bar`, mode: `menu-bar`) — live `⏺ MM:SS` timer in menu bar

### Menu Bar Pinning Steps

1. Trigger the command once from Raycast
2. Raycast prompts to "Keep in Menu Bar" — click Yes
3. The `⏺ kayman` icon appears in the macOS menu bar
4. Updates to `⏺ MM:SS` when recording is active (requires Story R2's `"interval"` fix)

### Common Issues

- **"kayman: command not found"**: CLI not in PATH — run `pnpm link --global` or ensure `~/.pnpm/bin` is in `$PATH`
- **"Config error"**: `~/.config/kayman/config.yaml` missing or malformed — run `kayman verify`
- **Extension not loading**: Ensure Node 22+ is active in the shell Raycast uses; try relaunching Raycast after changes
- **Menu bar not updating**: Requires the `"interval": "1s"` fix from Story R2

### Project Structure Notes

**New files:**
- `docs/raycast.md`

**No code changes** — documentation only.

### References

- [Source: packages/raycast/package.json] — all command names, modes, and descriptions
- [Source: packages/raycast/src/start.tsx] — Start command implementation
- [Source: packages/raycast/src/menu-bar.tsx] — Menu Bar implementation
- [Source: packages/raycast/src/lib/cli.ts] — execa-based CLI invocation

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
