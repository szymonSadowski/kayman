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
  process.stdout.write('Pipeline: stub (transcription not yet implemented)\n')
}
