---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2026-03-12-1.md
date: 2026-03-12
author: Szymonsadowski
---

# Product Brief: kayman

## Executive Summary

Kayman is a personal-use Mac CLI tool that captures meeting audio, transcribes it locally, and exports AI-generated summaries to Notion via Raycast. Built for a single power user who sits through long meetings but only cares about the moments that directly involve them — Kayman's Personal Spotlight Engine surfaces the 5 minutes that matter from a 1-hour call. Free to run (excluding API costs), private by design (audio never leaves the machine), and built for the joy of building something useful.

---

## Core Vision

### Problem Statement

Long meetings are expensive attention-wise — but only a fraction of the content is relevant to any individual participant. Existing transcription tools capture everything equally, forcing users to skim walls of text to find what actually matters to them.

### Problem Impact

A 1-hour meeting yields ~5 minutes of personally relevant content. Without a spotlight filter, that content is buried. Pre-meeting context restoration is slow, unreliable, or skipped entirely.

### Why Existing Solutions Fall Short

Cloud-based tools (Otter, Fireflies, Notion AI) send audio to external servers — a privacy trade-off not worth making for a personal tool. They're also built for teams, not individuals, and treat all content as equally important.

### Proposed Solution

A Raycast-native CLI that: records meeting audio locally → transcribes via whisper.cpp on-device → summarizes via configurable AI API → exports structured summary to Notion. The Personal Spotlight Engine identifies moments where the user speaks or is addressed by name, and surfaces those prominently in the output.

### Key Differentiators

- **Personal Spotlight Engine** — only tool that isolates YOUR voice and YOUR name mentions with surrounding context
- **100% local audio processing** — audio never leaves the machine
- **Raycast-native UX** — zero app switching, entire workflow lives in `⌘ Space`
- **Built for one** — no team features, no accounts, no overhead. Quality bar: "does this make MY pre-meeting prep better?"

---

## Target Users

### Primary User

**Szymon — The Multi-Project Developer**

A software developer juggling multiple active projects simultaneously. Attends a mix of meetings — VoC calls, 1on1s, team syncs — across different contexts. Currently relies on memory and occasional notes, but the cognitive overhead of context-switching between projects makes it hard to retain what happened in which meeting. Not looking for a tool to manage — looking for something that *disappears into the background and just works*.

**Pain:** Memory is unreliable across projects. Manual notes are friction. After a meeting ends, attention immediately shifts to the next thing — there's no time to review.

**Success moment:** Meeting ends, Szymon closes the call, opens Raycast two hours later for pre-meeting prep, and the summary is already there in Notion — with his relevant moments highlighted.

### Secondary Users

Other developers who discover kayman on GitHub. Same profile: technical, single-user, privacy-conscious, Raycast + Notion stack. No onboarding needed — if they can read a README and configure a YAML file, they're the right user.

### User Journey

1. **Setup (once):** Clone repo, configure `~/.config/kayman/config.yaml` with Notion token + AI API key + project list
2. **Before a meeting:** Nothing — kayman is idle
3. **Meeting starts:** `⌘ Space` → `kayman start` → pick project → done. Background recording begins
4. **Meeting ends:** `kayman stop` → notification: "Transcribing..." → "Summarizing..." → "Done — entry in Notion"
5. **Pre-next-meeting:** `kayman last` → TL;DR appears inline in Raycast. Spotlight moments visible immediately
6. **Routine:** Kayman becomes invisible infrastructure — like git. You stop thinking about it and just use it

---

## Success Metrics

### What Success Looks Like

Kayman succeeds if it becomes invisible infrastructure — used habitually after every meeting without conscious thought. The bar is simple: it works, it's cheap to run, and it doesn't get in the way.

### User Success Metrics

| Metric | Target |
|--------|--------|
| Habitual usage | Used after majority of meetings without friction |
| Spotlight quality | Personal mentions/speech correctly surfaced in summaries |
| API cost | Negligible — well under $1/month for typical usage |
| Reliability | Completes pipeline without silent failures |
| System impact | No noticeable CPU/memory degradation during transcription |

### Business Objectives

N/A — personal tool. No revenue, growth, or retention targets.

### Key Performance Indicators

- **It just works** — zero silent failures; every recording produces a Notion entry
- **Affordable** — API costs stay negligible for typical developer meeting volume
- **Non-intrusive** — transcription runs in background without impacting active work on M-series Mac
- **Accurate spotlight** — name mentions and user's own speech reliably identified and highlighted

---

## MVP Scope

### Core Features

**Pipeline (non-negotiable foundation)**
- `kayman start` — picks project, begins recording immediately (1-2 keystrokes max)
- `kayman stop` — triggers background pipeline: transcribe → summarize → Notion
- Local transcription via whisper.cpp (M-series optimized, no cloud audio)
- AI summarization via Vercel AI SDK (configurable model)
- Notion export: single DB, project-tagged entry with TL;DR / Key Points / Summary
- LLM-generated meeting title if none provided

**Personal Spotlight Engine**
- Name detection in transcript text
- Voice-match for user's own speech with ±30s context window
- Spotlight moments bolded in Key Points output

**Raycast UX**
- Full `kayman` command namespace in Raycast
- Live recording indicator in menu bar (duration)
- `kayman last` — shows most recent TL;DR inline in Raycast
- Resilient notification chain (recording → transcribing → summarizing → done / error)

**Audio**
- ScreenCaptureKit backend (mic + system audio, configurable)
- Config via `~/.config/kayman/config.yaml`

**Voice Memo Mode**
- `kayman memo` — instant record with no project picker, lands in Memos section

### Out of Scope for MVP

- Per-project prompt overrides (prompt inheritance) — global prompt only in V1
- Pre-meeting calendar alerts
- `kayman ask` — transcript Q&A
- Meeting inbox / unread state
- Multi-user or team features — ever

### MVP Success Criteria

- Full pipeline completes end-to-end without manual intervention
- `kayman start` → recording in ≤2 keystrokes
- Transcription quality good enough to trust spotlight results
- Runs entirely in background — no active babysitting required
- API costs negligible for typical usage

### Future Vision

- Prompt inheritance per project (V1.5 — high value, low effort)
- `kayman ask` — transcript Q&A via AI SDK
- Pre-meeting Raycast alert triggered by calendar
- Meeting inbox with unread state
- GitHub release for other developers to self-host
