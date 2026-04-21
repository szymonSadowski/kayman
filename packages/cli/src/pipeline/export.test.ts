import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

vi.mock('@notionhq/client')

const mockConfig: Config = {
  userName: 'Szymon',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: 'sk-test',
  notionToken: 'secret_test',
  notionDatabaseId: 'db-123',
  projects: [{ name: 'Kayman', notionPageId: 'page-456' }],
  audioSource: 'system_and_mic',
}

const mockSummary: Summary = {
  title: 'Team Sync',
  tldr: 'We discussed the sprint.',
  keyPoints: ['**Szymon** presented', 'Budget approved'],
  fullSummary: 'Full detailed summary.',
  project: 'Kayman',
  recordedAt: '2026-04-03T10:00:00.000Z',
  transcriptPath: '/tmp/audio.txt',
}

describe('runExport', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Make sleep() resolve instantly so retry tests don't need timer management
    vi.stubGlobal('setTimeout', (fn: () => void) => { fn(); return 0 as unknown as ReturnType<typeof globalThis.setTimeout> })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a Notion page and returns its ID on success', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'new-page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')
    const result = await runExport({ summary: mockSummary, config: mockConfig })

    expect(result).toBe('new-page-id')
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('includes project relation when summary.project matches config', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')
    await runExport({ summary: mockSummary, config: mockConfig })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Project']).toEqual({ relation: [{ id: 'page-456' }] })
  })

  it('omits project relation in memo mode (project null)', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const memoSummary: Summary = { ...mockSummary, project: null }

    const { runExport } = await import('./export.js')
    await runExport({ summary: memoSummary, config: mockConfig })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Project']).toBeUndefined()
  })

  it('includes Tags multi-select property when tags provided', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')
    await runExport({ summary: mockSummary, config: mockConfig, tags: ['daily', 'voc'] })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Tags']).toEqual({ multi_select: [{ name: 'daily' }, { name: 'voc' }] })
  })

  it('omits Tags property when tags is empty', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')
    await runExport({ summary: mockSummary, config: mockConfig, tags: [] })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Tags']).toBeUndefined()
  })

  it('throws PipelineError immediately on 401 without retry', async () => {
    const { Client } = await import('@notionhq/client')
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    const mockCreate = vi.fn().mockRejectedValue(authError)
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')

    await expect(runExport({ summary: mockSummary, config: mockConfig })).rejects.toThrow(
      'Notion auth failed: check notion_token in config',
    )
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('retries on 429 and throws PipelineError after 3 attempts', async () => {
    const { Client } = await import('@notionhq/client')
    const rateLimitError = Object.assign(new Error('Rate limited'), { status: 429 })
    const mockCreate = vi.fn().mockRejectedValue(rateLimitError)
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')

    let caught: unknown
    try {
      await runExport({ summary: mockSummary, config: mockConfig })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(PipelineError)
    expect((caught as PipelineError).message).toContain('Notion export failed after 3 attempts')
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  it('retries on 5xx and succeeds on retry', async () => {
    const { Client } = await import('@notionhq/client')
    const serverError = Object.assign(new Error('Internal Server Error'), { status: 500 })
    const mockCreate = vi.fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce({ id: 'page-after-retry' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')

    const result = await runExport({ summary: mockSummary, config: mockConfig })
    expect(result).toBe('page-after-retry')
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('includes Price property when summary.cost is defined', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const summaryWithCost: Summary = { ...mockSummary, cost: 0.0075 }

    const { runExport } = await import('./export.js')
    await runExport({ summary: summaryWithCost, config: mockConfig })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Price']).toEqual({ number: 0.0075 })
  })

  it('omits Price property when summary.cost is undefined', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const summaryNoCost: Summary = { ...mockSummary, cost: undefined }

    const { runExport } = await import('./export.js')
    await runExport({ summary: summaryNoCost, config: mockConfig })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Price']).toBeUndefined()
  })

  it('includes Price property when summary.cost is 0 (ollama)', async () => {
    const { Client } = await import('@notionhq/client')
    const mockCreate = vi.fn().mockResolvedValue({ id: 'page-id' })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const ollamaSummary: Summary = { ...mockSummary, cost: 0 }

    const { runExport } = await import('./export.js')
    await runExport({ summary: ollamaSummary, config: mockConfig })

    const callArg = mockCreate.mock.calls[0][0] as { properties: Record<string, unknown> }
    expect(callArg.properties['Price']).toEqual({ number: 0 })
  })

  it('throws PipelineError immediately for unknown errors with no status (no retry)', async () => {
    const { Client } = await import('@notionhq/client')
    const unknownError = new Error('Network error')
    const mockCreate = vi.fn().mockRejectedValue(unknownError)
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: mockCreate } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')

    await expect(runExport({ summary: mockSummary, config: mockConfig })).rejects.toBeInstanceOf(PipelineError)
    expect(mockCreate).toHaveBeenCalledOnce()
  })

  it('PipelineError on 401 has Exporting stage', async () => {
    const { Client } = await import('@notionhq/client')
    const authError = Object.assign(new Error('Unauthorized'), { status: 401 })
    vi.mocked(Client).mockImplementation(() => ({ pages: { create: vi.fn().mockRejectedValue(authError) } }) as unknown as InstanceType<typeof Client>)

    const { runExport } = await import('./export.js')

    try {
      await runExport({ summary: mockSummary, config: mockConfig })
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).stage).toBe(PipelineStage.Exporting)
    }
  })
})
