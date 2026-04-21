# kayman CLI Documentation

## Quick Start

```
1. kayman verify        — check your setup
2. kayman start         — pick a project and record
3. kayman stop          — stop and process
4. kayman last          — see the summary
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 22 | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 10 | `npm install -g pnpm` |
| whisper.cpp binary | latest | Build from source — see below |
| ffmpeg | any | Required for audio processing — `brew install ffmpeg` |

### Building whisper.cpp

```sh
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
# Binary is at ./build/bin/whisper-cli (or ./main on older builds)
```

Set the path to this binary in your config file (see [Configuration](#configuration)).

---

## Installation

```sh
# 1. Clone the repo
git clone https://github.com/szymonSadowski/kayman
cd kayman

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Link globally
pnpm link --global
# OR
npm install -g .
```

After linking, `kayman` should be available in your PATH. Confirm with:

```sh
kayman verify
```

---

## Configuration

kayman reads its configuration from `~/.config/kayman/config.yaml`.

Create the file:

```sh
mkdir -p ~/.config/kayman
touch ~/.config/kayman/config.yaml
```

### Full Example Config

```yaml
# ~/.config/kayman/config.yaml

user_name: "Your Name"              # Used in Personal Spotlight in Key Points

# Notion
notion_token: "secret_..."          # Notion integration token (see Notion Setup)
notion_database_id: "abc123..."     # Target Notion database ID

# AI provider
ai_provider: openai                 # openai | anthropic | google | ollama
ai_model: gpt-4o-mini               # Model name for the provider
ai_api_key: "sk-..."                # API key (not required for ollama)
# ai_base_url: "http://..."         # Optional: custom base URL for provider

# Audio
audio_source: system_and_mic        # system_and_mic | system_only | mic_only

# Whisper (transcription)
whisper_binary_path: "/path/to/whisper-cli"   # Path to whisper.cpp binary
whisper_model_path: "/path/to/ggml-base.bin"  # Path to whisper model file

# Projects (optional — enables project-scoped Notion pages)
projects:
  - name: "Daily Standup"
    notion_page_id: "page-id-1..."
  - name: "Client Demo"
    notion_page_id: "page-id-2..."
    prompt_template: "Focus on action items and decisions."
```

### Required Fields

| Field | Description |
|---|---|
| `user_name` | Your name — appears in the Personal Spotlight section of summaries |
| `notion_token` | Notion integration secret (see [Notion Setup](#notion-setup)) |
| `notion_database_id` | ID of the Notion database to write to |
| `ai_provider` | AI provider: `openai`, `anthropic`, `google`, or `ollama` |
| `ai_model` | Model name for the chosen provider (e.g. `gpt-4o-mini`, `claude-3-5-haiku-latest`) |
| `ai_api_key` | API key for cloud providers — not required when `ai_provider: ollama` |

### Optional Fields

| Field | Default | Description |
|---|---|---|
| `audio_source` | `system_and_mic` | Audio capture mode |
| `whisper_binary_path` | — | Path to whisper.cpp binary |
| `whisper_model_path` | — | Path to whisper model file |
| `ai_base_url` | — | Custom base URL for AI provider |
| `projects` | `[]` | Project list with Notion page IDs |

Use `kayman models download base` to download a whisper model automatically (stored in `~/.cache/whisper/`).

---

## Commands

### Recording

#### `kayman start`

Start a recording session.

```
Usage:  kayman start [project] [--tags tag1 tag2] [--skip-checks]

Options:
  [project]            Project name (optional — shows picker if omitted)
  --tags <tags...>     Tag this recording (e.g. --tags daily client)
  --skip-checks        Skip pre-flight dependency checks (for offline use)

Examples:
  kayman start
  kayman start "Daily Standup"
  kayman start "Client Demo" --tags client demo
  kayman start --skip-checks
```

#### `kayman stop`

Stop the active recording session and process it in the background.

```
Usage:  kayman stop

Examples:
  kayman stop
```

#### `kayman status`

Check whether a recording is active and show its duration.

```
Usage:  kayman status

Examples:
  kayman status
```

#### `kayman memo`

Start a quick memo recording — no project picker, no Notion export.

```
Usage:  kayman memo [--skip-checks]

Options:
  --skip-checks        Skip pre-flight dependency checks (for offline use)

Examples:
  kayman memo
  kayman memo --skip-checks
```

---

### Results

#### `kayman last`

Show the most recent meeting summary TL;DR.

```
Usage:  kayman last

Examples:
  kayman last
```

#### `kayman list`

List past meeting recordings with optional filters.

```
Usage:  kayman list [--project <name>] [--from <date>] [--to <date>] [--tag <tag...>]

