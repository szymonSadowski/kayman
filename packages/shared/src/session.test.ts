import { describe, it, expect, afterEach, afterAll, vi } from 'vitest'
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

import { writeSession, readSession, readSessionFile, clearSession } from './session'
import type { Session } from './types'

const MOCK_SESSION: Session = {
  pid: process.pid, // current process — guaranteed alive
  audioPath: '/tmp/audio.caf',
  project: 'Kayman',
  startedAt: new Date().toISOString(),
  tags: [],
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

  it('writeSession throws on pid <= 0', () => {
    expect(() => writeSession({ ...MOCK_SESSION, pid: 0 })).toThrow('invalid pid')
    expect(() => writeSession({ ...MOCK_SESSION, pid: -1 })).toThrow('invalid pid')
  })

  it('writeSession throws on empty audioPath', () => {
    expect(() => writeSession({ ...MOCK_SESSION, audioPath: '' })).toThrow('audioPath')
  })

  it('writeSession + readSession round-trips with project null', () => {
    const nullProject: Session = { ...MOCK_SESSION, project: null }
    writeSession(nullProject)
    expect(readSession()).toEqual(nullProject)
  })

  it('readSession returns null and deletes corrupted JSON file', () => {
    fs.mkdirSync(path.dirname(testSessionPath), { recursive: true })
    fs.writeFileSync(testSessionPath, 'not-json', 'utf8')
    expect(readSession()).toBeNull()
    expect(fs.existsSync(testSessionPath)).toBe(false)
  })

  it('readSession returns null and deletes file with invalid session shape', () => {
    fs.mkdirSync(path.dirname(testSessionPath), { recursive: true })
    fs.writeFileSync(testSessionPath, JSON.stringify({ pid: 'not-a-number' }), 'utf8')
    expect(readSession()).toBeNull()
    expect(fs.existsSync(testSessionPath)).toBe(false)
  })

  it('writeSession + readSession round-trips with tags', () => {
    const withTags: Session = { ...MOCK_SESSION, tags: ['daily', 'voc'] }
    writeSession(withTags)
    expect(readSession()).toEqual(withTags)
  })

  it('readSessionFile returns session even when PID is dead', () => {
    const stale: Session = { ...MOCK_SESSION, pid: 999999999 }
    writeSession(stale)
    const result = readSessionFile()
    expect(result).toEqual(stale)
    // file should still exist (not deleted by readSessionFile)
    expect(fs.existsSync(testSessionPath)).toBe(true)
  })

  it('readSessionFile returns null when no session file', () => {
    expect(readSessionFile()).toBeNull()
  })

  it('readSessionFile returns null for corrupted JSON', () => {
    fs.mkdirSync(path.dirname(testSessionPath), { recursive: true })
    fs.writeFileSync(testSessionPath, 'not-json', 'utf8')
    expect(readSessionFile()).toBeNull()
  })

  it('readSessionFile returns null for invalid session shape', () => {
    fs.mkdirSync(path.dirname(testSessionPath), { recursive: true })
    fs.writeFileSync(testSessionPath, JSON.stringify({ pid: 'not-a-number' }), 'utf8')
    expect(readSessionFile()).toBeNull()
  })

  it('readSession returns null for session missing tags field', () => {
    fs.mkdirSync(path.dirname(testSessionPath), { recursive: true })
    const noTags = { pid: process.pid, audioPath: '/tmp/a.caf', project: null, startedAt: new Date().toISOString() }
    fs.writeFileSync(testSessionPath, JSON.stringify(noTags), 'utf8')
    expect(readSession()).toBeNull()
  })

  afterAll(() => {
    try {
      fs.rmSync(testTmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })
})
