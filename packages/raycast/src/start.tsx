import { useEffect, useState } from 'react'
import { List, showToast, Toast, ActionPanel, Action } from '@raycast/api'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { runKayman, showKaymanError } from './lib/cli'

export default function Start() {
  const [config, setConfig] = useState<Config | null>(null)
  const [error, setError] = useState<string | null>(null)

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
                onAction={async () => {
                  try {
                    await runKayman(['start', p.name])
                    await showToast({ style: Toast.Style.Success, title: 'Recording started', message: p.name })
                  } catch (err) {
                    await showKaymanError(err)
                  }
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  )
}
