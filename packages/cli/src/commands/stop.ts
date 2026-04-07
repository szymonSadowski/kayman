import { spawn } from 'child_process'
import path from 'path'
import { readSession, clearSession } from '@kayman/shared'
import type { Config } from '@kayman/shared'

export async function stopCommand(_config: Config): Promise<void> {
  const session = readSession()
  if (!session) {
    process.stderr.write('No active recording session.\n')
    process.exit(1)
  }

  process.kill(session.pid, 'SIGTERM')
  clearSession()

  const pipelineRunnerPath = path.resolve(__dirname, './pipeline/runner.js')
  const transcriptSaveDir = path.dirname(session.audioPath)

  const tagsArg = session.tags.length > 0 ? session.tags.join(',') : ''

  const child = spawn(
    process.execPath,
    [pipelineRunnerPath, session.audioPath, session.project ?? '', transcriptSaveDir, tagsArg],
    { detached: true, stdio: 'ignore' },
  )
  child.unref()

  process.stdout.write('Recording stopped. Processing in background...\n')
}
