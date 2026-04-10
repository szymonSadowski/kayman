import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { buildPrompt } from './summarize.js'

vi.mock('fs')
vi.mock('ai')
vi.mock('./provider.js')

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

const validAiOutput = {
  title: 'Team Sync Meeting',
  tldr: 'The team discussed project progress.',
  keyPoints: ['Szymon presented the demo', 'Budget was approved', 'Next steps defined'],
  fullSummary: 'Full detailed summary of the meeting.',
}

describe('runSummarize', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns a Summary object with spotlight applied', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript content')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: 'Kayman',
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(result.title).toBe('Team Sync Meeting')
    expect(result.tldr).toBe('The team discussed project progress.')
    expect(result.fullSummary).toContain('Full detailed summary of the meeting.')
    expect(result.fullSummary).toContain('**Full Transcript:**')
    expect(result.fullSummary).toContain('transcript content')
    expect(result.project).toBe('Kayman')
    expect(result.transcriptPath).toBe('/tmp/audio.txt')
  })

  it('applies spotlight bolding to keyPoints containing userName', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
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

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({
      output: {
        title: 'Meeting',
        tldr: 'Summary',
        keyPoints: ['Point A', 'Point B'],
        fullSummary: 'Full summary.',
      },
    } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
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

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({
      output: {
        title: 'Meeting',
        tldr: 'Summary',
        keyPoints: ['Szymon led the session', 'Action item for Szymon to follow up'],
        fullSummary: 'Full summary.',
      },
    } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
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

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')

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

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')

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

  it('returns hardcoded Empty Recording summary for empty transcript', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => '   ')
    const writeFileSyncMock = vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: 'Kayman',
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(result.title).toBe('Empty Recording')
    expect(result.tldr).toBe('No speech detected in this recording.')
    expect(result.keyPoints).toEqual([])
    expect(result.fullSummary).toContain('No speech was detected')
    expect(result.project).toBe('Kayman')
    expect(writeFileSyncMock).toHaveBeenCalledWith('/tmp/summary.json', expect.any(String), 'utf8')
  })

  it('does not call AI for empty transcript', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => '')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({
      transcriptPath: '/tmp/audio.txt',
      project: null,
      recordingDir: '/tmp',
      config: mockConfig,
    })

    expect(ai.generateText).not.toHaveBeenCalled()
  })

  it('writes summary.json to recordingDir', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    const writeFileSyncMock = vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
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

describe('buildPrompt', () => {
  it('returns custom template + transcript when promptTemplate is provided', () => {
    const result = buildPrompt('my transcript', 'Custom template.')
    expect(result).toBe('Custom template.\nTranscript:\nmy transcript')
  })

  it('returns default prompt when promptTemplate is undefined', () => {
    const result = buildPrompt('my transcript', undefined)
    expect(result).toContain('You are an expert summarizer')
    expect(result).toContain('my transcript')
  })

  it('returns default prompt when promptTemplate is empty string', () => {
    const result = buildPrompt('my transcript', '')
    expect(result).toContain('You are an expert summarizer')
  })

  it('returns default prompt when promptTemplate is whitespace only', () => {
    const result = buildPrompt('my transcript', '   ')
    expect(result).toContain('You are an expert summarizer')
  })

  it('trims leading/trailing whitespace from custom template', () => {
    const result = buildPrompt('my transcript', '  Custom template.  ')
    expect(result).toBe('Custom template.\nTranscript:\nmy transcript')
  })
})

describe('runSummarize with promptTemplate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const validAiOutput = {
    title: 'Test',
    tldr: 'Summary.',
    keyPoints: ['Point A'],
    fullSummary: 'Full summary.',
  }

  it('passes custom promptTemplate to generateText when project has one', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'the transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const configWithTemplate: Config = {
      userName: 'Szymon',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiApiKey: 'sk-test',
      notionToken: 'secret',
      notionDatabaseId: 'db-123',
      projects: [{ name: 'Standup', notionPageId: 'page-1', promptTemplate: 'Custom standup prompt.' }],
      audioSource: 'system_and_mic',
    }

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({ transcriptPath: '/tmp/t.txt', project: 'Standup', recordingDir: '/tmp', config: configWithTemplate })

    expect(ai.generateText).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Custom standup prompt.\nTranscript:\nthe transcript',
    }))
  })

  it('uses default prompt when project has no promptTemplate', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'the transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const configNoTemplate: Config = {
      userName: 'Szymon',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiApiKey: 'sk-test',
      notionToken: 'secret',
      notionDatabaseId: 'db-123',
      projects: [{ name: 'Client', notionPageId: 'page-2' }],
      audioSource: 'system_and_mic',
    }

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({ transcriptPath: '/tmp/t.txt', project: 'Client', recordingDir: '/tmp', config: configNoTemplate })

    const call = vi.mocked(ai.generateText).mock.calls[0][0]
    expect((call as { prompt: string }).prompt).toContain('You are an expert summarizer')
  })

  it('uses default prompt when project is null (memo)', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'the transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({ transcriptPath: '/tmp/t.txt', project: null, recordingDir: '/tmp', config: { userName: 'Szymon', aiProvider: 'openai', aiModel: 'gpt-4o-mini', aiApiKey: 'sk-test', notionToken: 'secret', notionDatabaseId: 'db-123', projects: [], audioSource: 'system_and_mic' } })

    const call = vi.mocked(ai.generateText).mock.calls[0][0]
    expect((call as { prompt: string }).prompt).toContain('You are an expert summarizer')
  })

  it('uses default prompt when project name not found in config.projects', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'the transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const configWithProjects: Config = {
      userName: 'Szymon',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiApiKey: 'sk-test',
      notionToken: 'secret',
      notionDatabaseId: 'db-123',
      projects: [{ name: 'Standup', notionPageId: 'page-1', promptTemplate: 'Custom prompt.' }],
      audioSource: 'system_and_mic',
    }

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({ transcriptPath: '/tmp/t.txt', project: 'UnknownProject', recordingDir: '/tmp', config: configWithProjects })

    const call = vi.mocked(ai.generateText).mock.calls[0][0]
    expect((call as { prompt: string }).prompt).toContain('You are an expert summarizer')
  })

  it('does not append full transcript to fullSummary when custom promptTemplate is used (short transcript)', async () => {
    const shortTranscript = 'short'
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => shortTranscript)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const configWithTemplate: Config = {
      userName: 'Szymon',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      aiApiKey: 'sk-test',
      notionToken: 'secret',
      notionDatabaseId: 'db-123',
      projects: [{ name: 'Standup', notionPageId: 'page-1', promptTemplate: 'Custom standup prompt.' }],
      audioSource: 'system_and_mic',
    }

    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({ transcriptPath: '/tmp/t.txt', project: 'Standup', recordingDir: '/tmp', config: configWithTemplate })

    expect(result.fullSummary).not.toContain('**Full Transcript:**')
    expect(result.fullSummary).toBe(validAiOutput.fullSummary)
  })
})
