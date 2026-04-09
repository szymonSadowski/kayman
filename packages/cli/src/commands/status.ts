import { readSession, info, bold, dim } from '@kayman/shared'
import type { Config } from '@kayman/shared'

const isTTY = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR

export async function statusCommand(_config: Config): Promise<void> {
  const session = readSession()
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
