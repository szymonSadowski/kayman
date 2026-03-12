import { describe, it, expect, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// vi.hoisted runs before vi.mock factory — safe to initialize paths here
const { testSessionPath, testTmpDir } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdtempSync, existsSync } = require('fs') as typeof import('fs')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { tmpdir } = require('os') as typeof import('os')
  const dir = mkdtempSync(join(tmpdir(), 'kayman-session-test-'))
  void existsSync // silence unused import
  return { testTmpDir: dir, testSessionPath: join(dir, 'session.json') }
})

vi.mock('./paths', () => ({
  SESSION_PATH: testSessionPath,
  CONFIG_DIR: path.join(os.tmpdir(), 'kayman-test-config'),
  DATA_DIR: path.join(os.tmpdir(), 'kayman-test-data'),
  LAST_SUMMARY_PATH: path.join(os.tmpdir(), 'kayman-test-data', 'last-summary.json'),
  recordingDir: (date: string, project: string | null) =>
    path.join(os.tmpdir(), 'kayman-test-data', 'recordings', `${date}-${project ?? 'memo'}`),
}))

import { writeSession, readSession, clearSession } from './session'
import type { Session } from './types'

const MOCK_SESSION: Session = {
  pid: process.pid, // current process — guaranteed alive
  audioPath: '/tmp/audio.caf',
  project: 'Kayman',
  startedAt: new Date().toISOString(),
}

describe('session', () => {
  afterEach(() => {
    try {
      fs.unlinkSync(testSessionPath)
    } catch {
      // ok if already gone
    }
  })

  it('writeSession + readSession round-trips', () => {
    writeSession(MOCK_SESSION)
    const result = readSession()
    expect(result).toEqual(MOCK_SESSION)
  })

  it('readSession returns null when no session file', () => {
    expect(readSession()).toBeNull()
  })

  it('readSession returns null and deletes file for stale PID', () => {
    const stale: Session = { ...MOCK_SESSION, pid: 999999999 }
    writeSession(stale)
    const result = readSession()
    expect(result).toBeNull()
    expect(fs.existsSync(testSessionPath)).toBe(false)
  })

  it('clearSession removes session file', () => {
    writeSession(MOCK_SESSION)
    clearSession()
    expect(readSession()).toBeNull()
  })

  it('clearSession is idempotent when no file exists', () => {
    expect(() => clearSession()).not.toThrow()
  })

  // cleanup temp dir on process exit
  process.on('exit', () => {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
})
