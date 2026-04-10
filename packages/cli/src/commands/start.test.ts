import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSession: vi.fn(),
  writeSession: vi.fn(),
  isProcessAlive: vi.fn(),
  recordingDir: vi.fn(() => '/tmp/recordings/2026-01-01-test'),
  success: (s: string) => s,
  error: (s: string) => s,
  bold: (s: string) => s,
  isTTY: false,
}))

const selectMock = vi.hoisted(() => vi.fn())
vi.mock('@inquirer/select', () => ({
  default: selectMock,
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('fs', () => ({
  default: { mkdirSync: vi.fn() },
}))

const runPreflightChecksMock = vi.hoisted(() => vi.fn())
vi.mock('./preflight.js', () => ({ runPreflightChecks: runPreflightChecksMock }))

import { readSession, writeSession, isProcessAlive, recordingDir } from '@kayman/shared'
import { spawn } from 'child_process'
import { startCommand } from './start.js'
import { memoCommand } from './memo.js'
import type { Config } from '@kayman/shared'

const mockConfig: Config = {
  userName: 'Test',
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: 'key',
  notionToken: 'tok',
  notionDatabaseId: 'db',
  projects: [
    { name: 'Project A', notionPageId: 'page-a' },
    { name: 'Project B', notionPageId: 'page-b' },
  ],
  audioSource: 'system_and_mic',
}

const mockChild = { pid: 12345, exitCode: null, unref: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  ;(spawn as Mock).mockReturnValue(mockChild)
  ;(recordingDir as Mock).mockReturnValue('/tmp/recordings/2026-01-01-test')
  ;(isProcessAlive as Mock).mockReturnValue(true)
  runPreflightChecksMock.mockResolvedValue(undefined)
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.useRealTimers()
})

// Helper to start command with faked 2s timer (for tests without dynamic imports in the path)
async function startWithFakeTimer(project: string | undefined, config: typeof mockConfig, tags?: string[]) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const promise = startCommand(project, config, tags)
  await Promise.resolve()
  vi.runAllTimers()
  return promise
}

describe('startCommand', () => {
  it('spawns capture and writes session when project arg given', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    await startWithFakeTimer('Project A', mockConfig)

    expect(spawn).toHaveBeenCalledWith(
      expect.stringContaining('kayman-capture'),
      ['--source', 'system_and_mic', '--output', expect.stringContaining('audio.caf')],
      { detached: true, stdio: 'ignore' },
    )
    expect(mockChild.unref).toHaveBeenCalled()
    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ pid: 12345, project: 'Project A' }),
    )
    expect(process.stdout.write).toHaveBeenCalledWith('Recording started. Project A\n')
  })

  it('shows picker when no project arg given', async () => {
    ;(readSession as Mock).mockReturnValue(null)
    selectMock.mockResolvedValue('Project B')

    // Real timers needed: dynamic import inside startCommand blocks with fake timers
    await startCommand(undefined, mockConfig)

    expect(selectMock).toHaveBeenCalled()
    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'Project B' }),
    )
  }, 10_000)

  it('errors if session already active', async () => {
    ;(readSession as Mock).mockReturnValue({ pid: 99, audioPath: '/x', project: 'P', startedAt: '' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(startCommand(undefined, mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith('Recording already in progress. Run kayman stop first.\n')
    exitSpy.mockRestore()
  })

  it('passes tags to writeSession when provided', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    await startWithFakeTimer('Project A', mockConfig, ['daily', 'voc'])

    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['daily', 'voc'] }),
    )
  })

  it('defaults tags to empty array when not provided', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    await startWithFakeTimer('Project A', mockConfig)

    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] }),
    )
  })

  it('errors if no projects configured and no arg', async () => {
    ;(readSession as Mock).mockReturnValue(null)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(startCommand(undefined, { ...mockConfig, projects: [] })).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('No projects configured'))
    exitSpy.mockRestore()
  })

  it('calls runPreflightChecks when skipChecks=false (default)', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    await startWithFakeTimer('Project A', mockConfig)

    expect(runPreflightChecksMock).toHaveBeenCalledWith(mockConfig)
  })

  it('skips runPreflightChecks when skipChecks=true', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = startCommand('Project A', mockConfig, [], true)
    await Promise.resolve()
    vi.runAllTimers()
    await promise

    expect(runPreflightChecksMock).not.toHaveBeenCalled()
  })

  it('detects early crash, does not write session, exits code 1', async () => {
    ;(readSession as Mock).mockReturnValue(null)
    const deadChild = { pid: 12345, exitCode: 1, unref: vi.fn() }
    ;(spawn as Mock).mockReturnValue(deadChild)
    ;(isProcessAlive as Mock).mockReturnValue(false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = startCommand('Project A', mockConfig)
    promise.catch(() => {}) // prevent unhandled rejection
    await Promise.resolve()
    vi.runAllTimers()
    await expect(promise).rejects.toThrow('exit')

    expect(writeSession).not.toHaveBeenCalled()
    expect(deadChild.unref).not.toHaveBeenCalled()
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Capture failed to start: 1'),
    )
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Check audio permissions'),
    )
    exitSpy.mockRestore()
  })
})

describe('memoCommand', () => {
  it('spawns capture with project=null, no picker', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = memoCommand(mockConfig)
    await Promise.resolve()
    vi.runAllTimers()
    await promise

    expect(selectMock).not.toHaveBeenCalled()
    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ pid: 12345, project: null }),
    )
    expect(process.stdout.write).toHaveBeenCalledWith('Recording started.\n')
  })

  it('errors if session already active', async () => {
    ;(readSession as Mock).mockReturnValue({ pid: 99, audioPath: '/x', project: null, startedAt: '' })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(memoCommand(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith('Recording already in progress. Run kayman stop first.\n')
    exitSpy.mockRestore()
  })

  it('calls runPreflightChecks when skipChecks=false (default)', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = memoCommand(mockConfig)
    await Promise.resolve()
    vi.runAllTimers()
    await promise

    expect(runPreflightChecksMock).toHaveBeenCalledWith(mockConfig)
  })

  it('skips runPreflightChecks when skipChecks=true', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = memoCommand(mockConfig, true)
    await Promise.resolve()
    vi.runAllTimers()
    await promise

    expect(runPreflightChecksMock).not.toHaveBeenCalled()
  })
})
