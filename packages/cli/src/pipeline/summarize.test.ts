import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

vi.mock('fs')
vi.mock('ai')
vi.mock('@ai-sdk/openai')

const mockConfig: Config = {
  userName: 'Szymon',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: 'sk-test',
  notionToken: 'secret_test',
  notionDatabaseId: 'db-123',
  projects: [],
  audioSource: 'system_and_mic',
}

const validAiResponse = JSON.stringify({
  title: 'Team Sync Meeting',
  tldr: 'The team discussed project progress.',
  keyPoints: ['Szymon presented the demo', 'Budget was approved', 'Next steps defined'],
  fullSummary: 'Full detailed summary of the meeting.',
})

describe('runSummarize', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns a Summary object with spotlight applied', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript content')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ text: validAiResponse } as Awaited<ReturnType<typeof ai.generateText>>)

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: 'Kayman',
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(result.title).toBe('Team Sync Meeting')
    expect(result.tldr).toBe('The team discussed project progress.')
    expect(result.fullSummary).toBe('Full detailed summary of the meeting.')
    expect(result.project).toBe('Kayman')
    expect(result.transcriptPath).toBe('/tmp/audio.txt')
  })

  it('applies spotlight bolding to keyPoints containing userName', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ text: validAiResponse } as Awaited<ReturnType<typeof ai.generateText>>)

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: null,
      recordingDir: '/tmp',
      config: mockConfig,
    })

    // 'Szymon presented the demo' should have Szymon bolded
    expect(result.keyPoints[0]).toBe('**Szymon** presented the demo')
    // Other points without userName should be unchanged
    expect(result.keyPoints[1]).toBe('Budget was approved')
  })

  it('leaves keyPoints unchanged when userName not present', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const noNameResponse = JSON.stringify({
      title: 'Meeting',
      tldr: 'Summary',
      keyPoints: ['Point A', 'Point B'],
      fullSummary: 'Full summary.',
    })

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ text: noNameResponse } as Awaited<ReturnType<typeof ai.generateText>>)

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: null,
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(result.keyPoints).toEqual(['Point A', 'Point B'])
  })

  it('applies spotlight to multiple occurrences across multiple keyPoints', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const multiResponse = JSON.stringify({
      title: 'Meeting',
      tldr: 'Summary',
      keyPoints: ['Szymon led the session', 'Action item for Szymon to follow up'],
      fullSummary: 'Full summary.',
    })

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ text: multiResponse } as Awaited<ReturnType<typeof ai.generateText>>)

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: null,
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(result.keyPoints[0]).toBe('**Szymon** led the session')
    expect(result.keyPoints[1]).toBe('Action item for **Szymon** to follow up')
  })

  it('throws PipelineError on AI provider error', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockRejectedValue(new Error('Rate limit exceeded'))

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')

    await expect(
      runSummarize({
        transcriptPath: '/tmp/audio.txt',
        project: null,
        recordingDir: '/tmp',
        config: mockConfig,
      }),
    ).rejects.toThrow(PipelineError)

    await expect(
      runSummarize({
        transcriptPath: '/tmp/audio.txt',
        project: null,
        recordingDir: '/tmp',
        config: mockConfig,
      }),
    ).rejects.toThrow('Rate limit exceeded')
  })

  it('PipelineError on AI error has Summarizing stage', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockRejectedValue(new Error('Auth error'))

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')

    try {
      await runSummarize({
        transcriptPath: '/tmp/audio.txt',
        project: null,
        recordingDir: '/tmp',
        config: mockConfig,
      })
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).stage).toBe(PipelineStage.Summarizing)
    }
  })

  it('writes summary.json to recordingDir', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    const writeFileSyncMock = vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ text: validAiResponse } as Awaited<ReturnType<typeof ai.generateText>>)

    const openaiModule = await import('@ai-sdk/openai')
    vi.mocked(openaiModule.createOpenAI).mockReturnValue((() => 'mock-model') as unknown as ReturnType<typeof openaiModule.createOpenAI>)

    const { runSummarize } = await import('./summarize')
    await runSummarize({
      transcriptPath: '/tmp/recordings/audio.txt',
      project: 'Kayman',
      recordingDir: '/tmp/recordings',
      config: mockConfig,
    })

    expect(writeFileSyncMock).toHaveBeenCalledWith(
      '/tmp/recordings/summary.json',
      expect.any(String),
      'utf8',
    )
  })
})
