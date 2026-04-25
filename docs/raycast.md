# kayman Raycast Extension

## Prerequisites

Before installing the Raycast extension, make sure:

- kayman CLI is installed and working (`kayman verify` passes)
- Config file exists at `~/.config/kayman/config.yaml` with required fields
- Node.js ≥ 22 is available in your shell (Raycast uses your default shell)

If you haven't set up the CLI yet, follow [cli.md](./cli.md) first.

---

## Installation

The extension runs in **development mode** — no build step required for daily use.

1. Open Raycast (`⌘ Space`)
2. Go to **Settings** (`⌘ ,`) → **Extensions** tab
3. Click **`+`** → **Add Script Directory**
4. Navigate to `<repo>/packages/raycast` and confirm
5. The kayman commands appear immediately in Raycast

> **Optional:** For a production-quality install, run `pnpm build` inside `packages/raycast` first.

---

## Commands

### Start Recording

Launches a project picker and starts a recording session.

| Detail | Value |
|---|---|
| Mode | View |
| Raycast name | "Start Recording" |

**Behavior:**
- Shows a list of projects from your config
- Optional tag input appears after selecting a project
- Starts `kayman start <project>` in the background

---

### Stop Recording

Stops the active recording session immediately.

| Detail | Value |
|---|---|
| Mode | No-view (background) |
| Raycast name | "Stop Recording" |

**Behavior:**
- Runs `kayman stop`
- Shows a success or error toast

---

### Last Meeting

Displays the most recent meeting summary inline in Raycast.

| Detail | Value |
|---|---|
| Mode | View |
| Raycast name | "Last Meeting" |

**Behavior:**
- Runs `kayman last` and renders the TL;DR output
- No recording is started or stopped

---

### Record Memo

Starts a quick memo recording without a project picker.

| Detail | Value |
|---|---|
| Mode | No-view (background) |
| Raycast name | "Record Memo" |

**Behavior:**
- Runs `kayman memo`
- No project selection, no Notion export
- Shows success or error toast

---

### Recording Status

Shows whether a recording is active and how long it has been running.

| Detail | Value |
|---|---|
| Mode | View |
| Raycast name | "Recording Status" |

**Behavior:**
- Displays elapsed time if a session is active
- Shows "No active recording" otherwise

---

### Recording Indicator (Menu Bar)

Displays a live recording timer (`⏺ MM:SS`) in the macOS menu bar, updating every second.

| Detail | Value |
|---|---|
| Mode | Menu bar |
| Raycast name | "Recording Indicator" |
| Update interval | 1 second |

**Behavior:**
- Shows `⏺ kayman` when idle
- Shows `⏺ 00:12` (elapsed time) while recording is active
- Menu items: **Stop Recording**, **Show Status**

#### Pinning the Menu Bar indicator

1. Trigger "Recording Indicator" from Raycast once
2. Raycast prompts **"Keep in Menu Bar?"** — click **Yes**
3. The `⏺ kayman` icon appears in the macOS menu bar permanently
4. It updates to `⏺ MM:SS` automatically whenever a recording is active

---

## Troubleshooting

### "kayman: command not found"

Raycast uses your default login shell and may not inherit your interactive PATH.

**Fix:**
```sh
# Make sure kayman is globally linked
pnpm link --global

# Confirm ~/.pnpm/bin (or equivalent) is in PATH
echo $PATH | grep pnpm
```

If `kayman verify` works in Terminal but not in Raycast, add the binary directory to your shell's login profile (`.zprofile`, `.bash_profile`, etc.):

```sh
export PATH="$HOME/.pnpm/bin:$PATH"
```

---

### "Config error" / config not found

The extension reads `~/.config/kayman/config.yaml`.

**Fix:**
```sh
# Create the config file if missing
mkdir -p ~/.config/kayman
touch ~/.config/kayman/config.yaml

# Validate the current config
kayman verify
```

See [cli.md § Configuration](./cli.md#configuration) for the full list of required fields.

---

### Extension not loading

- Ensure Node.js ≥ 22 is the active version in the shell Raycast uses
- Try relaunching Raycast after making changes to extension files
- Re-add the script directory: Settings → Extensions → remove kayman → re-add via `+`

---

### Menu bar not updating

The live timer requires the `"interval": "1s"` field in `packages/raycast/package.json` for the `menu-bar` command. Confirm it is present:

```json
{
  "name": "menu-bar",
  "mode": "menu-bar",
  "interval": "1s"
}
```

If you cloned an older version, pull the latest and re-add the extension directory.
