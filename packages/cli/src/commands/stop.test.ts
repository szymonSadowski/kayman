import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSession: vi.fn(),
  clearSession: vi.fn(),
}))

vi.mock('child_process')

import { readSession, clearSession } from '@kayman/shared'
import { stopCommand } from './stop'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

const mockSession = {
  pid: 12345,
  audioPath: '/tmp/recordings/2026-04-03-kayman/audio.caf',
  project: 'Kayman',
  startedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('stopCommand', () => {
  it('sends SIGTERM, clears session, spawns runner detached', async () => {
    ;(readSession as Mock).mockReturnValue(mockSession)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    const cp = await import('child_process')
    const fakeChild = Object.assign(new EventEmitter(), { unref: vi.fn() })
    vi.mocked(cp.spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>)

    await stopCommand(mockConfig)

    expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(clearSession).toHaveBeenCalled()
    expect(cp.spawn).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining([expect.stringContaining('runner.js'), mockSession.audioPath, 'Kayman']),
      expect.objectContaining({ detached: true, stdio: 'ignore' }),
    )
    expect(fakeChild.unref).toHaveBeenCalled()
    expect(process.stdout.write).toHaveBeenCalledWith('Recording stopped. Processing in background...\n')
    killSpy.mockRestore()
  })

  it('passes empty string for project in memo mode', async () => {
    const memoSession = { ...mockSession, project: null }
    ;(readSession as Mock).mockReturnValue(memoSession)
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    const cp = await import('child_process')
    const fakeChild = Object.assign(new EventEmitter(), { unref: vi.fn() })
    vi.mocked(cp.spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>)

    await stopCommand(mockConfig)

    const spawnArgs = vi.mocked(cp.spawn).mock.calls[0][1] as string[]
    expect(spawnArgs[2]).toBe('')
  })

  it('errors when no active session', async () => {
    ;(readSession as Mock).mockReturnValue(null)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(stopCommand(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith('No active recording session.\n')
    exitSpy.mockRestore()
  })
})
