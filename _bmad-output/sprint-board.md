# kayman — Sprint Board

Update story status by moving it between sections. Each story is designed for a single dev agent session.

---

## 🔲 Todo

### Epic 2: Audio Recording & Session Management

- [ ] **2.2** Session State Manager
- [ ] **2.3** `kayman start` — Project Picker & Recording
- [ ] **2.4** `kayman stop` & `kayman status`

### Epic 3: Meeting Pipeline — Transcription, Summary & Notion Export

- [ ] **3.1** Notification System
- [ ] **3.2** Transcription Stage
- [ ] **3.3** AI Summarization & Personal Spotlight
- [ ] **3.4** Notion Export Stage
- [ ] **3.5** Pipeline Runner & `kayman stop` Integration

### Epic 4: Summary Access & Raycast Integration

- [ ] **4.1** `kayman last` — Terminal Summary Access
- [ ] **4.2** Raycast Extension Scaffold & Command Stubs
- [ ] **4.3** Raycast Commands — Start, Stop, Last, Memo, Status
- [ ] **4.4** Menu Bar Recording Indicator
- [ ] **4.5** Shell Tab Completion

---

## 🔄 In Progress

### Epic 2: Audio Recording & Session Management

- [ ] **2.1** Swift Audio Capture Shim — `_bmad-output/implementation-artifacts/2-1-swift-audio-capture-shim.md`

---

## ✅ Done

### Epic 1: Foundation — Project Scaffold & Configuration System

- [x] **1.1** Monorepo Scaffold & Build Tooling
- [x] **1.2** Shared Package — Types, Paths & Config Loader
- [x] **1.3** CLI Entry Point, Command Stubs & Exit Codes

---

## Notes

- Stories must be implemented in order within each epic (each builds on previous)
- Epics can be started sequentially: Epic 2 after Epic 1 is complete, etc.
- Full story specs (ACs, user stories) in `_bmad-output/planning-artifacts/epics.md`
- To implement a story: `/bmad-bmm-dev-story` with the relevant story from `epics.md`
