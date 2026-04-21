# Story C5: AI Cost Tracking — Price Column in Notion

Status: done

## Story

As a power user,
I want the Notion meeting entry to include the AI API cost for the summarization call,
so that I can track how much each meeting costs to process.

## Acceptance Criteria

1. **Given** a meeting is processed using a cloud AI provider (openai, anthropic, google)
   **When** the Notion entry is created
   **Then** a `Price` property is set to the USD cost of the summarization call (e.g. `0.0023`)

2. **Given** the AI SDK returns token usage (`promptTokens`, `completionTokens`, `totalTokens`)
   **When** summarization completes
   **Then** the cost is calculated from the token counts using a per-model pricing table

3. **Given** `ai_provider: ollama` is configured
   **When** a meeting is processed
   **Then** the `Price` property is set to `0` (local inference is free)

4. **Given** the model is not in the pricing table
   **When** cost is calculated
   **Then** `Price` is omitted from Notion (not written, no crash)

5. **Given** the `Price` property does not exist in the user's Notion database
   **When** the export runs
   **Then** the export succeeds (Notion silently ignores unknown properties) — no crash

## Tasks / Subtasks

- [x] Task 1: Add `cost?: number` field to `Summary` type in `packages/shared/src/types.ts` (AC: 1–3)
  - [x] Add `cost?: number` to the `Summary` interface

- [x] Task 2: Add pricing table and cost calculation to `packages/cli/src/pipeline/summarize.ts` (AC: 2, 3, 4)
  - [x] Create `MODEL_PRICING` map: `Record<string, { inputPerMToken: number; outputPerMToken: number }>`
  - [x] Populate with pricing for common models (see Dev Notes)
  - [x] Export helper `calculateCost(provider, model, usage): number | undefined` — uses `inputTokens`/`outputTokens` per Vercel AI SDK `LanguageModelUsage` type
  - [x] In `runSummarize()`: after `generateText()`, call `calculateCost(config.aiProvider, config.aiModel, result.usage)`
  - [x] Set `summary.cost` from calculated cost (ollama returns 0, unknown model returns undefined)

- [x] Task 3: Pass `cost` to `runExport` and write `Price` property in `packages/cli/src/pipeline/export.ts` (AC: 1, 3, 5)
  - [x] In `createPage()`: if `summary.cost !== undefined`, add `Price: { number: summary.cost }` to properties
  - [x] The `Price` property in Notion must be of type `number` — ensure the database has this column (doc in Dev Notes)

- [x] Task 4: Persist `cost` in `summary.json` (AC: 1–3)
  - [x] `runSummarize()` writes `summary.json` — `cost` field is included in the Summary object and persists automatically

- [x] Task 5: Tests (AC: 1–4)
  - [x] `summarize.test.ts` — `calculateCost` unit tests: known model, unknown model, ollama, undefined usage
  - [x] `summarize.test.ts` — `runSummarize` cost integration: known model sets correct cost, unknown model → undefined, ollama → 0
  - [x] `export.test.ts` — `Price` included when cost defined; omitted when undefined; cost=0 (ollama) still written

## Dev Notes

### Vercel AI SDK — Extracting Token Usage

`generateText()` returns `result.usage`:
```ts
const result = await generateText({
  model,
  output: Output.object({ schema: summarySchema }),
  prompt: buildPrompt(transcript, promptTemplate, isMemo),
})

// result.usage shape:
// { promptTokens: number, completionTokens: number, totalTokens: number }
const { promptTokens, completionTokens } = result.usage
```

The `usage` field is always present on `generateText` results for cloud providers. For Ollama, usage may be present but can be ignored (cost = 0).

### Pricing Table

Prices in USD per **million tokens**. Source: official provider pricing pages as of 2026-04.

