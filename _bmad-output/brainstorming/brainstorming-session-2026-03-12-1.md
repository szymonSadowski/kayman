---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Mac menu bar app for local meeting transcription + AI summarization → Notion export'
session_goals: 'Nail feature scope, explore tech stack, map UX flow, surface risks, identify success metrics — to produce a product brief feeding into PRD and stories'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles Thinking', 'SCAMPER Method', 'Six Thinking Hats']
ideas_generated: [34]
context_file: '_bmad/bmm/data/project-context-template.md'
session_active: false
workflow_completed: true
---

# Brainstorming Session — Kayman

**Facilitator:** Szymonsadowski
**Date:** 2026-03-12

---

## Session Overview

**Topic:** Mac menu bar app for local meeting transcription + AI summarization → Notion export
**Goals:** Nail feature scope, explore tech stack, map UX flow, surface risks, identify success metrics — to produce a product brief feeding into PRD and stories
**End Deliverable:** Product brief → PRD → Stories

### Session Setup

Personal-use Mac menu bar app (OpenWhisper-style). Uses local transcription model. AI summarization to structured output. Exports to Notion under selected project. Stack: Raycast extension + Node/TypeScript CLI. Solo developer, intermediate skill level, M-series Mac.

---

## Technique Selection

**Approach:** AI-Recommended
**Techniques:** First Principles Thinking → SCAMPER → Six Thinking Hats

---

## All Generated Ideas

### Theme 1: Core Value Proposition & UX Model

