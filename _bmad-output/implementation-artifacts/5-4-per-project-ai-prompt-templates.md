# Story 5.4: Per-Project AI Prompt Templates

Status: done

## Story

As a power user,
I want to configure custom AI summary prompts per project,
so that standup notes are formatted differently from client demo summaries.

## Acceptance Criteria

1. **Given** a project in `config.yaml` has a `prompt_template` field
   **When** summarization runs for that project
   **Then** the custom template is used instead of the default prompt in `buildPrompt()`
   **And** the transcript is appended after the template
   **And** AI still returns the standard structured output (`title`, `tldr`, `keyPoints`, `fullSummary`)

2. **Given** a project has no `prompt_template` field
   **When** summarization runs
   **Then** the default prompt is used unchanged

3. **Given** a memo recording (no project)
   **When** summarization runs
   **Then** the default prompt is used

4. **Given** `prompt_template` is configured
   **When** config is loaded
   **Then** `Config.projects` type includes `promptTemplate?: string`

5. **Given** `prompt_template` is an empty string
   **When** summarization runs
   **Then** the default prompt is used (empty treated as unset)

6. **Given** `prompt_template` omits the transcript section
   **When** summarization runs
   **Then** system auto-appends `\nTranscript:\n<transcript>` after the template

## Tasks / Subtasks

- [x] Task 1: Update `Config.projects` type in `packages/shared/src/types.ts` (AC: 4)
  - [x] Change `projects: Array<{ name: string; notionPageId: string }>` → `projects: Array<{ name: string; notionPageId: string; promptTemplate?: string }>`

- [x] Task 2: Update config parser in `packages/shared/src/config.ts` (AC: 4)
  - [x] In the `projects` map, add `promptTemplate: p.prompt_template as string | undefined`
  - [x] No new REQUIRED_FIELDS entry — `prompt_template` is optional

- [x] Task 3: Update `buildPrompt()` in `packages/cli/src/pipeline/summarize.ts` to accept custom template (AC: 1, 2, 3, 5, 6)
  - [x] Change signature: `function buildPrompt(transcript: string, promptTemplate?: string): string`
  - [x] If `promptTemplate` is provided and `promptTemplate.trim()` is non-empty:
    - Return `promptTemplate + '\nTranscript:\n' + transcript`
  - [x] Otherwise: return the existing default prompt logic (unchanged)
  - [x] Note: always auto-append `\nTranscript:\n<transcript>` for custom templates (AC6) — users don't include transcript in their template

- [x] Task 4: Update `runSummarize()` to look up project's `promptTemplate` and pass to `buildPrompt()` (AC: 1, 2, 3)
  - [x] In `runSummarize()`, after reading transcript: look up `promptTemplate` from `config.projects`
  - [x] Find project: `config.projects.find(p => p.name === project)`
  - [x] If project found and has `promptTemplate`: pass it to `buildPrompt(transcript, projectConfig.promptTemplate)`
  - [x] If project is null (memo) or has no `promptTemplate` or has empty `promptTemplate`: pass undefined → use default
  - [x] No changes to the `generateText()` call — same schema, same structured output format

- [x] Task 5: Add/update tests (AC: 1–6)
  - [x] `packages/shared/src/config.test.ts`: verify `prompt_template` in project YAML maps to `promptTemplate` in parsed config
  - [x] `packages/cli/src/pipeline/summarize.test.ts`:
    - `buildPrompt(transcript, template)` → returns `template + '\nTranscript:\n' + transcript`
    - `buildPrompt(transcript, '')` → returns default prompt (empty string treated as unset)
    - `buildPrompt(transcript, undefined)` → returns default prompt
    - `runSummarize` with project that has `promptTemplate` → `generateText` called with custom prompt
    - `runSummarize` with project that has no `promptTemplate` → `generateText` called with default prompt
    - `runSummarize` with `project = null` (memo) → `generateText` called with default prompt

## Dev Notes

### Minimal scope — 3 files to change

This is a small story. Only 3 source files change:
1. `packages/shared/src/types.ts` — add optional field to type
2. `packages/shared/src/config.ts` — parse optional field in projects map
3. `packages/cli/src/pipeline/summarize.ts` — update `buildPrompt()` + project lookup in `runSummarize()`

### `types.ts` change

```typescript
// packages/shared/src/types.ts
export interface Config {
  // ... existing fields unchanged ...
  projects: Array<{ name: string; notionPageId: string; promptTemplate?: string }>  // add promptTemplate
  // ... rest unchanged ...
}
```

### `config.ts` change

