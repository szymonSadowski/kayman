# Story 3.4: Notion Export Stage

Status: review

## Story

As a power user,
I want my meeting summary exported to Notion as a structured entry tagged to my project,
so that I can find it before my next meeting without any manual work.

## Acceptance Criteria

1. `runExport({ summary, config })` creates a Notion database entry with Title, TL;DR, Key Points (spotlight applied), and Full Summary sections (FR17)
2. Entry is tagged with the associated project's `notion_page_id` (FR16)
3. If `summary.project === null` (memo mode): entry associated with Memos section in Notion (FR18)
4. On 429 or 5xx: retries up to 3 times with exponential backoff (base 1s, max 8s) before throwing `PipelineError` (NFR8)
5. On 401: throws `PipelineError(PipelineStage.Exporting, "Notion auth failed: check notion_token in config")` immediately — no retry
6. Returns Notion page ID on success

## Tasks / Subtasks

- [x] Task 1: Add `@notionhq/client` to `packages/cli/package.json` and run `pnpm install`
- [x] Task 2: Implement `runExport` in `packages/cli/src/pipeline/export.ts` (AC: 1, 2, 3, 6)
  - [x] Create `@notionhq/client` Client with `config.notionToken`
  - [x] Look up project's `notionPageId` from `config.projects` array when `summary.project !== null`
  - [x] Build Notion page properties: Title (title), TL;DR (rich_text), Key Points (rich_text), Full Summary (rich_text)
  - [x] Call `notion.pages.create(...)` with `database_id: config.notionDatabaseId`
  - [x] Return created page ID (AC: 6)
- [x] Task 3: Implement retry logic (AC: 4, 5)
  - [x] Wrap `notion.pages.create` call in retry loop: max 3 attempts
  - [x] On 429/5xx: `await sleep(Math.min(1000 * 2 ** attempt, 8000))` before retry
  - [x] On 401: throw `PipelineError` immediately without retry (AC: 5)
  - [x] After 3 failures: throw `PipelineError(PipelineStage.Exporting, "Notion export failed after 3 attempts: ...")`
- [x] Task 4: Write tests in `packages/cli/src/pipeline/export.test.ts`
  - [x] Mock `@notionhq/client` (vi.mock)
  - [x] Test: happy path with project → page created, returns ID (AC: 1, 2, 6)
  - [x] Test: memo mode (project null) → Project property omitted (AC: 3)
  - [x] Test: 429 → retries 3 times then throws PipelineError (AC: 4)
  - [x] Test: 401 → throws PipelineError immediately, no retry (AC: 5)
  - [x] Test: 5xx → retries then succeeds (AC: 4)

## Dev Notes

### Notion Client Pattern

```typescript
import { Client } from '@notionhq/client'

const notion = new Client({ auth: config.notionToken })
const page = await notion.pages.create({
  parent: { database_id: config.notionDatabaseId },
  properties: {
    title: { title: [{ text: { content: summary.title } }] },
    // ... other properties
  },
})
return page.id
```

### Retry Pattern (exponential backoff)

```typescript
let lastErr: Error | undefined
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    return await notion.pages.create(...)
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 401) throw new PipelineError(PipelineStage.Exporting, 'Notion auth failed: check notion_token in config')
    if (status === 429 || (status && status >= 500)) {
      lastErr = err as Error
      await sleep(Math.min(1000 * Math.pow(2, attempt), 8000))
      continue
    }
    throw new PipelineError(PipelineStage.Exporting, (err as Error).message)
  }
}
throw new PipelineError(PipelineStage.Exporting, `Notion export failed after 3 attempts: ${lastErr?.message}`)
```

### Notion Database Schema Assumption

The target Notion database is expected to have these properties:
- `Name` (title): meeting title
- `TL;DR` (rich_text): one-paragraph summary
- `Key Points` (rich_text): formatted key points with spotlight bolding
- `Full Summary` (rich_text): full meeting summary
- `Project` (relation or select): links to project page if not memo

The exact property names depend on the user's Notion database setup. Use `Name` for title (Notion default). Keep Key Points as newline-joined string for MVP.

### Memo Mode

When `summary.project === null`, apply a "Memos" tag or leave project relation empty — depends on Notion DB structure. For MVP: omit project relation property when memo.

### Project Structure Notes

- New file: `packages/cli/src/pipeline/export.ts`
- New file: `packages/cli/src/pipeline/export.test.ts`
- Modify: `packages/cli/package.json` (add `@notionhq/client`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#API-&-Communication-Patterns] — Notion retry policy
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.4]
- [Source: packages/shared/src/types.ts] — Summary type, PipelineError, PipelineStage

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None.

### Completion Notes List

- runExport uses @notionhq/client with retry loop (max 3, exponential backoff, base 1s max 8s)
- 401 fails immediately without retry; 429/5xx retried; other errors thrown directly
- Project relation included via config.projects lookup; omitted in memo mode
- setTimeout stubbed in tests to make sleep() resolve instantly
- 7 tests: happy path, project relation, memo mode, 401 no-retry, 429 retry exhaust, 5xx retry+succeed, PipelineError stage

### File List

- packages/cli/src/pipeline/export.ts (new)
- packages/cli/src/pipeline/export.test.ts (new)
- packages/cli/package.json (added @notionhq/client)

### Change Log

- 2026-04-03: Implemented and tested.
