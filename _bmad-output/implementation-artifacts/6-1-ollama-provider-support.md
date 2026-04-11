# Story 6.1: Ollama Provider Support

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a privacy-conscious user,
I want to use Ollama for local AI summarization,
So that my meeting transcripts never leave my machine.

## Acceptance Criteria

1. **Given** `config.yaml` has `ai_provider: ollama` and `ai_model: llama3.2`
   **When** summarization runs
   **Then** it uses `@ai-sdk/ollama` to call the local Ollama server
   **And** the `generateText()` call and Zod structured output schema work identically to cloud providers
   **And** the `Summary` object has the same shape (`title`, `tldr`, `keyPoints`, `fullSummary`)

2. **Given** `ai_provider: ollama` is configured
   **When** config is loaded
   **Then** `ai_api_key` is NOT required (optional for Ollama)
   **And** an optional `ai_base_url` field defaults to `http://localhost:11434` if not set

3. **Given** Ollama is not running locally
   **When** summarization runs
   **Then** it throws `PipelineError(Summarizing, "Ollama not reachable at http://localhost:11434. Start Ollama or switch to an API provider with: kayman online")`

4. **Given** the configured Ollama model is not downloaded
   **When** summarization runs
   **Then** it throws `PipelineError(Summarizing, "Model 'llama3.2' not found in Ollama. Run: ollama pull llama3.2")`

5. **Given** `provider.ts` handles the new provider
   **When** `createProviderModel(config)` is called with `aiProvider: 'ollama'`
   **Then** it returns a valid `LanguageModel` via `createOllama({ baseURL })(aiModel)`
   **And** `SUPPORTED_PROVIDERS` is updated to include `'ollama'`

## Tasks / Subtasks

- [x] Task 1: Update `Config` interface and `loadConfig()` for Ollama (AC: 2)
  - [x] In `packages/shared/src/types.ts`: change `aiApiKey: string` → `aiApiKey?: string`, add `aiBaseUrl?: string`
  - [x] In `packages/shared/src/config.ts`: remove `'ai_api_key'` from `REQUIRED_FIELDS` (it becomes conditionally required)
  - [x] After parsing `ai_provider`, if `ai_provider !== 'ollama'` and `!parsed.ai_api_key` → throw `Config error: ai_api_key is required`
  - [x] Add `'ollama'` to `SUPPORTED_AI_PROVIDERS` array
  - [x] Parse `ai_base_url` from config and include in returned `Config` object: `aiBaseUrl: (parsed.ai_base_url as string | undefined) ?? undefined`
  - [x] Update `loadConfig()` return: `aiApiKey: parsed.ai_api_key as string | undefined`
  - [x] Run `pnpm -w build` and fix any TS errors caused by `aiApiKey` becoming optional (providers read `config.aiApiKey` — guard with `!` or `?? ''`)

- [x] Task 2: Add `@ai-sdk/ollama` to provider.ts (AC: 1, 5)
  - [x] Add package: used already-installed `ollama-ai-provider` (exports same `createOllama` API)
  - [x] In `packages/cli/src/pipeline/provider.ts`: import `createOllama` from `'ollama-ai-provider'`
  - [x] Add `'ollama'` to `SUPPORTED_PROVIDERS` const
  - [x] Add `case 'ollama':` to the switch
  - [x] Note: `createOllama` just returns a model factory — it does NOT make a network call at construction time. Network errors surface only when `generateText()` runs.

- [x] Task 3: Detect and rethrow Ollama-specific errors in `summarize.ts` (AC: 3, 4)
  - [x] In `packages/cli/src/pipeline/summarize.ts`, in the `catch (err)` block around `generateText()`, add Ollama error detection before the generic rethrow
  - [x] No changes needed to the happy path — `generateText()` with Ollama works identically to other providers

- [x] Task 4: Update preflight checks for Ollama (AC: 2 — `ai_api_key` not required)
  - [x] In `packages/cli/src/commands/preflight.ts`, step 3 (AI provider check): wrapped in `if (config.aiProvider !== 'ollama')` branch
  - [x] Added Ollama-specific reachability check via `fetch(baseURL + '/api/tags')` with 3s timeout
  - [x] The Notion check (step 4) is unchanged for 6.1 — Story 6.3 handles the offline Notion skip

- [x] Task 5: Write tests (AC: 1–5)
  - [x] `packages/cli/src/pipeline/provider.test.ts`: ollama returns LanguageModel, custom baseURL, unsupported provider throws
  - [x] `packages/shared/src/config.test.ts`: ollama loads without api key, non-ollama throws without key, ai_base_url parsing
  - [x] `packages/cli/src/pipeline/summarize.test.ts`: ECONNREFUSED → "Ollama not reachable", model not found error

## Dev Notes

### Critical: `aiApiKey` type change propagation

