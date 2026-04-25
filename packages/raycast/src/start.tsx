import { useEffect, useState } from 'react'
import { List, Form, showToast, Toast, ActionPanel, Action, popToRoot } from '@raycast/api'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { runKayman, showKaymanError } from './lib/cli'

export default function Start() {
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)

  useEffect(() => {
    try {
      setConfig(loadConfig())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  if (error) {
    return <List><List.EmptyView title="Config error" description={error} /></List>
  }

  if (!config) {
    return <List isLoading />
  }

  if (config.projects.length === 0) {
    return (
      <List>
        <List.EmptyView
          title="No projects configured"
          description="Add projects to ~/.config/kayman/config.yaml"
        />
      </List>
    )
  }

  if (selectedProject !== null) {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title={`Start ${selectedProject}`}
              onSubmit={async (values: { tags: string }) => {
                const tags = (values.tags ?? '').trim().split(/\s+/).filter(Boolean)
                const args: string[] = ['start', selectedProject]
                if (tags.length > 0) args.push('--tags', ...tags)
                try {
                  await runKayman(args)
                  await showToast({
                    style: Toast.Style.Success,
                    title: 'Recording started',
                    message: tags.length > 0 ? `${selectedProject} [${tags.join(', ')}]` : selectedProject,
                  })
                  setSelectedProject(null)
                  await popToRoot()
                } catch (err) {
                  await showKaymanError(err)
                }
              }}
            />
            <Action title="Back to Projects" onAction={() => setSelectedProject(null)} />
          </ActionPanel>
        }
      >
        <Form.TextField
          id="tags"
          title="Tags"
          placeholder="daily client standup (space-separated, optional)"
          autoFocus
        />
      </Form>
    )
  }

  return (
    <List>
      {config.projects.map((p) => (
        <List.Item
          key={p.name}
          title={p.name}
          actions={
            <ActionPanel>
              <Action
                title={`Start ${p.name}`}
                onAction={() => setSelectedProject(p.name)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}
