# Story R1: Tag Support in Raycast Start Command

Status: ready-for-dev

## Story

As a power user,
I want to add tags when starting a recording from Raycast,
so that my recordings are categorized without switching to the terminal.

## Acceptance Criteria

1. **Given** the user opens the Start Recording command in Raycast
   **When** a project is selected
   **Then** a tag input step appears allowing free-text tag entry

2. **Given** the user enters tags (e.g. "daily client")
   **When** they confirm and start recording
   **Then** `kayman start <project> --tags daily client` is invoked via execa
   **And** tags are stored in `session.json`

3. **Given** the user skips the tag input (submits empty)
   **When** recording starts
   **Then** `kayman start <project>` is invoked without `--tags` (no empty array passed)
   **And** no regression on tag-free recordings

4. **Given** tags are entered and the recording completes
   **When** `kayman list --tag daily` is run
   **Then** the recording appears in results

## Tasks / Subtasks

- [ ] Task 1: Add tag input step to `packages/raycast/src/start.tsx` (AC: 1, 2, 3)
  - [ ] After project selection, show a second view with a `<Form>` containing a `<Form.TextField name="tags" title="Tags" placeholder="daily client (space-separated, optional)" />`
  - [ ] On form submit: parse tags by splitting on whitespace, filter empty strings
  - [ ] Build CLI args: if tags non-empty → `['start', project, '--tags', ...tags]`; if empty → `['start', project]`
  - [ ] Call `runKayman(args)` with the constructed args
  - [ ] Show success toast with project name (and tag count if tags present)
- [ ] Task 2: Handle Raycast state flow (AC: 1–3)
  - [ ] Use `useState` to track `selectedProject: string | null` (null = project list shown, non-null = tag form shown)
  - [ ] When project selected from list → set `selectedProject`, render `<Form>` for tag input
  - [ ] When tag form submitted → run `kayman start` and show toast
  - [ ] When tag form dismissed (Escape) → return to project list (`setSelectedProject(null)`)
- [ ] Task 3: Verify CLI `--tags` flag compatibility (AC: 2, 4)
  - [ ] Confirm `kayman start` CLI accepts `--tags tag1 tag2` (multiple space-separated values) — it does, per `index.ts` `.option('--tags <tags...>')`
  - [ ] When passing via execa: `runKayman(['start', project, '--tags', 'daily', 'client'])` — each tag as separate array element

## Dev Notes

### Current `start.tsx` Flow

The current implementation in `packages/raycast/src/start.tsx`:
1. Loads config to get `config.projects`
2. Renders a `<List>` of projects
3. On project select: runs `runKayman(['start', p.name])` directly

### New Flow

```
<List> (project picker)
   → user selects project → selectedProject = p.name
   
<Form> (tag input)  
   → user fills or skips tags → submit
   → runKayman(['start', project, ...tagArgs])
   → showToast success
```

### Raycast `<Form>` Implementation

```tsx
import { List, Form, showToast, Toast, ActionPanel, Action } from '@raycast/api'

// State:
const [selectedProject, setSelectedProject] = useState<string | null>(null)

// Tag form:
if (selectedProject !== null) {
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={`Start ${selectedProject}`}
            onSubmit={async (values: { tags: string }) => {
              const tags = values.tags.trim().split(/\s+/).filter(Boolean)
              const args: string[] = ['start', selectedProject]
              if (tags.length > 0) args.push('--tags', ...tags)
              try {
                await runKayman(args)
                await showToast({
                  style: Toast.Style.Success,
                  title: 'Recording started',
                  message: tags.length > 0 ? `${selectedProject} [${tags.join(', ')}]` : selectedProject,
                })
              } catch (err) {
                await showKaymanError(err)
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="daily client standup (space-separated, optional)"
      />
    </Form>
  )
}
```

### Back Navigation

Raycast `<Form>` doesn't have a built-in "back" button. To allow returning to the project list:
- Add a secondary action in the `<ActionPanel>`: `<Action title="Back to Projects" onAction={() => setSelectedProject(null)} />`
- User can also press Escape to close the command entirely (standard Raycast behavior)

### `runKayman` is already execa-based

`packages/raycast/src/lib/cli.ts` — `runKayman` already uses `execa`. No changes needed there.

### Project Structure Notes

**Modified files:**
- `packages/raycast/src/start.tsx` — add tag form step and state management

**No new files needed.**

### References

- [Source: packages/raycast/src/start.tsx] — current implementation to extend
- [Source: packages/raycast/src/lib/cli.ts] — `runKayman` helper
- [Source: packages/cli/src/index.ts#L49] — `--tags <tags...>` option registration confirming multi-value support

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
