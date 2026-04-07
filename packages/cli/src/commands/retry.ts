import fs from 'fs'
import path from 'path'
import { DATA_DIR, notify, notifyError, PipelineStage } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'
import { runExport } from '../pipeline/export.js'

interface RetryOptions {
  path?: string
  all?: boolean
}

function findFailedExports(): string[] {
  const recordingsDir = path.join(DATA_DIR, 'recordings')
  let dirs: string[]
  try {
    dirs = fs.readdirSync(recordingsDir)
  } catch {
    return []
  }

  return dirs
    .map((d) => path.join(recordingsDir, d))
    .filter((d) => {
      try {
        fs.accessSync(path.join(d, 'summary.json'))
        fs.accessSync(path.join(d, '.exported'))
        return false // has .exported — not failed
      } catch {
        // Check if summary.json exists
        try {
          fs.accessSync(path.join(d, 'summary.json'))
          return true // has summary but no .exported
        } catch {
          return false
        }
      }
    })
    .sort()
    .reverse() // most recent first
}

async function retryOne(dir: string, config: Config): Promise<boolean> {
  const summaryPath = path.join(dir, 'summary.json')
  try {
    fs.accessSync(summaryPath)
  } catch {
    process.stderr.write(`No summary.json found at ${dir}\n`)
    return false
  }

  const summary: Summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))

  // Load tags from session.json if available
  let tags: string[] = []
  try {
    const sessionRaw = fs.readFileSync(path.join(dir, 'session.json'), 'utf8')
    const session = JSON.parse(sessionRaw)
    if (Array.isArray(session.tags)) tags = session.tags
  } catch {
    // no session file
  }

  try {
    await runExport({ summary, config, tags })
    fs.writeFileSync(path.join(dir, '.exported'), '', 'utf8')
    notify(PipelineStage.Done)
    process.stdout.write(`Export succeeded for "${summary.title}".\n`)
    return true
  } catch (err) {
    notifyError(PipelineStage.Exporting, err as Error)
    process.stderr.write(`Export failed for "${summary.title}": ${(err as Error).message}\n`)
    return false
  }
}

export async function retryCommand(config: Config, opts: RetryOptions): Promise<void> {
  if (opts.path) {
    const success = await retryOne(opts.path, config)
    if (!success) process.exit(1)
    return
  }

  const failed = findFailedExports()

  if (failed.length === 0) {
    process.stdout.write('No failed exports found.\n')
    return
  }

  if (opts.all) {
    let succeeded = 0
    let failedCount = 0
    for (const dir of failed) {
      const ok = await retryOne(dir, config)
      if (ok) succeeded++
      else failedCount++
    }
    process.stdout.write(`Retried ${failed.length} exports: ${succeeded} succeeded, ${failedCount} failed.\n`)
    if (failedCount > 0) process.exit(1)
    return
  }

  // Default: retry most recent failed
  const success = await retryOne(failed[0], config)
  if (!success) process.exit(1)
}
