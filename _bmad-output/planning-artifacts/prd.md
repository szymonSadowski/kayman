---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-kayman-2026-03-12.md
workflowType: 'prd'
briefCount: 1
researchCount: 0
projectDocsCount: 0
classification:
  projectType: cli_tool
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - kayman

**Author:** Szymonsadowski
**Date:** 2026-03-12

## Executive Summary

Kayman is a Mac CLI tool for a single power user who attends many meetings across multiple projects but only cares about the moments that directly involve them. It records meeting audio locally, transcribes via whisper.cpp on-device, generates AI summaries via configurable API, and exports structured entries to Notion — all triggered by two keystrokes in Raycast. The pipeline runs entirely in the background; by the time the next meeting starts, the summary is already in Notion.

Target user: a developer juggling multiple active projects, relying on memory across context-switches. Pain: no reliable way to restore meeting context before the next call. Success: opening Raycast before a meeting and finding the relevant moments already surfaced — without having done anything after the call ended.

## What Makes This Special

The **Personal Spotlight Engine** — meeting tools capture everything and force you to skim. Kayman detects your name in transcript text and bolds those moments in the Key Points output. The 5 minutes that matter from a 1-hour call surface immediately.

Secondary differentiators: 100% local audio processing (audio never leaves the machine), Raycast-native UX (zero app switching, entire workflow in `⌘ Space`), zero team overhead — no accounts, no onboarding, no features you don't need.

## Success Criteria

### User Success

Kayman succeeds when it becomes invisible infrastructure — used habitually after every meeting without conscious thought. The user never needs to babysit the pipeline or check whether it ran.

- **Habitual adoption:** Used after the majority of meetings without deliberate effort
- **Pre-meeting value:** Relevant summary available in Notion before the next meeting on the same topic
- **Personal spotlight:** User name mentions consistently bolded and easy to find at a glance

### Business Success

N/A — personal tool. No revenue, growth, or retention targets. Success is personal utility.

### Technical Success

- **Pipeline reliability:** Every `kayman stop` produces a Notion entry — no silent failures
- **Failure visibility:** Any pipeline failure (audio capture, transcription, AI API call, Notion write) surfaces a notification with the failure stage identified
- **System non-impact:** Transcription runs in background on M-series Mac without noticeable CPU/memory impact on active work
- **Cost:** AI API costs under $1/month for typical developer meeting volume

### Measurable Outcomes

| Outcome | Target |
|---------|--------|
| Pipeline completion | Every recording produces a Notion entry or an explicit failure notification |
| Failure notification | User notified within seconds of failure with stage identified |
| Recording start | `kayman start` → recording active in ≤2 keystrokes |
| Spotlight accuracy | User name mentions reliably bolded in summary output |
| API cost | < $1/month for typical usage |

## Product Scope

### MVP (Phase 1)

**Core User Journeys Supported:** Journey 1 (success path), Journey 2 (failure recovery), Journey 3 (first-run setup)

**Must-Have Capabilities:**
- `kayman start` with project picker, `kayman stop`, `kayman last`, `kayman memo`, `kayman status`
- Audio capture via ScreenCaptureKit (mic + system audio, configurable)
- Local transcription via whisper.cpp (M-series optimized)
- AI summarization via Vercel AI SDK (configurable provider/model)
- Notion export: project-tagged entry with LLM-generated title / TL;DR / Key Points / Full Summary
- Personal Spotlight: user name mentions bolded in Key Points
- Raycast-native UX: menu bar recording indicator, inline `kayman last`
- Resilient notification chain with per-stage failure messages
- Local transcript persistence on pipeline failure
- Config via `~/.config/kayman/config.yaml`
- Shell completion for `kayman start <project>`

**MVP Approach:** Problem-solving MVP — validates the core pipeline and personal utility. Solo developer, Mac with M-series chip, personal use only.

### Phase 2 (Growth)

- Per-project prompt overrides (prompt inheritance)
- `kayman ask` — transcript Q&A via AI SDK
- Pre-meeting Raycast alert triggered by calendar

### Phase 3 (Expansion)

- Meeting inbox with unread state
- GitHub release for other developers to self-host

### Risk Mitigation

**Technical:** whisper.cpp transcript quality is the highest risk — start with medium/large model, tune down if M-series performance is impacted. If transcript quality is poor for name matching, spotlight degrades gracefully; tool still delivers value as a standard meeting summarizer.
**Resource:** Solo developer. Features that block the pipeline ship last or get cut from MVP.

