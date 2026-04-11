import { readSessionFile, isProcessAlive, clearSession, notifyCustom, info, warn, bold, dim, isTTY } from '@kayman/shared'
import type { Config } from '@kayman/shared'

export async function statusCommand(_config: Config): Promise<void> {
  const raw = readSessionFile()

  if (raw && !isProcessAlive(raw.pid)) {
    clearSession()
    notifyCustom('Recording lost: capture process exited unexpectedly.')
    process.stdout.write(warn('Recording: inactive (capture process died unexpectedly)') + '\n')
    return
  }

  const session = raw
  if (!session) {
    process.stdout.write(info('Recording: inactive') + '\n')
    return
  }

  const elapsedSec = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000)
  const minutes = Math.floor(elapsedSec / 60)
  const seconds = elapsedSec % 60
  const label = session.project ?? 'memo'
  const recPrefix = isTTY ? '⏺ ' : '[rec] '
  process.stdout.write(`${recPrefix}${bold(label)} — ${dim(`${minutes}m ${seconds}s`)}\n`)
}
