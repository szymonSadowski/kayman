import { readSession } from '@kayman/shared'
import type { Config } from '@kayman/shared'

export async function statusCommand(_config: Config): Promise<void> {
  const session = readSession()
  if (!session) {
    process.stdout.write('Recording: inactive\n')
    return
  }

  const elapsedSec = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
  const minutes = Math.floor(elapsedSec / 60)
  const seconds = elapsedSec % 60
  const label = session.project ?? 'memo'
  process.stdout.write(`Recording: active — ${label} (duration: ${minutes}m ${seconds}s)\n`)
}