## User Journeys

### Journey 1: Szymon — Meeting Day (Success Path)

Szymon opens Raycast at 9:58, types `kayman start`, selects "Project Kayman" from the project list, hits enter. A menu bar indicator shows recording duration. He forgets about it.

At 11:00 the call ends. He types `kayman stop`. Notification: *"Transcribing..."* He opens Slack. Two minutes later: *"Summarizing..."* A minute after: *"Done — Notion entry created."* He never opened a terminal or touched a transcript.

At 2:45, before his next Kayman sync, he types `kayman last` in Raycast. The TL;DR appears inline — two sentences, his name bolded in one key point. He walks into the meeting with context. The tool disappears back into the background.

**Emotional arc:** Neutral → briefly satisfied → moves on. Zero emotional overhead.

**Requirements revealed:** project picker on start, menu bar indicator, background pipeline, notification chain, `kayman last` inline in Raycast, bolded spotlight in Key Points.

---

### Journey 2: Szymon — Pipeline Failure (Edge Case)

`kayman stop`. *"Transcribing..."* notification fires. Then silence for 5 minutes. Szymon notices.

**What should happen:** Failure notification fires — *"Summarization failed: OpenAI API error (429). Transcript saved locally."* Szymon knows exactly what broke and that audio wasn't lost. Silence is indistinguishable from "still working" vs "silently failed" — that's the failure mode to prevent.

**Requirements revealed:** per-stage failure notifications with specific error context, local transcript persistence on pipeline failure, no silent failures.

---

### Journey 3: Szymon — First Run (Setup)

Szymon clones the repo, follows the README: installs dependencies, downloads whisper.cpp model, creates `~/.config/kayman/config.yaml` with Notion token, AI API key, and project list, adds Raycast script directory. He runs `kayman start` as a test, speaks a few words, `kayman stop`. A Notion entry appears. Setup done in under 20 minutes.

**Requirements revealed:** clear README, config file schema documentation, functional test path with minimal friction, whisper.cpp model download instruction.

---

### Journey 4: GitHub Discoverer — Self-Hosting

A developer finds kayman on GitHub. Same profile as Szymon: Mac, Raycast, Notion. Reads the README, sees the config schema, clones and configures. No onboarding UI, no account, no questions. If the README covers it, they're running in 20 minutes.

**Requirements revealed:** self-sufficient README, explicit config schema, no hidden dependencies.

---

### Journey Requirements Summary

| Capability | Revealed By |
|-----------|-------------|
| Project picker (start) | Journey 1 |
| Menu bar recording indicator | Journey 1 |
| Background pipeline (transcribe → summarize → Notion) | Journey 1, 2 |
| Per-stage failure notifications with error context | Journey 2 |
| Local transcript persistence on failure | Journey 2 |
| `kayman last` inline in Raycast | Journey 1 |
| Personal spotlight (name bolding in Key Points) | Journey 1 |
| `~/.config/kayman/config.yaml` schema | Journey 3, 4 |
| Self-sufficient README | Journey 3, 4 |

## Innovation & Novel Patterns

### Personal Spotlight Filtering

Kayman inverts the default assumption of meeting tools — capture everything, let the user find what matters — by filtering output for a specific individual. Name-based text detection bolds relevant moments in summary output. Simple mechanism, novel application.

Existing tools (Otter, Fireflies, Notion AI) are team-oriented and treat all transcript content as equally valuable. No mainstream tool applies individual-level filtering to meeting summaries.

**Validation:** Qualitative — use for 2 weeks and assess whether spotlight output reliably surfaces the right moments.

**Risk:** Name detection is text-matching only (no NLP). False positives (others with same name) are tolerable edge cases. If spotlight quality is poor, the tool still functions as a standard meeting summarizer.

## CLI Tool Specific Requirements

### Architecture Overview

Kayman is a Mac-native CLI tool with dual interface support: Raycast (primary UX) and terminal (direct invocation). All commands work in both contexts. Commands are single invocations that trigger background processes; results surface via notifications and Raycast.

- **Runtime:** Node.js (Vercel AI SDK implies JS/TS ecosystem)
- **Raycast integration:** Script commands or Raycast Extension exposing `kayman` namespace
- **Background processing:** Pipeline runs detached from CLI process after `kayman stop` — terminal/Raycast not blocked
- **State persistence:** Recording state bridges `kayman start` → `kayman stop` via PID/state file

### Command Structure