```ts
const MODEL_PRICING: Record<string, { inputPerMToken: number; outputPerMToken: number }> = {
  // OpenAI
  'gpt-4o':              { inputPerMToken: 2.50,  outputPerMToken: 10.00 },
  'gpt-4o-mini':         { inputPerMToken: 0.15,  outputPerMToken: 0.60  },
  'gpt-4-turbo':         { inputPerMToken: 10.00, outputPerMToken: 30.00 },
  'gpt-3.5-turbo':       { inputPerMToken: 0.50,  outputPerMToken: 1.50  },
  // Anthropic
  'claude-opus-4-7':                { inputPerMToken: 15.00, outputPerMToken: 75.00 },
  'claude-sonnet-4-6':              { inputPerMToken: 3.00,  outputPerMToken: 15.00 },
  'claude-haiku-4-5-20251001':      { inputPerMToken: 0.80,  outputPerMToken: 4.00  },
  // Google
  'gemini-2.0-flash':    { inputPerMToken: 0.10,  outputPerMToken: 0.40  },
  'gemini-1.5-pro':      { inputPerMToken: 1.25,  outputPerMToken: 5.00  },
  'gemini-1.5-flash':    { inputPerMToken: 0.075, outputPerMToken: 0.30  },
}
```

### Cost Calculation

```ts
export function calculateCost(
  provider: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number },
): number | undefined {
  if (provider === 'ollama') return 0
  
  const pricing = MODEL_PRICING[model]
  if (!pricing) return undefined
  
  const inputCost  = (usage.promptTokens     / 1_000_000) * pricing.inputPerMToken
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPerMToken
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000  // round to 6 decimal places
}
```

### Notion `Price` Property

The `Price` column in the Notion database must be of type **Number**. Add it manually in Notion:
1. Open database → `+` (add property) → type `Number` → name `Price`
2. Optionally set format to `Dollar`

In `export.ts`, add to `properties`:
```ts
...(summary.cost !== undefined && {
  Price: { number: summary.cost },
}),
```

**Important:** If the `Price` property doesn't exist in Notion, the API silently ignores it (properties not in the schema are dropped). This means the export won't fail even if the user hasn't added the column — AC 5.

### `Summary` Type Change

```ts
export interface Summary {
  title: string
  tldr: string
  keyPoints: string[]
  fullSummary: string
  project: string | null
  recordedAt: string
  transcriptPath: string
  cost?: number        // ← add: USD cost of AI summarization call; 0 for ollama; undefined if unknown model
}
```

### `runSummarize` Integration Point

In `summarize.ts`, after the `generateText` call succeeds:

```ts
const result = await generateText({
  model,
  output: Output.object({ schema: summarySchema }),
  prompt: buildPrompt(transcript, promptTemplate, isMemo),
})
parsed = result.output

// ← Add cost calculation here:
const cost = calculateCost(config.aiProvider, config.aiModel, result.usage)
const resolvedCost = config.aiProvider === 'ollama' ? 0 : cost
```

Then include in the `Summary` object:
```ts
const summary: Summary = {
  ...
  cost: resolvedCost,
}
```

### Pricing Table Maintenance

The pricing table will become stale as providers change pricing. Keep it in a single place (`summarize.ts` or a new `pricing.ts` file for easier updates). Consider a comment noting the last verified date.

If the user is using a custom/fine-tuned model not in the table, `calculateCost` returns `undefined` and `Price` is omitted from Notion — clean degradation.

### Project Structure Notes

**Modified files:**
- `packages/shared/src/types.ts` — add `cost?: number` to `Summary` interface
- `packages/cli/src/pipeline/summarize.ts` — add `MODEL_PRICING`, `calculateCost()`, set `summary.cost`
- `packages/cli/src/pipeline/export.ts` — write `Price` property to Notion when `summary.cost !== undefined`
- `packages/cli/src/pipeline/summarize.test.ts` — add cost calculation tests
- `packages/cli/src/pipeline/export.test.ts` — add Price property tests

**No new files required** (or optionally extract to `pricing.ts` for cleanliness).

### References

- [Source: packages/cli/src/pipeline/summarize.ts#L41-L116] — `runSummarize` where `generateText` is called
- [Source: packages/cli/src/pipeline/export.ts#L27-L75] — `createPage` where Notion properties are set
- [Source: packages/shared/src/types.ts#L41-L49] — `Summary` interface to extend
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — original summarization story for context

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

- `packages/shared/src/types.ts`
- `packages/cli/src/pipeline/summarize.ts`
- `packages/cli/src/pipeline/export.ts`
- `packages/cli/src/pipeline/summarize.test.ts`
- `packages/cli/src/pipeline/export.test.ts`
