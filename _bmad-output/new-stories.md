# New Stories — Kayman Identity & Branding

---

## Epic: CLI Improvements

### Story C1: Fix Double Help Output

**Goal:** `kayman --help` (and `kayman` with no args) prints the help block twice.

**Root cause:**
- `index.ts` registers both `program.on('option:help', () => helpCommand().then(() => process.exit(0)))` and `program.action(async () => helpCommand())`
- The option handler is async and non-blocking — `program.parse()` continues and fires the default `program.action` before `process.exit(0)` runs
- Result: `helpCommand()` executes twice

**Fix:**
- Remove `program.option('-h, --help')` + `program.on('option:help')` entirely
- Keep only `program.action(async () => helpCommand())` as the no-command fallback
- The `help [command]` subcommand already handles `kayman help`

**Acceptance criteria:**
- `kayman`, `kayman --help`, `kayman -h` each print help exactly once
- `kayman help <command>` still works

---

### Story C2: Fix "too many arguments" on `kayman offline`, `kayman online`, `kayman models`

**Goal:** These commands error with `too many arguments. Expected 0 arguments but got 1` instead of running.

**Context:**
- Commander.js is treating these as subcommands of something else or argument-parsing is misconfigured
- `offline` and `online` are defined with no positional args (correct), but the error suggests Commander receives an unexpected argument
- Needs a targeted debug to identify whether this is a Commander version quirk, a `allowExcessArguments` issue, or a command registration order problem

**Acceptance criteria:**
- `kayman offline` runs `offlineCommand` without error
- `kayman online` runs `onlineCommand` without error
- `kayman models` runs `modelsCommand` without error
- No regression on working commands

---

### Story C3: Memo Auto-Tag and Focused Prompt

**Goal:** `kayman memo` should automatically tag the session with `"memo"` and use a focused single-speaker prompt.

**Context:**
- `memoCommand` calls `writeSession({ ..., tags: [] })` — tags are never set
- Memo is a single-person recording (user talking to themselves), not a meeting — the AI prompt should reflect this: take structured notes, not produce a meeting summary

**Details:**
- In `memoCommand`: change `tags: []` → `tags: ['memo']`
- Add a dedicated `memo` prompt template in shared (or inline in the pipeline) focused on:
  - Single speaker context
  - Note-taking format (key points, action items, decisions)
  - Reference material for future use — not a meeting recap
- The pipeline should detect the `memo` tag (or `project: null`) and switch prompt accordingly

**Acceptance criteria:**
- `kayman memo` session always has `tags: ['memo']`
- AI output for memo recordings uses the focused single-speaker notes prompt
- `kayman list --tag memo` correctly filters memo recordings
- No regression on regular `start` recordings

---

### Story C4: CLI Docs (Technical Writer)

**Goal:** Document the kayman CLI so a new user can install and use it without asking anyone.

**Assigned to:** Technical Writer

**Details:**
- Installation: prerequisites (Node ≥22, pnpm, whisper binary, ffmpeg), `npm install -g` or local build steps
- Config: what `~/.config/kayman/config.yaml` needs, every required field explained, example file
- Commands: all commands with examples (can reference `help.ts` `COMMAND_DETAILS` as source of truth)
- Offline mode: how to set up Ollama, run `kayman offline`
- Notion setup: getting `notion_token` and `notion_database_id`
- Output: `docs/cli.md`

**Acceptance criteria:**
- A developer with no prior kayman context can get fully set up by following the doc alone
- All commands documented with purpose, options, and at least one example

---

## Epic: Raycast Improvements

### Story R1: Tag Support in Raycast Start Command

**Goal:** Allow users to select/add tags when starting a recording from Raycast.

**Context:**
- `Session` type already has `tags: string[]`
- `start.tsx` currently runs `kayman start <project>` with no tags
- CLI `start` command needs to accept `--tag` flags (verify if already supported)
- The Raycast UI has no way to input tags today

**Details:**
- Add a tag input step in `start.tsx` after project selection (either a free-text field or multi-select if tags are predefined in config)
- Pass tags to `runKayman(['start', project, '--tag', ...tags])` or equivalent
- If config supports predefined tags per project, surface those; otherwise free text

**Acceptance criteria:**
- User can add one or more tags before starting a recording from Raycast
- Tags are stored in the session and passed through to the pipeline
- Works correctly when no tags are entered (empty array, no regression)

---

### Story R2: Auto-Updating Menubar Timer

**Goal:** The menubar timer updates automatically without requiring a click.

**Context:**
- `menu-bar.tsx` already has a `setInterval(tick, 1000)` in a `useEffect`
- The timer logic is correct in code, but Raycast menubar commands don't re-render automatically unless the command is configured with `interval` in `package.json`
- Without `"interval"` set, Raycast only re-renders on user interaction

**Details:**
- Add `"interval": "1s"` (or appropriate value) to the `menu-bar` command entry in `packages/raycast/package.json`
- This tells Raycast to refresh the menubar command on a schedule, enabling the live timer
- Verify the `useEffect` interval logic still works correctly alongside Raycast's refresh cycle

**Acceptance criteria:**
- Menubar timer counts up in real time without user interaction
- No duplicate ticking or state issues from combined interval + Raycast refresh

---

### Story R3: Raycast Installation & Usage Docs (Technical Writer)

**Goal:** Provide clear instructions for installing and using the kayman Raycast extension.

**Assigned to:** Technical Writer

