import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSession: vi.fn(),
  clearSession: vi.fn(),
}))

import { readSession, clearSession } from '@kayman/shared'
import { stopCommand } from './stop'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

const mockSession = { pid: 12345, audioPath: '/tmp/audio.caf', project: 'Kayman', startedAt: new Date().toISOString() }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('stopCommand', () => {
  it('sends SIGTERM, clears session, prints stub message', async () => {
    ;(readSession as Mock).mockReturnValue(mockSession)
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true)

    await stopCommand(mockConfig)

    expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM')
    expect(clearSession).toHaveBeenCalled()
    expect(process.stdout.write).toHaveBeenCalledWith('Pipeline: stub (transcription not yet implemented)\n')
    killSpy.mockRestore()
  })

  it('errors when no active session', async () => {
    ;(readSession as Mock).mockReturnValue(null)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(stopCommand(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith('No active recording session.\n')
    exitSpy.mockRestore()
  })
})