```typescript
// packages/shared/src/config.ts — in loadConfig(), projects map
projects: (
  (parsed.projects as Array<{ name: string; notion_page_id: string; prompt_template?: string }>) ?? []
).map((p) => ({
  name: p.name,
  notionPageId: p.notion_page_id,
  promptTemplate: p.prompt_template,   // new — undefined if not set
})),
```

### `summarize.ts` changes

```typescript
// buildPrompt — add optional promptTemplate param
function buildPrompt(transcript: string, promptTemplate?: string): string {
  // Use custom template if provided and non-empty
  if (promptTemplate && promptTemplate.trim()) {
    return promptTemplate + '\nTranscript:\n' + transcript
  }

  // Default prompt (existing logic — unchanged)
  const wordCount = transcript.split(/\s+/).length
  const shortTranscript = wordCount < 300
  return `You are an expert summarizer...
...
${shortTranscript ? '- The transcript is short so every sentence matters. Include ALL information mentioned.\n' : ''}
Transcript:
${transcript}`
}

// runSummarize — look up project's promptTemplate
export async function runSummarize(input: {
  transcriptPath: string
  project: string | null
  recordingDir: string
  config: Config
}): Promise<Summary> {
  const { transcriptPath, project, recordingDir, config } = input

  const transcript = fs.readFileSync(transcriptPath, 'utf8')

  // Empty transcript check (from Story 5.2, if already merged)
  if (!transcript.trim()) { /* ... */ }

  // Look up project's custom prompt template
  const projectConfig = project ? config.projects.find(p => p.name === project) : undefined
  const promptTemplate = projectConfig?.promptTemplate

  const model = createProviderModel(config)
  // ... rest unchanged, just pass promptTemplate to buildPrompt:
  const result = await generateText({
    model,
    output: Output.object({ schema: summarySchema }),
    prompt: buildPrompt(transcript, promptTemplate),  // pass promptTemplate here
  })
  // ... rest unchanged
}
```

### Example `config.yaml` usage

```yaml
projects:
  - name: Daily Standup
    notion_page_id: abc123
    prompt_template: |
      You are summarizing a daily standup meeting. Focus on:
      - What was completed yesterday
      - What is planned for today
      - Any blockers

      Return JSON with title, tldr (one sentence), keyPoints (3 bullets max), fullSummary.

  - name: Client Demo
    notion_page_id: def456
    # no prompt_template → uses default
```

The system auto-appends `\nTranscript:\n<transcript>` after the custom template.

### What NOT to change

- `buildPrompt()` default logic — keep exactly as-is; custom template is additive
- `generateText()` call — schema unchanged; custom prompt still returns structured JSON
- All other pipeline files — untouched
- CLI commands — untouched
- Raycast — untouched

### Project Structure Notes

**Modified files:**
- `packages/shared/src/types.ts` — add `promptTemplate?` to Config.projects
- `packages/shared/src/config.ts` — parse `prompt_template` in projects map
- `packages/cli/src/pipeline/summarize.ts` — update `buildPrompt()` + project lookup

**Updated test files:**
- `packages/shared/src/config.test.ts` — add `promptTemplate` parsing test
- `packages/cli/src/pipeline/summarize.test.ts` — add custom template tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.4] — full ACs
- [Source: packages/shared/src/types.ts:19-30] — `Config` interface to extend
- [Source: packages/shared/src/config.ts:67-75] — projects map to update
- [Source: packages/cli/src/pipeline/summarize.ts:16-35] — `buildPrompt()` to extend
- [Source: packages/cli/src/pipeline/summarize.ts:37-82] — `runSummarize()` to update
- [Source: _bmad-output/planning-artifacts/architecture.md#Deferred-Decisions] — "Per-project prompt overrides (Phase 2)" — config.ts + summarize.ts extension points already exist per arch doc

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Exported `buildPrompt` from summarize.ts to enable direct unit testing
- `promptTemplate` field is optional; empty/whitespace treated as unset (falls back to default prompt)
- `runSummarize` resolves project config before AI call; memo recordings (project=null) always use default prompt
- All 180 tests pass (51 shared, 129 cli)

### File List

- packages/shared/src/types.ts
- packages/shared/src/config.ts
- packages/shared/src/config.test.ts
- packages/cli/src/pipeline/summarize.ts
- packages/cli/src/pipeline/summarize.test.ts

## Change Log

- 2026-04-09: Story created
- 2026-04-10: Implemented — promptTemplate support in config + summarize pipeline
- 2026-04-10: Code review fixes — trim template in buildPrompt; skip short-transcript append when custom template used; runtime type validation for prompt_template in config; added missing tests (project not found, short+template interaction, whitespace trim, empty string config, non-string config validation)
