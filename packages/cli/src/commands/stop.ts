import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { readSessionFile, isProcessAlive, clearSession, success, error, warn, info } from '@kayman/shared'
import type { Config } from '@kayman/shared'

export async function stopCommand(_config: Config): Promise<void> {
  const raw = readSessionFile()
  if (!raw) {
    process.stderr.write(error('No active recording session.') + '\n')
    process.exit(1)
  }

  if (!isProcessAlive(raw.pid)) {
    clearSession()
    process.stdout.write(warn('Capture process is no longer running. Session cleared.') + '\n')
    if (fs.existsSync(raw.audioPath) && fs.statSync(raw.audioPath).size > 0) {
      process.stdout.write(info(`Partial audio file found at ${raw.audioPath}. Run kayman retry to attempt processing.`) + '\n')
    }
    return
  }

  process.kill(raw.pid, 'SIGTERM')
  clearSession()

  const pipelineRunnerPath = path.resolve(__dirname, './pipeline/runner.js')
  const transcriptSaveDir = path.dirname(raw.audioPath)

  const tagsArg = raw.tags.length > 0 ? raw.tags.join(',') : ''

  const child = spawn(
    process.execPath,
    [pipelineRunnerPath, raw.audioPath, raw.project ?? '', transcriptSaveDir, tagsArg],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()

  process.stdout.write(success('Recording stopped. Processing in background...') + '\n')
}
