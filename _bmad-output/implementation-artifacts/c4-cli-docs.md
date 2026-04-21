# Story C4: CLI Docs (Technical Writer)

Status: review

## Story

As a new user,
I want a comprehensive CLI documentation file,
so that I can install, configure, and use kayman without asking anyone.

## Acceptance Criteria

1. **Given** a developer with no prior kayman context reads `docs/cli.md`
   **When** they follow the instructions
   **Then** they can get fully set up and run their first recording

2. **Given** the documentation covers installation
   **When** read
   **Then** it includes: prerequisites (Node ≥22, pnpm, whisper binary), install steps, and global link setup

3. **Given** the documentation covers configuration
   **When** read
   **Then** it explains every required field in `~/.config/kayman/config.yaml` with an example file

4. **Given** the documentation covers all commands
   **When** read
   **Then** every command is documented with its purpose, options, and at least one example

5. **Given** the documentation covers offline mode
   **When** read
   **Then** it explains how to install Ollama and run `kayman offline`

6. **Given** the documentation covers Notion setup
   **When** read
   **Then** it explains how to get `notion_token` and `notion_database_id`

## Tasks / Subtasks

- [x] Task 1: Create `docs/cli.md` with full CLI documentation (AC: 1–6)
  - [x] Prerequisites section: Node 22, pnpm 10, whisper binary (link to whisper.cpp), ffmpeg (if needed)
  - [x] Installation section: clone repo, `pnpm install`, `pnpm build`, `pnpm link --global` OR `npm install -g`
  - [x] Config section: create `~/.config/kayman/config.yaml`, explain each field, provide full example file
  - [x] Commands section: document all 14 commands — source `COMMAND_DETAILS` in `help.ts` as reference
  - [x] Offline mode section: install Ollama, `ollama pull llama3.2`, `kayman offline`
  - [x] Notion setup section: create integration, get token, find database ID
  - [x] Quick start section at top (4-step flow from `help.ts` QUICK_START)
- [x] Task 2: Create `docs/` directory if it doesn't exist
  - [x] Check if `docs/` exists at repo root; create if not

## Dev Notes

### Source of Truth for Commands

`packages/cli/src/commands/help.ts` — `COMMAND_DETAILS` and `COMMAND_GROUPS` are the canonical command reference. Use these as the source of truth for all command documentation.

All 14 commands to document:
- **Recording:** `start`, `stop`, `status`, `memo`
- **Results:** `last`, `list`, `retry`
- **Setup:** `verify`, `completion`, `config`, `models`, `offline`, `online`
- **Help:** `help`

### Config File Example

All required fields (from `packages/shared/src/config.ts`):
```yaml
# ~/.config/kayman/config.yaml
user_name: "Your Name"              # Used for Personal Spotlight in Key Points
notion_token: "secret_..."          # Notion integration token
notion_database_id: "abc123..."     # Target Notion database ID
ai_provider: openai                 # openai | anthropic | google | ollama
ai_model: gpt-4o-mini               # Model name for the provider
ai_api_key: "sk-..."                # API key (not required for ollama)
audio_source: system_and_mic        # system_and_mic | system_only | mic_only
projects:
  - name: "Project Name"
    notion_page_id: "page-id..."    # Notion page to tag entries with
```

### Notion Setup Steps

1. Go to https://www.notion.so/my-integrations → create new integration
2. Copy the `Internal Integration Secret` — this is `notion_token`
3. In Notion, open the target database → click `...` → `Add connections` → add your integration
4. Copy the database URL: `notion.so/<workspace>/<DATABASE_ID>?v=...` — extract the 32-char ID

### whisper.cpp Setup

The `kayman-capture` Swift binary handles audio. Whisper binary is separate:
1. Build from source: https://github.com/ggerganov/whisper.cpp
2. Set path in config or use `kayman models download base` to get a model
3. `whisper_binary_path` and `whisper_model_path` fields in config

### Project Structure Notes

**New files:**
- `docs/cli.md`
- `docs/` directory (create if missing)

**No code changes** — documentation only.

### References

- [Source: packages/cli/src/commands/help.ts] — COMMAND_GROUPS, COMMAND_DETAILS, QUICK_START
- [Source: packages/shared/src/config.ts] — all config fields and validation
- [Source: _bmad-output/planning-artifacts/epics.md#Additional-Requirements] — tech constraints

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — documentation-only story, no runtime issues.

### Completion Notes List

- Created `docs/cli.md` from scratch using `help.ts` (COMMAND_DETAILS, COMMAND_GROUPS, QUICK_START) and `config.ts` as sources of truth.
- `docs/` directory already existed (empty).
- All 14 commands documented with usage, options, and examples.
- Full config example and per-field table included.
- Offline mode section covers Ollama install, model pull, and toggle workflow.
- Notion setup section covers integration creation, database connection, and ID extraction.

### File List

- docs/cli.md (created)

## Change Log

- 2026-04-21: Created docs/cli.md — full CLI reference covering all 14 commands, config fields, offline mode, and Notion setup (C4)