`Config.aiApiKey` changes from `string` to `string | undefined`. This will cause TypeScript errors in:
- `packages/cli/src/pipeline/provider.ts` — `createOpenAI({ apiKey: aiApiKey })` etc. need `apiKey: aiApiKey ?? ''` or add a guard. Better: the switch cases for non-Ollama providers should assert `aiApiKey` is defined (it's guaranteed by `loadConfig()` validation for non-Ollama), so `apiKey: aiApiKey!` is safe there.

### `@ai-sdk/ollama` baseURL convention

The Ollama API base URL convention for the AI SDK is the root URL WITHOUT `/api`:
```typescript
createOllama({ baseURL: 'http://localhost:11434/api' })
```
The `@ai-sdk/ollama` package expects the path to include `/api`. Double-check the installed version's README to confirm. If `ai_base_url` in config is `http://localhost:11434` (no `/api`), then append `/api` in `provider.ts`, not in config parsing.

### Ollama error messages (as of 2025)

When Ollama is not running, `fetch` to `http://localhost:11434` throws `TypeError: fetch failed` with `cause: Error: connect ECONNREFUSED 127.0.0.1:11434`. Check `err.message` and `(err as any).cause?.message` for ECONNREFUSED.

When a model is not pulled, Ollama returns HTTP 404 with body `{"error":"model 'X' not found, try pulling it first"}`. The AI SDK will surface this as an error whose message contains "not found".

### `SUPPORTED_PROVIDERS` — keep in sync

`SUPPORTED_PROVIDERS` exists in TWO places:
1. `packages/cli/src/pipeline/provider.ts` (type assertion + default error message)
2. `packages/shared/src/config.ts` (SUPPORTED_AI_PROVIDERS validation array)

Both must include `'ollama'` after this story. The validation error in `config.ts` currently reads:
> `ai_provider "X" is not supported. Supported values: openai, anthropic, google`

Update to include `ollama` in that message too.

### Preflight check for Ollama

In `preflight.ts`, the existing step 3 makes a live `generateText()` call to validate cloud API keys. For Ollama this is wrong (no API key, but we can check server reachability). Replace with:

```typescript
if (config.aiProvider === 'ollama') {
  const baseURL = config.aiBaseUrl ?? 'http://localhost:11434'
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    await fetch(baseURL + '/api/tags', { signal: controller.signal })
  } catch {
    process.stderr.write(error(`Ollama not reachable at ${baseURL}. Start Ollama first.`) + '\n')
    process.exit(1)
  } finally {
    clearTimeout(timeout)
  }
} else {
  // existing cloud provider check
  ...
}
```

### No changes to `summarize.ts` happy path

`generateText()` with Ollama works identically to cloud providers — same function call, same Zod schema, same output shape. Only the error catch block needs Ollama-specific handling.

### `help.ts` already anticipates Ollama commands

From Story 5.5 completion notes: `COMMAND_GROUPS` includes `config`, `models`, `offline`, `online` in the Setup group with descriptions but no `COMMAND_DETAILS` entries — they fall through to "Unknown command" intentionally until Epic 6 implements them. Story 6.1 does not implement these commands — no changes to `help.ts`.

### Project Structure Notes

**New files:**
- None

**Modified files:**
- `packages/shared/src/types.ts` — `Config` interface: `aiApiKey: string` → `aiApiKey?: string`, add `aiBaseUrl?: string`
- `packages/shared/src/config.ts` — conditional `ai_api_key` requirement, add `'ollama'` to providers, parse `ai_base_url`
- `packages/cli/src/pipeline/provider.ts` — import `createOllama`, add `'ollama'` case, update `SUPPORTED_PROVIDERS`
- `packages/cli/src/pipeline/summarize.ts` — Ollama error detection in catch block
- `packages/cli/src/commands/preflight.ts` — Ollama reachability check branch

**Package dependency change:**
- `packages/cli/package.json` — added `ollama-ai-provider@^1.2.0` (used instead of `@ai-sdk/ollama`; exports same `createOllama` API)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-6.1] — full ACs
- [Source: packages/cli/src/pipeline/provider.ts] — existing provider switch, `SUPPORTED_PROVIDERS` const
- [Source: packages/cli/src/pipeline/summarize.ts] — `generateText()` call + existing catch block to extend
- [Source: packages/shared/src/config.ts] — `REQUIRED_FIELDS`, `SUPPORTED_AI_PROVIDERS`, `loadConfig()` return
- [Source: packages/shared/src/types.ts] — `Config` interface definition
- [Source: packages/cli/src/commands/preflight.ts] — step 3 (AI check) to replace with Ollama branch
- [Source: packages/cli/package.json] — current `@ai-sdk/*` versions to match for `@ai-sdk/ollama`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Used `ollama-ai-provider` (already in `package.json`) instead of `@ai-sdk/ollama` — same `createOllama` API, avoids installing a duplicate
- `ollama-ai-provider` returns `LanguageModelV1` which required `as unknown as LanguageModel` cast due to `ai` SDK version mismatch
- `fetch failed` error from node-fetch doesn't contain `ECONNREFUSED` in `.message` but the `.cause.message` does — added cause inspection

### Completion Notes List

- All 5 tasks complete; 205 tests pass (57 shared + 148 cli), no regressions
- `aiApiKey` is now optional in `Config`; non-ollama providers guard with `!` assertion (guaranteed by `loadConfig()` validation)
- `ollama-ai-provider@^1.2.0` added to `packages/cli/package.json` (was not present before); `pnpm-lock.yaml` updated accordingly
- Preflight ollama branch: `fetch /api/tags` with 3s AbortController timeout; validates `response.ok`; exits 1 on failure
- Code review fixes: response.ok check in preflight, tightened ECONNRESET/ECONNREFUSED detection in summarize, added ECONNRESET test, corrected File List documentation

### File List

- `packages/shared/src/types.ts`
- `packages/shared/src/config.ts`
- `packages/cli/src/pipeline/provider.ts`
- `packages/cli/src/pipeline/summarize.ts`
- `packages/cli/src/commands/preflight.ts`
- `packages/cli/package.json`
- `pnpm-lock.yaml`
- `packages/shared/src/config.test.ts`
- `packages/cli/src/pipeline/provider.test.ts`
- `packages/cli/src/pipeline/summarize.test.ts`
