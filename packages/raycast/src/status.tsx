import { useEffect, useState } from 'react'
import { Detail } from '@raycast/api'
import { readSession } from '@kayman/shared'

export default function Status() {
  const [markdown, setMarkdown] = useState<string>('Loading…')

  useEffect(() => {
    try {
      const session = readSession()
      if (!session) {
        setMarkdown('## No active recording')
        return
      }
      const elapsedMs = Date.now() - new Date(session.startedAt).getTime()
      const elapsedSec = Number.isFinite(elapsedMs) ? Math.floor(elapsedMs / 1000) : 0
      const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
      const ss = String(elapsedSec % 60).padStart(2, '0')
      const project = session.project ?? 'memo'
      setMarkdown(`## Recording active\n\n**Project:** ${project}\n\n**Duration:** ${mm}:${ss}`)
    } catch (err: unknown) {
      setMarkdown(`## Error\n\n${(err as Error).message}`)
    }
  }, [])

  return <Detail markdown={markdown} />
}