**Details:**
- Document how to install the extension in development mode (Raycast → Extensions → `+` → Add Script Directory)
- Cover prerequisites: kayman CLI installed, config at `~/.config/kayman/config.yaml`
- Describe each command: Start Recording, Stop Recording, Status, Last, Memo, Menu Bar
- Explain menubar setup: how to pin it to the menubar
- Include a short troubleshooting section (CLI not found, config errors)
- Output: `docs/raycast.md` or a section in the main README

**Acceptance criteria:**
- A new user with kayman CLI installed can get the Raycast extension running by following the doc alone
- All commands are documented with their purpose and expected behaviour

## Story 1: CLI ASCII Banner

**Goal:** Display the kayman ASCII logo on CLI startup.

**Details:**
- Print the ASCII art banner when `kayman` is invoked (before any command output)
- Should only render in TTY (skip in piped/non-interactive mode)
- ASCII art to use:

```
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@:                                                              :@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@.  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@   @@@@@@@@@@@@@@
@@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  @@@@@@@@@@@@@
@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@             @@@@@@@@@@@@@@@@@@@@@@@@@@@ -- @@@@@@@@@@ @@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@   @@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@    @@@@@@@@@@@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@              @@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@  @              @@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@ @@@             @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@       @@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@=:@@@@@@@@@@@   @@  ++  @-            @  ++ %@@@ @@::::@@@@@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@=:@- @  @ :@=:@ @@ +@@++  @@       @@ -+:@@+ @@@ @@@@@@@@@@@ @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@+.@@@@@@@@@@=:@@@ +*@@  +++++++++++++++ .@@=  @@ @@@           -@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@       @@   @@@@ +@  ++++++++++++++++++=  *+ @@  @ ========== @@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@  @@@@@@   ++++++++++++++++++++++: +  @@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@-  =++++++++++++++++++++++++++=   @@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@   ++++++++++--++=--++*++++++   @ +@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@  +++++++@@  @@-----@@  @@++++      @@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@ *  ++++++@  @- -----@ @   @+++      @@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@ =+++++++@    =@@@@@=    @+++++    @@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@   =++++@@@@@@+@@@  -  @@@*@@@@@@@+ +. @@-   @@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@  @@@ +++#+@@@@@@+ @@@@ -@@@  @@@@@@+ +++   + += @@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@ @@@@ - :++@@@@@@@@@         @@@@@@+ *++    +  +  *@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@=* @@@@+-+ +++@@@@@@@@@@@ +=+ *@@    @@@@+++ -+++ +- @@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@   @+#++++ +++**@@@@@@@@@@@ #@@@@@@@@@@#++++ -++++. @@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@ +-@++*=--   +**@@@@@@@@@*****@@@@@@@@@*** = -+-- .@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@ +**++*--=  : ****#@@@@@@@@@@@@@@@@@@*@**=  ---  @@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@ ++----- ---  ****@@*@@@@@@@@@@@@@@+****  --  @@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@    -+--  --==-        :*@@@@@@**#@*** * :  *@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@= ----- ----+++++++++++  **@********   -: @@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@   - ----------+++++++ +********  --- @@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@--------------  --+=+  -------------------------@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@      @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@  @@@:  @@@@   @@@  @@@@  @@  @@@@@  @@@@@   @@@@:  @@@@  @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@  @@  @@@@@+ @  @@@  -@  @@@   @@@   @@@@  @ -@@@:   @@@  @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@     @@@@@@ #@@  @@@@   @@@@  @   @  @@@  @@# @@@: @@  @  @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@  @@@  @@@        @@@  @@@@@  @@ @@  @@        @@: @@@    @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@ @@@@@@@@  @@@@  @  @@@@@@ @@@  @@@@@  @@@@@  @@ @@@@@@  @- @@@@.  @@@@@@@@ @@@@@@@@@@@@
@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@. @@@@@@@@@@@@
@@@@@@@@@@@@@  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@  @@@@@@@@@@@@@
@@@@@@@@@@@@@@   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@   @@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@:                                                              :@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
```

**Acceptance criteria:**
- Banner prints on `kayman` CLI entry (index.ts / main entry)
- Skipped when `isTTY` is false
- No banner on `--help` or `--version` flags

---

## Story 2: Raycast Extension Icon

**Goal:** Use `kayman.png` as the official Raycast extension icon.

**Details:**
- Source: `packages/shared/assets/kayman.png`
- Destination: `packages/raycast/assets/icon.png`
- Raycast requires 512×512 PNG at `assets/icon.png`
- Update `packages/raycast/package.json` `"icon"` field if needed (already set to `"icon.png"`)

**Acceptance criteria:**
- `packages/raycast/assets/icon.png` exists and is the kayman logo
- Extension loads correctly in Raycast with the new icon

---

## Story 3: macOS Notification Icon

**Goal:** Replace the default terminal icon in macOS notifications with `kayman.png`.

**Details:**
- All notifications are fired via `node-notifier` in `packages/shared/src/notify.ts`
- `node-notifier` supports `contentImage` (absolute path) for macOS
- Resolve the asset path from `packages/shared/assets/kayman.png` at runtime using `__dirname` or `import.meta.url`
- Apply to all three notify functions: `notify`, `notifyCustom`, `notifyError`

**Acceptance criteria:**
- All macOS notifications (Transcribing, Summarizing, Exporting, Done, errors, custom) show the kayman logo
- Path resolves correctly regardless of where CLI is run from
- No regression on notification content/title