**[First Principles #1]: The Pre-Meeting Context Card**
_Concept:_ A compact, scannable summary card generated after each meeting. Contains key points, decisions made, and a special "spotlight" section — anything said BY you or TO you (your name mentioned) is bolded/highlighted. Designed to be read in 2 minutes before the next meeting.
_Novelty:_ Most tools dump a full summary. This is optimized for *re-entry* — getting back into context fast, not archiving everything.

**[First Principles #4]: Intentional Recording Model**
_Concept:_ User explicitly starts/stops recording via Raycast command. No ambient always-listening. Before starting, user selects target Notion project from a pre-loaded list.
_Novelty:_ Respects privacy (no accidental recording), reduces anxiety, makes the Notion destination a first-class decision.

**[First Principles #5]: Menu Bar as Minimal Control Surface**
_Concept:_ Entire app lives in Raycast. States: idle → recording (with indicator) → processing → done. No separate window needed for core flow.
_Novelty:_ Zero app-switching during meetings. The recording is a background process, not something you manage.

**[First Principles #6]: Fire-and-Forget Processing**
_Concept:_ After stopping recording, app processes entirely in background. Single macOS notification when summary is in Notion. User returns to their work immediately.
_Novelty:_ Matches the actual mental model: meeting ends → you move on → summary appears when ready, like an email arriving.

---

### Theme 2: Personal Spotlight Engine

**[First Principles #2]: The Personal Spotlight Engine**
_Concept:_ Two-trigger highlight system — (1) name detection in transcript text, (2) voice-match for your own speech with a ±30s context window. Everything else aggregated as "group context" with no speaker attribution needed.
_Novelty:_ Avoids complex multi-speaker diarization entirely. Only needs to identify ONE speaker (you).

**[First Principles #3]: Context Window Anchoring**
_Concept:_ When you speak, capture not just your words but the ±30s bubble around it — what was being discussed before you spoke, and what reaction followed.
_Novelty:_ Creates a narrative thread tied to YOUR participation arc in the meeting.

**[SCAMPER-M #20]: Kayman Output Structure**
_Concept:_ Fixed 3-section output: **TL;DR** (1-2 sentences), **Key Points** (bullets — decisions, important info, your spotlight bolded), **Summary** (short narrative paragraph).
_Novelty:_ Opinionated structure means LLM prompt is precise and outputs are consistent across every meeting and project.

---

### Theme 3: Technical Architecture

**[First Principles #7]: M-Series Local Stack**
_Concept:_ whisper.cpp or mlx-whisper (Apple Silicon optimized) for transcription. Runs natively on Neural Engine/GPU — no cloud, no cost, no latency for audio processing.
_Novelty:_ Genuinely fast on M-series. 1hr meeting transcribed in ~5min locally.

**[SCAMPER-S #8]: CLI Core + Raycast Extension**
_Concept:_ Core app is a TypeScript/Node CLI handling recording, transcription, and summarization. Raycast extension provides the entire UI — start/stop commands, project picker, status, last summary.
_Novelty:_ Zero framework overhead. Raycast handles all Mac-native UX for free.

**[SCAMPER-S #9]: Raycast as the App Shell**
_Concept:_ The Raycast extension IS the app. `⌘ Space` → "kayman start" → pick project → go. Stop via same interface.
_Novelty:_ Raycast extensions are TypeScript-first — whole stack is unified. CLI does heavy lifting, Raycast does the UI.

**[White Hat #26]: Hybrid Local/API Architecture**
_Concept:_ whisper.cpp handles transcription 100% locally (audio never leaves machine). Vercel AI SDK handles summarization via API — model configurable in `config.yaml` (OpenAI, Anthropic, Groq, etc.).
_Novelty:_ Privacy where it matters (audio), quality/flexibility where it doesn't (text summarization).

**[Black Hat #30]: Audio Source Selection**
_Concept:_ Configurable audio sources — microphone only, system audio only, or both mixed. Default in `config.yaml`, overridable per session.
_Novelty:_ Flexible for in-person (mic) and remote calls (system audio) without separate modes.

**[Black Hat #31]: ScreenCaptureKit as Audio Backend**
_Concept:_ Use macOS ScreenCaptureKit to capture Teams/Zoom/Meet audio natively — no BlackHole dependency. One-time screen recording permission. Captures specific app audio directly.
_Novelty:_ Zero third-party driver dependencies. Works out of the box on any M-series Mac running Ventura+.

---

### Theme 4: Notion Structure & Data Model

**[SCAMPER-S #10]: Kayman Command Namespace**
_Concept:_ All Raycast commands under "kayman" — `kayman start`, `kayman stop`, `kayman status`, `kayman memo`, `kayman last`. Discoverable, memorable, namespaced.
_Novelty:_ Feels like a personal CLI tool with a polished GUI face.

**[SCAMPER-S #11]: VoC Database as Meeting Journal**
_Concept:_ Single Notion database with project as property. Each meeting = one entry with: title, date, project tag, transcript (collapsed), TL;DR, Key Points, Summary. Entry created as stub on `kayman start`, populated when processing completes.
_Novelty:_ Even if processing fails, the meeting slot exists. Summary fills async when ready.

**[SCAMPER-S #12]: Kayman Notion Hierarchy**
_Concept:_ `Kayman DB → Project (VoC, Team, 1on1...) → Meeting entries`. Raycast shows project list on `kayman start`, pick project, optionally type meeting title, hit enter.
_Novelty:_ One DB — easy to filter by project, search across all meetings, see timeline per project.

**[SCAMPER-S #13]: LLM-Generated Meeting Title**
_Concept:_ If invoked without a title, entry created as "VoC — [date]" stub. After processing, LLM generates a proper title like "VoC — Q1 roadmap alignment + API decision" and updates the Notion entry.
_Novelty:_ Zero friction to start. Title becomes a useful artifact, not a chore.

**[SCAMPER-A #19]: Notion Project Backlink**
_Concept:_ Each meeting entry auto-links back to its parent project page in Notion. Project page gets a "Recent Meetings" relation that updates automatically.
_Novelty:_ Project page becomes a living meeting timeline without any manual work.

---

### Theme 5: Configuration & Prompt System

**[SCAMPER-C #14]: Prompt Inheritance System**
_Concept:_ Global prompt template as base (`~/.config/kayman/prompts/default.md`). Per-project overrides (`voc.md`, `team.md`). Project prompt used if exists, otherwise falls back to global.
_Novelty:_ VoC meetings can focus on customer pain points, 1on1s on commitments. Same engine, totally different outputs.

**[SCAMPER-C #15]: kayman config Command**
_Concept:_ `kayman config` in Raycast shows: Edit global prompt / Edit [project] prompt / View all projects. Opens file in default editor (`$EDITOR`).
_Novelty:_ Config is just markdown files — readable, diffable, no JSON hell. Prompts are first-class citizens.

**[SCAMPER-C #16]: Prompt Template Variables**
_Concept:_ Prompts support variables like `{{speaker_name}}`, `{{project}}`, `{{date}}`, `{{meeting_title}}` injected at summarization time.
_Novelty:_ Dynamic prompts without code changes. Edit markdown, get smarter summaries.

**[SCAMPER-E #23]: Radical Simplicity Constraint**
_Concept:_ Kayman is deliberately single-user, local-first, no-UI. Everything requiring a window, account, or server is out of scope.
_Novelty:_ The constraint IS the feature. Quality bar: "does this make MY pre-meeting prep better?"

---

### Theme 6: Resilience & Reliability

**[Red Hat #27]: Resilient Notification Chain**
_Concept:_ Every pipeline stage emits a notification: "Recording started" → "Transcription in progress" → "Summarizing..." → "Done — [Project] entry ready" with deep link to Notion page. Failure = immediate notification with what failed and why.
_Novelty:_ Always know where kayman is in the pipeline. No mystery waiting, no silent failures.

---

### Theme 7: Voice Memo Mode

**[SCAMPER-P #21]: Voice Memo Mode**
_Concept:_ `kayman memo` starts recording immediately, no project picker. Transcribes and summarizes into dedicated "Memos" section in Notion. Perfect for quick thoughts while away from desk.
_Novelty:_ Same pipeline, zero friction. No meeting context needed.

**[SCAMPER-P #22]: Memo vs Meeting Prompt**
_Concept:_ Memo mode uses different default prompt — focused on extracting core idea and action items from stream-of-consciousness. Meeting mode focuses on decisions + participants.
_Novelty:_ One tool, two distinct mental modes. Kayman becomes your external brain.

---

### Theme 8: Quick Access

**[Green Hat #33]: Live Recording Indicator**
_Concept:_ Raycast menu bar item shows recording duration while active — "🔴 00:23:41". Zero focus interruption, constant reassurance.
_Novelty:_ Solves "wait, is it still recording?" anxiety without any extra interaction.

**[Green Hat #34]: kayman last — Inline TL;DR**
_Concept:_ `kayman last` or `kayman last voc` shows most recent meeting's TL;DR directly in Raycast preview. One keystroke, instant context, Notion stays closed.
_Novelty:_ Pre-meeting prep takes 10 seconds without leaving current context.

---

### V2 / Future Ideas (Out of V1 Scope)

- **Meeting Inbox with Unread State** — unread summaries surfaced in Raycast
- **Pre-Meeting Raycast Alert** — calendar-triggered reminder to review last summary
- **Start = Review Last** — shows last TL;DR as tooltip when starting a new recording
- **Forward Threading** — "Next Steps" section linking meetings forward
- **kayman ask** — `kayman ask voc "what did we decide about X?"` — transcript Q&A via AI SDK

---

## Idea Organization & Prioritization

### V1 Core — Must Have

| # | Idea | Why Critical |
|---|------|-------------|
| 1 | Pre-Meeting Context Card | Core value prop |
| 2+3 | Personal Spotlight Engine + Context Window | Key differentiator |
| 20 | TL;DR + Key Points + Summary structure | Output consistency |
| 8+9 | CLI + Raycast Extension | Tech foundation |
| 26 | Hybrid Local/API (whisper.cpp + Vercel AI SDK) | Privacy + flexibility |
| 31 | ScreenCaptureKit audio backend | Online meetings support |
| 10 | kayman command namespace | UX foundation |
| 11+12+13 | Notion DB hierarchy + LLM title | Storage model |
| 14+15+16 | Prompt inheritance + config command + variables | Customization |
| 27 | Resilient notification chain | Reliability |
| 21+22 | Voice memo mode | High-value secondary use case |
| 33+34 | Live indicator + kayman last | Quality of life |

### Breakthrough Concepts

- **Personal Spotlight** — only tool that knows YOUR voice and YOUR name and treats them specially
- **Fire-and-forget model** — zero babysitting, pure async
- **Prompt inheritance** — per-project LLM behavior without touching code

---

## Architecture Summary

```
Raycast Extension (TypeScript)
    ↕ spawns/controls
Node CLI (TypeScript)
    ↕
ScreenCaptureKit → audio capture (mic + system audio)
    ↓
whisper.cpp — local transcription (M-series optimized)
    ↓
Vercel AI SDK — summarization (configurable: OpenAI / Anthropic / Groq)
    ↓
Notion API — single DB, project-grouped entries
    ↑
~/.config/kayman/
  config.yaml
  prompts/default.md
  prompts/voc.md
  prompts/[project].md
```

---

## Proposed Notion Entry Structure

```
Title: [user-provided or LLM-generated]
Project: VoC / Team / 1on1 / ...
Date: 2026-03-12
Duration: 47 min

## TL;DR
[1-2 sentences — the one thing that happened]

## Key Points
- Decision: ...
- **Szymon asked about X** ← spotlight bolded
- Action: ...
- **Team asked Szymon to...** ← spotlight bolded

## Summary
[2-3 paragraph narrative]

[Transcript — collapsed toggle]
```

---

## Config File Structure

```
~/.config/kayman/
  config.yaml          # notion token, model, projects, audio source
  prompts/
    default.md         # global summarization prompt
    voc.md             # VoC-specific override
    memo.md            # voice memo prompt
```

### Default Prompt Template

```
You are summarizing a meeting transcript for {{speaker_name}}.

Output exactly 3 sections:

## TL;DR
1-2 sentences capturing the single most important outcome.

## Key Points
Bullet points covering decisions, important information, and action items.
Bold any point where {{speaker_name}} was speaking or directly addressed.

## Summary
2-3 paragraph narrative summary of the meeting flow.
```

---

## Session Summary

**Total ideas generated:** 34
**Themes identified:** 8 (+ V2 backlog)
**Techniques used:** First Principles Thinking, SCAMPER, Six Thinking Hats

### Key Insights

1. **The real job-to-be-done is context restoration, not transcription.** Kayman is a "meeting memory system" — the transcript is raw material, the pre-meeting brief is the product.
2. **Personal spotlight is the killer feature.** No generic tool does this. Knowing when YOUR name is mentioned and when YOU spoke (with context) is uniquely valuable.
3. **Simplicity is the architecture.** CLI + Raycast + whisper.cpp + Vercel AI SDK + Notion API. No Electron, no accounts, no UI windows. The constraint is the feature.
4. **Prompt inheritance unlocks long-term value.** As you tune prompts per project over time, kayman gets smarter for each context without code changes.

### Next Steps

1. Create Product Brief from this session
2. Create PRD from brief
3. Break into epics and stories
4. Start with CLI scaffold + Raycast extension skeleton