Options:
  --project <name>     Filter by project name
  --from <date>        Show recordings from this date (YYYY-MM-DD)
  --to <date>          Show recordings up to this date (YYYY-MM-DD)
  --tag <tag...>       Filter by tag (AND logic)

Examples:
  kayman list
  kayman list --project "Daily Standup"
  kayman list --from 2026-04-01 --to 2026-04-10
  kayman list --tag client
```

#### `kayman retry`

Re-export recordings that failed to export to Notion.

```
Usage:  kayman retry [--path <dir>] [--all]

Options:
  --path <dir>         Retry export for a specific recording directory
  --all                Retry all failed exports

Examples:
  kayman retry --all
  kayman retry --path ~/.kayman/recordings/2026-04-10_daily
```

---

### Setup

#### `kayman verify`

Validate kayman setup and dependencies (config, binaries, Notion connectivity).

```
Usage:  kayman verify

Examples:
  kayman verify
```

#### `kayman completion`

Install shell tab completion for project names.

```
Usage:  kayman completion install [shell]

Options:
  install              Install shell completion script
  [shell]              Shell type: bash, zsh, fish (auto-detected if omitted)

Examples:
  kayman completion install
  kayman completion install zsh
```

#### `kayman config`

View and edit kayman configuration.

```
Usage:  kayman config list
        kayman config get <key>
        kayman config set <key> <value>
        kayman config path

Subcommands:
  list             Print all config values (sensitive fields masked)
  get <key>        Print a single config value (unmasked)
  set <key> <val>  Update a config field
  path             Print the path to the config file

Examples:
  kayman config list
  kayman config get ai_provider
  kayman config set ai_provider ollama
  kayman config set user_name "Your Name"
  kayman config path
```

#### `kayman models`

Manage local whisper transcription models.

```
Usage:  kayman models [list]
        kayman models download <model>
        kayman models remove <model>

Subcommands:
  list             Show available models with download status and size
  download <model> Download a whisper model to ~/.cache/whisper/
  remove <model>   Remove a downloaded model

Models:  tiny (75 MB), base (142 MB), small (466 MB), medium (1.5 GB), large (2.9 GB)

Examples:
  kayman models list
  kayman models download base
  kayman models remove large
```

#### `kayman offline`

Switch to offline mode — uses a local Ollama model instead of a cloud AI provider.

```
Usage:  kayman offline [--model <name>]

Options:
  --model <name>       Local Ollama model to use (default: llama3.2)

What it does:
  Saves your current cloud AI settings to ~/.config/kayman/.online-config,
  then switches ai_provider to ollama. Run "kayman online" to restore.

Examples:
  kayman offline
  kayman offline --model mistral
```

#### `kayman online`

Switch back to online mode — restores cloud AI settings.

```
Usage:  kayman online

What it does:
  Restores cloud AI settings from ~/.config/kayman/.online-config snapshot.
  If no snapshot exists, prompts interactively for provider, model, and API key.

Examples:
  kayman online
```

---

### Help

#### `kayman help`

Show command help. Pass a command name for detailed help.

```
Usage:  kayman help [command]

Examples:
  kayman help
  kayman help start
  kayman help list
```

---

## Offline Mode

kayman can transcribe and summarise meetings entirely on-device using [Ollama](https://ollama.com).

### Setup

1. **Install Ollama**

   ```sh
   # macOS
   brew install ollama
   # or download from https://ollama.com/download
   ```

2. **Start the Ollama server**

   ```sh
   ollama serve
   ```

3. **Pull a model**

   ```sh
   ollama pull llama3.2
   # or any other model, e.g. mistral, gemma3
   ```

4. **Switch kayman to offline mode**

   ```sh
   kayman offline
   # or use a specific model:
   kayman offline --model mistral
   ```

5. **Record as usual**

   ```sh
   kayman start
   kayman stop
   kayman last
   ```

### Switching back to cloud AI

```sh
kayman online
```

This restores the cloud provider settings that were saved when you ran `kayman offline`.

---

## Notion Setup

kayman exports meeting summaries to a Notion database. You need two values: a **Notion token** and a **database ID**.

### 1. Create a Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Give it a name (e.g. "kayman") and select your workspace
4. Click **Save**
5. Copy the **Internal Integration Secret** — this is your `notion_token`

### 2. Connect the Integration to Your Database

1. Open the Notion database you want kayman to write to
2. Click the **`...`** menu in the top-right corner
3. Select **Add connections** → find your integration → click **Confirm**

### 3. Get the Database ID

The database ID is the 32-character string in the database URL:

```
https://www.notion.so/<workspace>/<DATABASE_ID>?v=<view_id>
```

Copy just the `DATABASE_ID` portion (no dashes or query string needed — kayman normalises it).

### 4. Add to Config

```yaml
notion_token: "secret_abc123..."
notion_database_id: "abc123def456..."
```

Verify the connection:

```sh
kayman verify
```
