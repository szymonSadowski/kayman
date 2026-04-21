# kayman — Sprint Board

Update story status by moving it between sections. Each story is designed for a single dev agent session.

---

## 📝 Ready for Dev

### Epic: CLI Improvements

- [x] **C3** Memo Auto-Tag and Focused Prompt — [spec](implementation-artifacts/c3-memo-auto-tag-focused-prompt.md)
- [ ] **C4** CLI Docs — [spec](implementation-artifacts/c4-cli-docs.md)
- [ ] **C5** AI Cost Tracking — Price Column in Notion — [spec](implementation-artifacts/c5-ai-cost-tracking-notion.md)

### Epic: Raycast Improvements

- [ ] **R1** Tag Support in Raycast Start Command — [spec](implementation-artifacts/r1-raycast-tag-support.md)
- [ ] **R2** Auto-Updating Menubar Timer — [spec](implementation-artifacts/r2-menubar-auto-update.md)
- [ ] **R3** Raycast Installation & Usage Docs — [spec](implementation-artifacts/r3-raycast-docs.md)

### Epic: Identity & Branding

- [ ] **B1** CLI ASCII Banner — [spec](implementation-artifacts/b1-cli-ascii-banner.md)
- [ ] **B2** Raycast Extension Icon — [spec](implementation-artifacts/b2-raycast-extension-icon.md)
- [ ] **B3** macOS Notification Icon — [spec](implementation-artifacts/b3-macos-notification-icon.md)

---

## 🔲 Todo

_(none)_

---

## 🔄 In Progress — Awaiting Review

_(none)_

---

## ✅ Done

### Epic 1: Foundation — Project Scaffold & Configuration System

- [x] **1.1** Monorepo Scaffold & Build Tooling
- [x] **1.2** Shared Package — Types, Paths & Config Loader
- [x] **1.3** CLI Entry Point, Command Stubs & Exit Codes

### Epic 2: Audio Recording & Session Management

- [x] **2.1** Swift Audio Capture Shim
- [x] **2.2** Session State Manager
- [x] **2.3** `kayman start` — Project Picker & Recording
- [x] **2.4** `kayman stop` & `kayman status`

### Epic 3: Meeting Pipeline — Transcription, Summary & Notion Export

- [x] **3.1** Notification System
- [x] **3.2** Transcription Stage
- [x] **3.3** AI Summarization & Personal Spotlight
- [x] **3.4** Notion Export Stage
- [x] **3.5** Pipeline Runner & `kayman stop` Integration
- [x] **3.6** Session Tags & Notion Tag Export
- [x] **3.7** `kayman list` — Browse Past Meetings
- [x] **3.8** `kayman retry` — Re-export Failed Notion Exports
- [x] **3.9** `kayman verify` — Health Check / Setup Validation

### Epic 6: Local-First Mode & CLI Config

- [x] **6.1** Ollama Provider Support — [spec](implementation-artifacts/6-1-ollama-provider-support.md)
- [x] **6.2** Local Whisper Model Management — [spec](implementation-artifacts/6-2-local-whisper-model-management.md)
- [x] **6.3** Offline-Ready Pipeline — [spec](implementation-artifacts/6-3-offline-ready-pipeline.md)
- [x] **6.4** Ollama Auto-Pull — [spec](implementation-artifacts/6-4-ollama-auto-pull.md)
- [x] **6.5** `kayman config` — CLI Config Editor — [spec](implementation-artifacts/6-5-kayman-config-cli-editor.md)
- [x] **6.6** `kayman offline` / `kayman online` — Quick Mode Toggle — [spec](implementation-artifacts/6-6-offline-online-mode-toggle.md)

### Epic 4: Summary Access & Raycast Integration

- [x] **4.1** `kayman last` — Terminal Summary Access — [spec](implementation-artifacts/4-1-kayman-last.md)
- [x] **4.2** Raycast Extension Scaffold & Command Stubs — [spec](implementation-artifacts/4-2-raycast-scaffold.md)
- [x] **4.3** Raycast Commands — Start, Stop, Last, Memo, Status — [spec](implementation-artifacts/4-3-raycast-commands.md)
- [x] **4.4** Menu Bar Recording Indicator — [spec](implementation-artifacts/4-4-menu-bar-indicator.md)
- [x] **4.5** Shell Tab Completion — [spec](implementation-artifacts/4-5-shell-completion.md)

### Epic: CLI Improvements

- [x] **C1** Fix Double Help Output — [spec](implementation-artifacts/c1-fix-double-help-output.md)
- [x] **C2** Fix "too many arguments" on `offline`, `online`, `models` — [spec](implementation-artifacts/c2-fix-too-many-arguments.md)

### Epic 5: Error Handling & CLI UX

- [x] **5.1** CLI Output Styling & Branding — [spec](implementation-artifacts/5-1-cli-output-styling-and-branding.md)
- [x] **5.2** Audio Capture Failure Recovery — [spec](implementation-artifacts/5-2-audio-capture-failure-recovery.md)
- [x] **5.3** Early Validation — Fail Fast on Missing Dependencies — [spec](implementation-artifacts/5-3-early-validation-fail-fast.md)
- [x] **5.4** Per-Project AI Prompt Templates — [spec](implementation-artifacts/5-4-per-project-ai-prompt-templates.md)
- [x] **5.5** `kayman help` — Interactive Command Guide — [spec](implementation-artifacts/5-5-kayman-help-interactive-guide.md)

---

## Notes

- Stories must be implemented in order within each epic (each builds on previous)
- Epics can be started sequentially: Epic 2 after Epic 1 is complete, etc.
- Full story specs (ACs, user stories) in `_bmad-output/planning-artifacts/epics.md`
- To implement a story: `/bmad-bmm-dev-story` with the relevant story from `epics.md`
