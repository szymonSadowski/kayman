# Story C3: Memo Auto-Tag and Focused Prompt

Status: done

## Story

As a power user,
I want `kayman memo` to automatically tag the session with "memo" and use a focused single-speaker AI prompt,
so that memo recordings produce useful personal notes rather than meeting summaries.

## Acceptance Criteria

1. **Given** `kayman memo` is run
   **When** recording starts
   **Then** `session.json` always has `tags: ['memo']`

2. **Given** a memo recording completes and the pipeline runs
   **When** AI summarization runs
   **Then** a single-speaker notes prompt is used (not the default meeting summary prompt)
   **And** the prompt focuses on: key points, action items, decisions — not meeting recap format

3. **Given** `kayman list --tag memo` is run after a memo recording
   **When** the command executes
   **Then** the memo recording appears in results

4. **Given** a regular `kayman start <project>` recording completes
   **When** AI summarization runs
   **Then** the default meeting summary prompt is used (no regression)

5. **Given** `kayman memo` runs and project is null
   **When** the pipeline detects `project: null` OR `tags.includes('memo')`
   **Then** the memo prompt is selected (both conditions should trigger it)

## Tasks / Subtasks

- [x] Task 1: Set `tags: ['memo']` in `memoCommand` (AC: 1, 3)
  - [x] In `packages/cli/src/commands/memo.ts`, change line: `writeSession({ ..., tags: [] })` → `writeSession({ ..., tags: ['memo'] })`
  - [x] That's the only change needed in memo.ts — one-liner
- [x] Task 2: Add memo prompt template to `buildPrompt()` in `packages/cli/src/pipeline/summarize.ts` (AC: 2, 4, 5)
  - [x] Add a `MEMO_PROMPT` constant for single-speaker focused notes
  - [x] In `buildPrompt(transcript, promptTemplate, isMemo?)` — add `isMemo` flag OR detect from caller
  - [x] When memo prompt selected: use structured notes format (see Dev Notes for prompt text)
  - [x] Default path unchanged when `isMemo` is false
- [x] Task 3: Thread memo detection through the pipeline (AC: 2, 5)
  - [x] `runner.ts` already receives `project` (null for memo) and `tags` (array)
  - [x] In `runner.ts`, pass `isMemo: project === null || tags.includes('memo')` to `runSummarize`
  - [x] In `runSummarize` signature: add `isMemo?: boolean` to input type
  - [x] In `runSummarize` body: pass `isMemo` to `buildPrompt(transcript, promptTemplate, isMemo)`
- [x] Task 4: Tests (AC: 1–5)
  - [x] `packages/cli/src/commands/memo.test.ts` — assert `writeSession` called with `tags: ['memo']`
  - [x] `packages/cli/src/pipeline/summarize.test.ts` — add test: `buildPrompt(transcript, undefined, true)` uses memo prompt content
  - [x] Add test: `buildPrompt(transcript, undefined, false)` uses default meeting prompt
  - [x] Add test: `buildPrompt(transcript, customTemplate, true)` still uses custom template (custom overrides memo)

## Dev Notes

### Change in `memo.ts`

Current line 35 in `packages/cli/src/commands/memo.ts`:
```ts
writeSession({ pid: child.pid!, audioPath, project: null, startedAt: new Date().toISOString(), tags: [] })
```

Change to:
```ts
writeSession({ pid: child.pid!, audioPath, project: null, startedAt: new Date().toISOString(), tags: ['memo'] })
```

### Memo Prompt Text

```
You are a personal note-taking assistant processing a voice memo — a single person thinking out loud.

Analyze the transcript below and return a structured JSON summary with:
- title: concise title describing the main topic (5-10 words)
- tldr: one-paragraph summary of the core idea or decision
- keyPoints: specific points, facts, ideas, or decisions mentioned (actionable where possible)
- fullSummary: complete structured notes including all details, next steps, and open questions

Rules:
- This is a solo recording (one speaker). Avoid meeting language like "participants discussed" or "the team agreed".
- Use first-person friendly language where natural ("decided to", "need to", "the idea is").
- Extract ALL action items and decisions explicitly.
- If the speaker mentions open questions or things to research, list them in fullSummary.
- Focus on substance — do not comment on recording quality or brevity.
```

