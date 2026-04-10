import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSessionFile: vi.fn(),
  isProcessAlive: vi.fn(),
  clearSession: vi.fn(),
  notifyCustom: vi.fn(),
  info: (s: string) => s,
  warn: (s: string) => s,
  bold: (s: string) => s,
  dim: (s: string) => s,
  isTTY: false,
}))

import { readSessionFile, isProcessAlive, clearSession, notifyCustom } from '@kayman/shared'
import { statusCommand } from './status.js'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

describe('statusCommand', () => {
  it('shows inactive when no session', async () => {
    ;(readSessionFile as Mock).mockReturnValue(null)

    await statusCommand(mockConfig)

    expect(process.stdout.write).toHaveBeenCalledWith('Recording: inactive\n')
  })

  it('shows active project and duration', async () => {
    const startedAt = new Date(Date.now() - 754_000).toISOString() // 12m 34s ago
    ;(readSessionFile as Mock).mockReturnValue({ pid: 1, audioPath: '/x', project: 'Project Kayman', startedAt })
    ;(isProcessAlive as Mock).mockReturnValue(true)

    await statusCommand(mockConfig)

    const call = (process.stdout.write as Mock).mock.calls[0][0] as string
    expect(call).toMatch(/Project Kayman/)
    expect(call).toMatch(/12m 3[3-5]s/)
  })

  it('shows memo label when project is null', async () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString()
    ;(readSessionFile as Mock).mockReturnValue({ pid: 1, audioPath: '/x', project: null, startedAt })
    ;(isProcessAlive as Mock).mockReturnValue(true)

    await statusCommand(mockConfig)

    const call = (process.stdout.write as Mock).mock.calls[0][0] as string
    expect(call).toContain('memo')
  })

  it('clears stale session and fires notification on dead PID', async () => {
    ;(readSessionFile as Mock).mockReturnValue({ pid: 99999, audioPath: '/x', project: 'P', startedAt: new Date().toISOString() })
    ;(isProcessAlive as Mock).mockReturnValue(false)

    await statusCommand(mockConfig)

    expect(clearSession).toHaveBeenCalled()
    expect(notifyCustom).toHaveBeenCalledWith('Recording lost: capture process exited unexpectedly.')
    expect(process.stdout.write).toHaveBeenCalledWith('Recording: inactive (capture process died unexpectedly)\n')
  })
})
