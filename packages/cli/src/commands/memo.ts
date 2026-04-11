import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { readSession, writeSession, isProcessAlive, recordingDir, success, error } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { runPreflightChecks } from './preflight.js'

const CAPTURE_BIN = path.resolve(__dirname, '../bin/kayman-capture')

export async function memoCommand(config: Config, skipChecks = false): Promise<void> {
  if (!skipChecks) await runPreflightChecks(config)
  const existing = readSession()
  if (existing) {
    process.stderr.write(error('Recording already in progress. Run kayman stop first.') + '\n')
    process.exit(1)
  }

  const date = new Date().toISOString().slice(0, 10)
  const audioPath = path.join(recordingDir(date, null), 'audio.caf')
  fs.mkdirSync(path.dirname(audioPath), { recursive: true })

  const child = spawn(CAPTURE_BIN, ['--source', config.audioSource, '--output', audioPath], {
    detached: true,
    stdio: 'ignore',
  })

  await new Promise(resolve => setTimeout(resolve, 2000))

  if (!isProcessAlive(child.pid!)) {
    process.stderr.write(error(`Capture failed to start: ${child.exitCode ?? 'unknown'}. Check audio permissions in System Settings > Privacy & Security > Screen & System Audio Recording.`) + '\n')
    process.exit(1)
  }

  child.unref()
  writeSession({ pid: child.pid!, audioPath, project: null, startedAt: new Date().toISOString(), tags: [] })
  process.stdout.write(success('Recording started.') + '\n')
}
