import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSessionFile: vi.fn(),
  isProcessAlive: vi.fn(),
  clearSession: vi.fn(),
  success: (s: string) => s,
  error: (s: string) => s,
  warn: (s: string) => s,
  info: (s: string) => s,
}))

vi.mock('child_process')
vi.mock('fs')

import { readSessionFile, isProcessAlive, clearSession } from '@kayman/shared'
import { stopCommand } from './stop.js'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

const mockSession = {
  pid: 12345,
  audioPath: '/tmp/recordings/2026-04-03-kayman/audio.caf',
  project: 'Kayman',
  startedAt: new Date().toISOString(),
  tags: [] as string[],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('stopCommand', () => {
  it('sends SIGTERM, clears session, spawns runner detached', async () => {
    ;(readSessionFile as Mock).mockReturnValue(mockSession)
    ;(isProcessAlive as Mock).mockReturnValue(true)
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
    ;(readSessionFile as Mock).mockReturnValue(memoSession)
    ;(isProcessAlive as Mock).mockReturnValue(true)
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    const cp = await import('child_process')
    const fakeChild = Object.assign(new EventEmitter(), { unref: vi.fn() })
    vi.mocked(cp.spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>)

    await stopCommand(mockConfig)

    const spawnArgs = vi.mocked(cp.spawn).mock.calls[0][1] as string[]
    expect(spawnArgs[2]).toBe('')
  })

  it('passes tags as comma-separated arg to runner', async () => {
    const tagSession = { ...mockSession, tags: ['daily', 'voc'] }
    ;(readSessionFile as Mock).mockReturnValue(tagSession)
    ;(isProcessAlive as Mock).mockReturnValue(true)
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    const cp = await import('child_process')
    const fakeChild = Object.assign(new (await import('events')).EventEmitter(), { unref: vi.fn() })
    vi.mocked(cp.spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>)

    await stopCommand(mockConfig)

    const spawnArgs = vi.mocked(cp.spawn).mock.calls[0][1] as string[]
    expect(spawnArgs[4]).toBe('daily,voc')
  })

  it('passes empty string for tags when no tags', async () => {
    ;(readSessionFile as Mock).mockReturnValue(mockSession)
    ;(isProcessAlive as Mock).mockReturnValue(true)
    vi.spyOn(process, 'kill').mockImplementation(() => true)

    const cp = await import('child_process')
    const fakeChild = Object.assign(new (await import('events')).EventEmitter(), { unref: vi.fn() })
    vi.mocked(cp.spawn).mockReturnValue(fakeChild as unknown as ReturnType<typeof cp.spawn>)

    await stopCommand(mockConfig)

    const spawnArgs = vi.mocked(cp.spawn).mock.calls[0][1] as string[]
    expect(spawnArgs[4]).toBe('')
  })

  it('errors when no active session', async () => {
    ;(readSessionFile as Mock).mockReturnValue(null)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(stopCommand(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith('No active recording session.\n')
    exitSpy.mockRestore()
  })

  it('clears session and warns when PID is dead (no partial audio)', async () => {
    ;(readSessionFile as Mock).mockReturnValue(mockSession)
    ;(isProcessAlive as Mock).mockReturnValue(false)

    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    await stopCommand(mockConfig)

    expect(clearSession).toHaveBeenCalled()
    expect(process.stdout.write).toHaveBeenCalledWith(
      'Capture process is no longer running. Session cleared.\n',
    )
  })

  it('prints partial audio path when dead PID and audio exists', async () => {
    ;(readSessionFile as Mock).mockReturnValue(mockSession)
    ;(isProcessAlive as Mock).mockReturnValue(false)

    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.statSync).mockReturnValue({ size: 1024 } as ReturnType<typeof fs.statSync>)

    await stopCommand(mockConfig)

    expect(clearSession).toHaveBeenCalled()
    const calls = (process.stdout.write as Mock).mock.calls.map(c => c[0])
    expect(calls.some((c: string) => c.includes('Partial audio file found at') && c.includes(mockSession.audioPath))).toBe(true)
  })
})
