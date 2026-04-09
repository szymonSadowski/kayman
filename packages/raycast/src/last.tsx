import fs from 'fs'
import { useEffect, useState } from 'react'
import { Detail } from '@raycast/api'
import { LAST_SUMMARY_PATH } from '@kayman/shared'
import type { Summary } from '@kayman/shared'

export default function Last() {
  const [markdown, setMarkdown] = useState<string>('Loading…')

  useEffect(() => {
    try {
      let pointerRaw: string
      try {
        pointerRaw = fs.readFileSync(LAST_SUMMARY_PATH, 'utf8')
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          setMarkdown('## No meeting summaries yet\n\nRun `kayman stop` after your next meeting.')
          return
        }
        throw err
      }
      const parsed = JSON.parse(pointerRaw) as unknown
      const summaryPath = parsed && typeof parsed === 'object' && 'summaryPath' in parsed
        ? (parsed as { summaryPath: unknown }).summaryPath
        : undefined
      if (typeof summaryPath !== 'string' || !summaryPath) {
        setMarkdown('## Error\n\nCorrupted last-summary pointer file.')
        return
      }
      const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Summary
      const project = summary.project ?? 'memo'
      setMarkdown(`# ${summary.title}\n\n*Project:* ${project}\n\n${summary.tldr}`)
    } catch (err: unknown) {
      setMarkdown(`## Error\n\n${(err as Error).message}`)
    }
  }, [])

  return <Detail markdown={markdown} />
}
