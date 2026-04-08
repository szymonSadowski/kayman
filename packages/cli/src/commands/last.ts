import fs from 'fs'
import { LAST_SUMMARY_PATH } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

export async function lastCommand(_config: Config): Promise<void> {
  let pointerRaw: string
  try {
    pointerRaw = fs.readFileSync(LAST_SUMMARY_PATH, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      process.stdout.write('No meeting summaries yet. Run kayman stop after your next meeting.\n')
      return
    }
    process.stderr.write(`kayman last: failed to read ${LAST_SUMMARY_PATH}: ${(err as Error).message}\n`)
    process.exit(1)
  }

  let summaryPath: string
  try {
    const parsed = JSON.parse(pointerRaw) as { summaryPath?: unknown }
    if (typeof parsed.summaryPath !== 'string') {
      throw new Error('missing summaryPath')
    }
    summaryPath = parsed.summaryPath
  } catch (err) {
    process.stderr.write(`kayman last: malformed pointer file at ${LAST_SUMMARY_PATH}: ${(err as Error).message}\n`)
    process.exit(1)
  }

  let summary: Summary
  try {
    summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Summary
  } catch (err) {
    process.stderr.write(`kayman last: summary not found or unreadable at ${summaryPath}: ${(err as Error).message}\n`)
    process.exit(1)
  }

  const project = summary.project ?? 'memo'
  process.stdout.write(`${summary.title}  (${project})\n\n${summary.tldr}\n`)
}
