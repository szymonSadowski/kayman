import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  readSession: vi.fn(),
}))

import { readSession } from '@kayman/shared'
import { statusCommand } from './status'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

describe('statusCommand', () => {
  it('shows inactive when no session', async () => {
    ;(readSession as Mock).mockReturnValue(null)

    await statusCommand(mockConfig)

    expect(process.stdout.write).toHaveBeenCalledWith('Recording: inactive\n')
  })

  it('shows active project and duration', async () => {
    const startedAt = new Date(Date.now() - 754_000).toISOString() // 12m 34s ago
    ;(readSession as Mock).mockReturnValue({ pid: 1, audioPath: '/x', project: 'Project Kayman', startedAt })

    await statusCommand(mockConfig)

    const call = (process.stdout.write as Mock).mock.calls[0][0] as string
    expect(call).toMatch(/Recording: active — Project Kayman \(duration: 12m 3[3-5]s\)/)
  })

  it('shows memo label when project is null', async () => {
    const startedAt = new Date(Date.now() - 60_000).toISOString()
    ;(readSession as Mock).mockReturnValue({ pid: 1, audioPath: '/x', project: null, startedAt })

    await statusCommand(mockConfig)

    const call = (process.stdout.write as Mock).mock.calls[0][0] as string
    expect(call).toMatch(/Recording: active — memo/)
  })
})
