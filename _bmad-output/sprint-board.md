# kayman — Sprint Board

Update story status by moving it between sections. Each story is designed for a single dev agent session.

---

## 🔲 Todo

### Epic 3: Meeting Pipeline — Transcription, Summary & Notion Export

- [ ] **3.6** Session Tags & Notion Tag Export
- [ ] **3.7** `kayman list` — Browse Past Meetings
- [ ] **3.8** `kayman retry` — Re-export Failed Notion Exports
- [ ] **3.9** `kayman verify` — Health Check / Setup Validation

### Epic 4: Summary Access & Raycast Integration

- [ ] **4.1** `kayman last` — Terminal Summary Access
- [ ] **4.2** Raycast Extension Scaffold & Command Stubs
- [ ] **4.3** Raycast Commands — Start, Stop, Last, Memo, Status
- [ ] **4.4** Menu Bar Recording Indicator
- [ ] **4.5** Shell Tab Completion

### Epic 5: Error Handling & CLI UX

- [ ] **5.1** CLI Output Styling & Branding
- [ ] **5.2** Audio Capture Failure Recovery
- [ ] **5.3** Early Validation — Fail Fast on Missing Dependencies
- [ ] **5.4** Per-Project AI Prompt Templates
- [ ] **5.5** `kayman help` — Interactive Command Guide

### Epic 6: Local-First Mode & CLI Config

- [ ] **6.1** Ollama Provider Support
- [ ] **6.2** Local Whisper Model Management
- [ ] **6.3** Offline-Ready Pipeline
- [ ] **6.4** Ollama Auto-Pull
- [ ] **6.5** `kayman config` — CLI Config Editor
- [ ] **6.6** `kayman offline` / `kayman online` — Quick Mode Toggle

---

## 🔄 In Progress

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

---

## Notes

- Stories must be implemented in order within each epic (each builds on previous)
- Epics can be started sequentially: Epic 2 after Epic 1 is complete, etc.
- Full story specs (ACs, user stories) in `_bmad-output/planning-artifacts/epics.md`
- To implement a story: `/bmad-bmm-dev-story` with the relevant story from `epics.md`