### `buildPrompt` Signature Change

```ts
export function buildPrompt(
  transcript: string,
  promptTemplate?: string,
  isMemo = false,
): string {
  // Custom template always wins (per Story 5.4 spec)
  if (promptTemplate && promptTemplate.trim()) {
    return promptTemplate.trim() + '\nTranscript:\n' + transcript
  }

  // Memo detection: single-speaker focused prompt
  if (isMemo) {
    return MEMO_PROMPT + '\nTranscript:\n' + transcript
  }

  // Default meeting summary prompt (existing logic unchanged)
  ...
}
```

### `runSummarize` Input Type Change

```ts
export async function runSummarize(input: {
  transcriptPath: string
  project: string | null
  recordingDir: string
  config: Config
  isMemo?: boolean   // ← add this
}): Promise<Summary>
```

### `runner.ts` Change

In `runner.ts`, the runner already has `project` and `tags`:
```ts
const project = projectArg === '' ? null : projectArg
const tags = tagsArg ? tagsArg.split(',') : []
```

Add when calling `runSummarize`:
```ts
const summary = await runSummarize({
  transcriptPath,
  project,
  recordingDir: transcriptSaveDir,
  config,
  isMemo: project === null || tags.includes('memo'),  // ← add
})
```

### Custom Template Still Wins (AC: 4 edge case)

Per Story 5.4, a per-project custom `promptTemplate` always overrides the default prompt. The same priority applies here: `customTemplate > memo > default`. The `buildPrompt` implementation above already enforces this order.

For memo recordings (`project: null`), there's no project config, so `promptTemplate` will always be `undefined` — the memo prompt will always apply. No conflict.

### Project Structure Notes

**Modified files:**
- `packages/cli/src/commands/memo.ts` — 1-line change: `tags: ['memo']`
- `packages/cli/src/pipeline/summarize.ts` — add `MEMO_PROMPT` const, update `buildPrompt` signature and body, update `runSummarize` input type
- `packages/cli/src/pipeline/runner.ts` — pass `isMemo` to `runSummarize`
- `packages/cli/src/commands/memo.test.ts` — assert memo tag
- `packages/cli/src/pipeline/summarize.test.ts` — add buildPrompt memo tests

### References

- [Source: packages/cli/src/commands/memo.ts#L35] — `writeSession` call to update
- [Source: packages/cli/src/pipeline/summarize.ts#L16-L39] — `buildPrompt()` to extend
- [Source: packages/cli/src/pipeline/summarize.ts#L41-L116] — `runSummarize()` input type
- [Source: packages/cli/src/pipeline/runner.ts#L25-L27] — `project` and `tags` already parsed
- [Source: packages/cli/src/pipeline/runner.ts#L38-L45] — `runSummarize` call to update

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Task 1: `memo.ts` L35 — `tags: []` → `tags: ['memo']`
- Task 2: `summarize.ts` — added `MEMO_PROMPT` const, updated `buildPrompt` signature with `isMemo = false`, memo prompt selected when `isMemo=true` and no custom template
- Task 3: `runner.ts` — passes `isMemo: project === null || tags.includes('memo')` to `runSummarize`; `runSummarize` accepts `isMemo?` and forwards to `buildPrompt`
- Task 4: created `memo.test.ts` (tags assertion); added 3 `buildPrompt` memo tests to `summarize.test.ts`; all 200 tests pass

### File List

- packages/cli/src/commands/memo.ts
- packages/cli/src/pipeline/summarize.ts
- packages/cli/src/pipeline/runner.ts
- packages/cli/src/commands/memo.test.ts
- packages/cli/src/pipeline/summarize.test.ts

### Change Log

- 2026-04-21: Implemented C3 — memo auto-tag (`tags: ['memo']`) and focused single-speaker AI prompt; threaded `isMemo` flag through pipeline
