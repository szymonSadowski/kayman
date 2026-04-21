import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSession: vi.fn(),
  writeSession: vi.fn(),
  isProcessAlive: vi.fn(),
  recordingDir: vi.fn(() => '/tmp/recordings/2026-01-01'),
  success: (s: string) => s,
  error: (s: string) => s,
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('fs', () => ({
  default: { mkdirSync: vi.fn() },
}))

const runPreflightChecksMock = vi.hoisted(() => vi.fn())
vi.mock('./preflight.js', () => ({ runPreflightChecks: runPreflightChecksMock }))

import { readSession, writeSession, isProcessAlive } from '@kayman/shared'
import { spawn } from 'child_process'
import { memoCommand } from './memo.js'
import type { Config } from '@kayman/shared'

const mockConfig: Config = {
  userName: 'Test',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: 'sk-test',
  notionToken: 'secret',
  notionDatabaseId: 'db-123',
  projects: [],
  audioSource: 'system_and_mic',
}

const mockChild = { pid: 12345, exitCode: null, unref: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  ;(spawn as Mock).mockReturnValue(mockChild)
  ;(isProcessAlive as Mock).mockReturnValue(true)
  runPreflightChecksMock.mockResolvedValue(undefined)
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('memoCommand', () => {
  it('writes session with tags: [memo]', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const promise = memoCommand(mockConfig, true)
    await Promise.resolve()
    vi.runAllTimers()
    await promise

    expect(writeSession).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['memo'] }),
    )

    vi.useRealTimers()
  })
})
