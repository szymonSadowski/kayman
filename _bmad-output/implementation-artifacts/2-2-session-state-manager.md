# Story 2.2: Session State Manager

Status: done

## Story

As a developer,
I want `@kayman/shared` to export session read/write/clear utilities,
so that `kayman start` and `kayman stop` can share recording state across separate process invocations.

## Acceptance Criteria

1. **Given** a session is written via `writeSession(session)`
   **When** `readSession()` is called in a separate process
   **Then** it returns the same `Session` object (`{ pid, audioPath, project, startedAt }`)

2. **Given** a session file exists but the recorded PID is no longer alive
   **When** `readSession()` is called
   **Then** it returns `null` and deletes the stale session file (stale-state protection)

3. **Given** `clearSession()` is called
   **When** `readSession()` is subsequently called
   **Then** it returns `null`

4. **And** unit tests cover write/read, stale PID detection, and clear

## Tasks / Subtasks

- [x] Task 1 — Verify existing implementation matches spec (AC: #1, #2, #3)
  - [x] Confirm `packages/shared/src/session.ts` exports `writeSession`, `readSession`, `clearSession`, `isProcessAlive`
  - [x] Confirm `Session` type in `types.ts` matches `{ pid: number, audioPath: string, project: string | null, startedAt: string }`
  - [x] Confirm `SESSION_PATH` in `paths.ts` resolves to `~/.config/kayman/session.json`
  - [x] Confirm `index.ts` re-exports session utilities via `export * from './session'`

- [x] Task 2 — Run and verify test suite (AC: #4)
  - [x] Run `pnpm test` from repo root (or `pnpm --filter @kayman/shared test`)
  - [x] Confirm all 5 tests in `session.test.ts` pass: round-trip, null when no file, stale PID detection + file deletion, clearSession, clearSession idempotent
  - [x] Confirm no TypeScript errors: `pnpm typecheck` (or `pnpm --filter @kayman/shared build`)

- [x] Task 3 — Fix any gaps found (AC: #1–#4)
  - [x] If any test fails or type error exists, fix it before marking done
  - [x] If `writeSession` is missing directory creation for `~/.config/kayman/`, add `fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })` before write

## Dev Notes

### Critical Finding: Implementation Already Exists

`packages/shared/src/session.ts` and `packages/shared/src/session.test.ts` were committed as part of the repo initialization. **This story's primary task is verification, not implementation.** The dev agent must:
1. Confirm the existing code is correct against the AC
2. Run tests to verify they pass
3. Fix any gaps if found

### Current Implementation (packages/shared/src/session.ts)

```typescript
import fs from 'fs'
import path from 'path'
import { SESSION_PATH } from './paths'
import type { Session } from './types'

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)  // signal 0 checks existence without killing
    return true
  } catch {
    return false
  }
}

export function writeSession(session: Session): void {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8')
}

export function readSession(): Session | null {
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8')
    const session = JSON.parse(raw) as Session
    if (!isProcessAlive(session.pid)) {
      fs.unlinkSync(SESSION_PATH)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    fs.unlinkSync(SESSION_PATH)
  } catch {
    // already cleared
  }
}
```

### Session Type (packages/shared/src/types.ts)

```typescript
export interface Session {
  pid: number
  audioPath: string
  project: string | null
  startedAt: string  // ISO 8601
}
```

### Session File Location (packages/shared/src/paths.ts)

```typescript
export const CONFIG_DIR = path.join(os.homedir(), '.config', 'kayman')
export const SESSION_PATH = path.join(CONFIG_DIR, 'session.json')
```

### Test Coverage (packages/shared/src/session.test.ts)

All 5 required tests are present:
- `writeSession + readSession round-trips` — writes session with `process.pid` (alive), reads it back, checks deep equality
- `readSession returns null when no session file` — no file exists → null
- `readSession returns null and deletes file for stale PID` — writes PID `999999999` (dead), confirms null + file deleted
- `clearSession removes session file` — write then clear → null
- `clearSession is idempotent when no file exists` — double clear doesn't throw

Tests use `vi.mock('./paths')` with a temp directory so they never touch `~/.config/kayman/`.

### Architecture Compliance

- ✅ Session utilities live in `@kayman/shared/session.ts` (correct package boundary)
- ✅ `Session` type defined in `@kayman/shared/types.ts` (single source of truth)
- ✅ `SESSION_PATH` defined in `@kayman/shared/paths.ts` (path constants consolidated)
- ✅ All exported from `index.ts` via `export * from './session'`
- ✅ `isProcessAlive` uses `process.kill(pid, 0)` — correct POSIX pattern (no kill, just checks if PID responds to signal)
- ✅ `writeSession` creates directory with `{ recursive: true }` — handles first-time users

### Process Isolation Note

`readSession()` is designed to work across separate process invocations (the AC requirement). Since it reads from a file path (`SESSION_PATH`), not from memory, it works correctly when called by a different process than the one that called `writeSession()`. The `isProcessAlive` check is also cross-process — `process.kill(pid, 0)` works for any PID, not just child processes.

### stale PID Detection Edge Case

PID `999999999` is used as the "definitely dead" test value. On macOS, PIDs are 32-bit and max out at ~99999 in practice (though the kernel limit is higher). Using `999999999` guarantees the process is dead without race conditions. The `process.kill(pid, 0)` approach throws `ESRCH` (no such process) for dead PIDs, returning `false` from `isProcessAlive`.

### Tech Stack for this Story

- **Language:** TypeScript (Node.js 22)
- **Package:** `@kayman/shared` — `packages/shared/src/session.ts`
- **Testing:** Vitest with `vi.mock` for path isolation
- **Dependencies:** Node.js built-ins only (`fs`, `path`, `os`) — no new packages needed

### What Story 2.3 Expects From This Story

Story 2.3 (`kayman start`) will call:
```typescript
import { writeSession, readSession } from '@kayman/shared'

// On start:
writeSession({ pid: captureProcess.pid, audioPath, project, startedAt: new Date().toISOString() })

// Guard against double-start:
const existing = readSession()
if (existing) throw error("Recording already in progress")
```

Story 2.4 (`kayman stop`) will call:
```typescript
import { readSession, clearSession } from '@kayman/shared'

const session = readSession()
// SIGTERM session.pid
clearSession()
```

### Project Structure Notes

Files involved in this story:
```
packages/shared/src/
├── session.ts       ← primary deliverable (already exists)
├── session.test.ts  ← tests (already exist)
├── types.ts         ← Session interface (already exists)
├── paths.ts         ← SESSION_PATH constant (already exists)
└── index.ts         ← re-exports session (already configured)
```

No changes to `cli/` or `raycast/` packages in this story.

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Story-2.2:-Session-State-Manager]
- Architecture — data architecture: [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture]
- Architecture — session state JSON: [Source: _bmad-output/planning-artifacts/architecture.md#Format-Patterns]
- Architecture — shared package boundaries: [Source: _bmad-output/planning-artifacts/architecture.md#Architectural-Boundaries]
- Architecture — project structure: [Source: _bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure]
- FR1: User can start a recording session associated with a project
- FR3: User can stop an active recording session
- Additional requirements note: "Session state bridging start→stop: atomic JSON at ~/.config/kayman/session.json with PID liveness check on read" [Source: _bmad-output/planning-artifacts/epics.md#Additional-Requirements]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — no issues encountered.

### Completion Notes List

- Verified `packages/shared/src/session.ts` fully matches spec: exports `writeSession`, `readSession`, `clearSession`, `isProcessAlive` with correct behavior.
- `Session` type, `SESSION_PATH`, and `index.ts` re-exports all match AC exactly.
- All 25 tests pass (`pnpm --filter @kayman/shared test --run`), including all 5 session tests: round-trip, null-when-missing, stale PID detection+deletion, clearSession, clearSession idempotent.
- TypeScript build (`pnpm --filter @kayman/shared build`) succeeds with no errors.
- No code changes required — implementation was already correct and complete.

### File List

packages/shared/src/session.ts (modified — code review fixes)
packages/shared/src/session.test.ts (modified — code review fixes)
packages/shared/src/types.ts (read-only verification)
packages/shared/src/paths.ts (read-only verification)
packages/shared/src/index.ts (read-only verification)

### Change Log

- 2026-03-19: Verified existing session state manager implementation against all ACs. All 5 tests pass, TypeScript compiles clean. No code changes needed.
- 2026-03-19: Code review fixes applied — M1: added `isValidSession` runtime type guard replacing unsafe `as Session` cast; M2: `readSession` now rethrows non-ENOENT fs errors instead of swallowing all errors silently; M3: `writeSession` validates `pid > 0` and `audioPath` non-empty; M4: replaced `process.on('exit', ...)` listener leak with `afterAll` in test file. All 25 tests pass.
