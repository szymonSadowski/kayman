# Story 3.3: AI Summarization & Personal Spotlight

Status: review

## Story

As a power user,
I want my transcript summarized by an AI and my name bolded in Key Points,
so that I can instantly find the moments that involved me (the Personal Spotlight feature).

## Acceptance Criteria

1. `runSummarize({ transcriptPath, config })` calls `generateText()` via Vercel AI SDK (non-streaming) and returns a `Summary` object with `title`, `tldr`, `keyPoints`, `fullSummary`
2. All occurrences of `config.userName` in `keyPoints` are wrapped in `**bold**` markdown via `applySpotlight()`
3. AI-generated title included in the `Summary` object when none provided (FR10)
4. AI provider errors throw `PipelineError(PipelineStage.Summarizing, "[provider error message]")`
5. `summary.json` written to `transcriptDir` alongside transcript (for failure preservation)
6. Unit tests cover spotlight bolding, missing name (no change), and multiple occurrences

## Tasks / Subtasks

- [x] Task 1: Add dependencies to `packages/cli/package.json`
  - [x] Add `ai` (Vercel AI SDK) and `@ai-sdk/openai`
  - [x] Run `pnpm install`
- [x] Task 2: Implement `runSummarize` in `packages/cli/src/pipeline/summarize.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Read transcript file content
  - [x] Build structured prompt requesting title, TL;DR, key points array, full summary as JSON
  - [x] Instantiate provider from `config.aiProvider` / `config.aiModel` / `config.aiApiKey`
  - [x] Call `generateText({ model, prompt })` — non-streaming
  - [x] Parse JSON response into `Summary` shape
  - [x] Apply `applySpotlight(keyPoints, config.userName)` from `@kayman/shared`
  - [x] Write `summary.json` to same directory as transcript (AC: 5)
  - [x] Catch AI SDK errors → throw `PipelineError(PipelineStage.Summarizing, err.message)` (AC: 4)
- [x] Task 3: Write tests in `packages/cli/src/pipeline/summarize.test.ts` (AC: 6)
  - [x] Mock `generateText` (vi.mock `ai`)
  - [x] Test: returns correct Summary shape (AC: 1)
  - [x] Test: spotlight applied to keyPoints (AC: 2)
  - [x] Test: spotlight no-op when userName not in keyPoints (AC: 6)
  - [x] Test: spotlight applied to multiple occurrences in multiple points (AC: 6)
  - [x] Test: AI error → PipelineError thrown (AC: 4)

## Dev Notes

### Vercel AI SDK Pattern

```typescript
import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({ apiKey: config.aiApiKey })
const { text } = await generateText({
  model: openai(config.aiModel),
  prompt: summaryPrompt,
})
```

For non-OpenAI providers (e.g. anthropic), add the relevant `@ai-sdk/<provider>` package.
For MVP, start with OpenAI — `config.aiProvider === 'openai'`.

### Prompt Design

Request JSON output with this structure:
```json
{
  "title": "Meeting title",
  "tldr": "One-paragraph summary",
  "keyPoints": ["Point 1", "Point 2"],
  "fullSummary": "Full detailed summary"
}
```

Parse with `JSON.parse()` — handle parse errors as `PipelineError`.

### Spotlight Integration

`applySpotlight(keyPoints, userName)` is already implemented in `@kayman/shared/spotlight.ts`.
Import from `@kayman/shared` — do NOT re-implement.

```typescript
import { applySpotlight } from '@kayman/shared'
const boldedPoints = applySpotlight(parsedSummary.keyPoints, config.userName)
```

### Summary JSON Schema

```typescript
interface Summary {
  title: string
  tldr: string
  keyPoints: string[]   // spotlight-bolded
  fullSummary: string
  project: string | null  // passed in from pipeline args
  recordedAt: string      // ISO 8601
  transcriptPath: string  // absolute path
}
```

Defined in `packages/shared/src/types.ts` — import from `@kayman/shared`.

### summary.json Preservation

Write `summary.json` in the same dir as `transcript.txt` before returning — if Notion export
fails in story 3.5, this file is preserved for recovery.

### Project Structure Notes

- New file: `packages/cli/src/pipeline/summarize.ts`
- New file: `packages/cli/src/pipeline/summarize.test.ts`
- Modify: `packages/cli/package.json` (add `ai`, `@ai-sdk/openai`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API-&-Communication-Patterns] — Vercel AI SDK pattern
- [Source: _bmad-output/planning-artifacts/architecture.md#Format-Patterns] — Summary JSON schema
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3]
- [Source: packages/shared/src/spotlight.ts] — applySpotlight already implemented
- [Source: packages/shared/src/types.ts] — Summary type

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- runSummarize uses Vercel AI SDK generateText (non-streaming), @ai-sdk/openai provider
- Prompt requests structured JSON with title/tldr/keyPoints/fullSummary
- applySpotlight applied to keyPoints before returning Summary
- summary.json written to recordingDir for failure preservation
- 7 tests: Summary shape, spotlight applied, spotlight no-op, multiple occurrences, AI error, PipelineError stage, summary.json written

### File List

- packages/cli/src/pipeline/summarize.ts (new)
- packages/cli/src/pipeline/summarize.test.ts (new)
- packages/cli/package.json (added ai, @ai-sdk/openai)

### Change Log

- 2026-04-03: Implemented and tested.