| Command | Description |
|---------|-------------|
| `kayman start [project]` | Pick project (interactive if omitted), begin recording |
| `kayman stop` | Stop recording, trigger background pipeline |
| `kayman last` | Display most recent summary TL;DR inline |
| `kayman memo` | Instant record, no project picker, lands in Memos |
| `kayman status` | Show whether recording is active + duration |

### Output Surfaces

- **macOS notifications:** Per-stage pipeline updates (recording → transcribing → summarizing → done / error with stage)
- **Raycast inline:** `kayman last` TL;DR rendered inline
- **Notion:** Title / TL;DR / Key Points (with spotlight) / Full Summary, project-tagged
- **stdout:** Minimal status/error output for terminal use

### Config Schema

`~/.config/kayman/config.yaml`:
```yaml
user_name: Szymon          # used for spotlight name matching
notion_token: secret_xxx
notion_database_id: xxx
ai_provider: openai         # configurable
ai_model: gpt-4o-mini
ai_api_key: sk-xxx
projects:
  - name: Kayman
    notion_page_id: xxx
  - name: Client A
    notion_page_id: xxx
audio:
  input: system_and_mic     # system_and_mic | mic_only | system_only
```

### Shell Completion

Tab completion for `kayman start <project>` — project list sourced from config. In scope for MVP.

## Functional Requirements

### Recording & Session Management

- FR1: User can start a recording session and associate it with a project from their configured project list
- FR2: User can start a recording session without a project (memo mode)
- FR3: User can stop an active recording session
- FR4: User can check whether a recording is active and view its duration
- FR5: System captures system audio and microphone audio during a recording session
- FR6: User can configure which audio inputs to capture (system, mic, or both)

### Pipeline Processing

- FR7: System transcribes recorded audio locally after a session ends
- FR8: System generates an AI summary from the transcript after transcription completes
- FR9: System exports a structured meeting entry to Notion after summarization completes
- FR10: System generates a meeting title via AI when no title is provided
- FR11: System preserves the transcript locally if any pipeline stage fails
- FR12: System notifies the user at each pipeline stage (transcribing, summarizing, exporting, done)
- FR13: System notifies the user with the specific failure stage and error context if any pipeline stage fails

### Personal Spotlight

- FR14: System detects occurrences of the user's configured name in the transcript
- FR15: System bolds detected user name mentions in the Key Points section of the summary output

### Notion Export

- FR16: System creates a Notion database entry tagged with the associated project
- FR17: Each Notion entry contains a title, TL;DR, Key Points (with spotlight), and Full Summary sections
- FR18: System associates memo recordings with a dedicated Memos section in Notion

### Summary Access

- FR19: User can retrieve the most recent meeting summary TL;DR inline within Raycast
- FR20: User can retrieve the most recent meeting summary from the terminal

### Configuration

- FR21: User can configure the tool via a YAML file at `~/.config/kayman/config.yaml`
- FR22: User can configure their name (used for spotlight detection) in the config file
- FR23: User can configure Notion credentials and target database in the config file
- FR24: User can configure the AI provider, model, and API key in the config file
- FR25: User can define a list of named projects with associated Notion page IDs in the config file
- FR26: User can configure audio input preferences in the config file

### Raycast Integration

- FR27: User can invoke all kayman commands from Raycast
- FR28: User can see a live recording duration indicator in the menu bar while a session is active

### CLI & Shell

- FR29: User can invoke all kayman commands from the terminal without Raycast
- FR30: System provides shell tab completion for project names on `kayman start`
- FR31: System exits with non-zero codes on failure for scripting compatibility

## Non-Functional Requirements

### Performance

- NFR1: Transcription of a 60-minute recording completes within 5 minutes on M-series Mac without noticeable CPU/memory impact on active foreground work
- NFR2: `kayman start` initiates recording within 2 seconds of invocation
- NFR3: `kayman stop` triggers the pipeline within 1 second of invocation
- NFR4: `kayman last` renders the TL;DR within 1 second of invocation

### Security

- NFR5: Audio recordings never leave the local machine — all transcription is performed on-device
- NFR6: Config file containing API keys and tokens stored at `~/.config/kayman/` with no network transmission of credentials
- NFR7: Transcripts and summaries stored locally only; no telemetry or remote logging

### Integration

- NFR8: Pipeline handles Notion API rate limits and transient failures with retry or failure notification — no silent data loss
- NFR9: AI provider errors (rate limits, auth failures, model errors) surfaced with actionable error messages
- NFR10: whisper.cpp integration degrades gracefully if the model file is missing (clear error, not crash)
