import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { readSession, writeSession, recordingDir } from '@kayman/shared'
import type { Config } from '@kayman/shared'

const CAPTURE_BIN = path.resolve(__dirname, '../bin/kayman-capture')

export async function startCommand(
  project: string | undefined,
  config: Config,
): Promise<void> {
  const existing = readSession()
  if (existing) {
    process.stderr.write('Recording already in progress. Run kayman stop first.\n')
    process.exit(1)
  }

  let resolvedProject: string | null
  if (project !== undefined) {
    resolvedProject = project
  } else {
    if (config.projects.length === 0) {
      process.stderr.write('No projects configured. Add projects to ~/.config/kayman/config.yaml\n')
      process.exit(1)
    }
    const { default: select } = await import('@inquirer/select')
    resolvedProject = await select({
      message: 'Select a project:',
      choices: config.projects.map(p => ({ name: p.name, value: p.name })),
    })
  }

  const date = new Date().toISOString().slice(0, 10)
  const audioPath = path.join(recordingDir(date, resolvedProject), 'audio.caf')
  fs.mkdirSync(path.dirname(audioPath), { recursive: true })

  const child = spawn(CAPTURE_BIN, ['--source', config.audioSource, '--output', audioPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  writeSession({ pid: child.pid!, audioPath, project: resolvedProject, startedAt: new Date().toISOString() })
  process.stdout.write('Recording started.\n')
}
