import fs from 'fs'
import path from 'path'
import { DATA_DIR, info, bold, dim } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

interface ListOptions {
  project?: string
  from?: string
  to?: string
  tag?: string[]
}

interface RecordingEntry {
  date: string
  project: string
  title: string
  tags: string[]
  dir: string
}

function loadRecordings(): RecordingEntry[] {
  const recordingsDir = path.join(DATA_DIR, 'recordings')
  let dirs: string[]
  try {
    dirs = fs.readdirSync(recordingsDir)
  } catch {
    return []
  }

  const entries: RecordingEntry[] = []

  for (const dir of dirs) {
    const summaryPath = path.join(recordingsDir, dir, 'summary.json')
    try {
      const raw = fs.readFileSync(summaryPath, 'utf8')
      const summary: Summary = JSON.parse(raw)
      const sessionPath = path.join(recordingsDir, dir, 'session.json')
      let tags: string[] = []
      try {
        const sessionRaw = fs.readFileSync(sessionPath, 'utf8')
        const session = JSON.parse(sessionRaw)
        if (Array.isArray(session.tags)) tags = session.tags
      } catch {
        // no session file or no tags
      }

      const date = summary.recordedAt.slice(0, 10)
      entries.push({
        date,
        project: summary.project ?? 'memo',
        title: summary.title,
        tags,
        dir,
      })
    } catch {
      // no summary.json or malformed — skip silently
    }
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date))
}

export async function listCommand(_config: Config, opts: ListOptions): Promise<void> {
  let recordings = loadRecordings()

  if (recordings.length === 0) {
    process.stdout.write(info('No recordings found.') + '\n')
    return
  }

  if (opts.project) {
    const proj = opts.project.toLowerCase()
    recordings = recordings.filter((r) => r.project.toLowerCase() === proj)
  }

  if (opts.from) {
    recordings = recordings.filter((r) => r.date >= opts.from!)
  }

  if (opts.to) {
    recordings = recordings.filter((r) => r.date <= opts.to!)
  }

  if (opts.tag && opts.tag.length > 0) {
    const filterTags = opts.tag.map((t) => t.toLowerCase())
    recordings = recordings.filter((r) =>
      filterTags.every((ft) => r.tags.some((t) => t.toLowerCase() === ft)),
    )
  }

  if (recordings.length === 0) {
    const filters: string[] = []
    if (opts.project) filters.push(`project "${opts.project}"`)
    if (opts.from) filters.push(`from ${opts.from}`)
    if (opts.to) filters.push(`to ${opts.to}`)
    if (opts.tag && opts.tag.length > 0) filters.push(`tags [${opts.tag.join(', ')}]`)
    const suffix = filters.length > 0 ? ` matching ${filters.join(', ')}` : ''
    process.stdout.write(info(`No recordings found${suffix}.`) + '\n')
    return
  }

  for (const r of recordings) {
    const tagsStr = r.tags.length > 0 ? ` [${r.tags.join(', ')}]` : ''
    process.stdout.write(`${dim(r.date)}  ${bold(r.project)}  ${r.title}${tagsStr}\n`)
  }
}
