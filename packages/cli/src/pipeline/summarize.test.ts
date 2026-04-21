import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { buildPrompt, calculateCost } from './summarize.js'

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

  it('does not append Full Transcript when transcript is long (>= 300 words)', async () => {
    const longTranscript = Array(300).fill('word').join(' ')
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => longTranscript)
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

    expect(result.fullSummary).toBe(validAiOutput.fullSummary)
    expect(result.fullSummary).not.toContain('**Full Transcript:**')
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

describe('runSummarize Ollama error handling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const ollamaConfig: Config = {
    userName: 'Szymon',
    aiProvider: 'ollama',
    aiModel: 'llama3.2',
    notionToken: 'secret_test',
    notionDatabaseId: 'db-123',
    projects: [],
    audioSource: 'system_and_mic',
  }

  it('throws PipelineError with "Ollama not reachable" when ECONNREFUSED', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    const connErr = new Error('fetch failed') as Error & { cause?: Error }
    connErr.cause = new Error('connect ECONNREFUSED 127.0.0.1:11434')
    vi.mocked(ai.generateText).mockRejectedValue(connErr)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await expect(
      runSummarize({ transcriptPath: '/tmp/audio.txt', project: null, recordingDir: '/tmp', config: ollamaConfig }),
    ).rejects.toThrow('Ollama not reachable at http://localhost:11434')
  })

  it('throws PipelineError with model not found when 404 model error', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockRejectedValue(new Error("model 'llama3.2' not found, try pulling it first"))

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await expect(
      runSummarize({ transcriptPath: '/tmp/audio.txt', project: null, recordingDir: '/tmp', config: ollamaConfig }),
    ).rejects.toThrow("Model 'llama3.2' not found in Ollama. Run: ollama pull llama3.2")
  })

  it('uses custom aiBaseUrl in Ollama not reachable error message', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    const connErr = new Error('fetch failed') as Error & { cause?: Error }
    connErr.cause = new Error('connect ECONNREFUSED 192.168.1.10:11434')
    vi.mocked(ai.generateText).mockRejectedValue(connErr)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await expect(
      runSummarize({
        transcriptPath: '/tmp/audio.txt',
        project: null,
        recordingDir: '/tmp',
        config: { ...ollamaConfig, aiBaseUrl: 'http://192.168.1.10:11434' },
      }),
    ).rejects.toThrow('Ollama not reachable at http://192.168.1.10:11434')
  })

  it('throws PipelineError with "Ollama not reachable" when ECONNRESET', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockRejectedValue(new Error('read ECONNRESET'))

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await expect(
      runSummarize({ transcriptPath: '/tmp/audio.txt', project: null, recordingDir: '/tmp', config: ollamaConfig }),
    ).rejects.toThrow('Ollama not reachable at http://localhost:11434')
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

  it('uses memo prompt when isMemo=true', () => {
    const result = buildPrompt('my transcript', undefined, true)
    expect(result).toContain('personal note-taking assistant')
    expect(result).toContain('my transcript')
    expect(result).not.toContain('You are an expert summarizer')
  })

  it('uses default meeting prompt when isMemo=false', () => {
    const result = buildPrompt('my transcript', undefined, false)
    expect(result).toContain('You are an expert summarizer')
    expect(result).not.toContain('personal note-taking assistant')
  })

  it('custom template wins over isMemo=true', () => {
    const result = buildPrompt('my transcript', 'Custom template.', true)
    expect(result).toBe('Custom template.\nTranscript:\nmy transcript')
    expect(result).not.toContain('personal note-taking assistant')
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

  it('uses default prompt when project is null and isMemo not set', async () => {
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

  it('uses memo prompt when isMemo=true is passed to runSummarize', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'voice memo transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({ output: validAiOutput } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    await runSummarize({ transcriptPath: '/tmp/t.txt', project: null, recordingDir: '/tmp', config: mockConfig, isMemo: true })

    const call = vi.mocked(ai.generateText).mock.calls[0][0]
    expect((call as { prompt: string }).prompt).toContain('personal note-taking assistant')
    expect((call as { prompt: string }).prompt).not.toContain('You are an expert summarizer')
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

describe('calculateCost', () => {
  it('returns 0 for ollama regardless of model', () => {
    expect(calculateCost('ollama', 'llama3.2', { inputTokens: 1000, outputTokens: 500 })).toBe(0)
  })

  it('returns 0 for ollama when usage is undefined', () => {
    expect(calculateCost('ollama', 'llama3.2', undefined)).toBe(0)
  })

  it('calculates correct cost for known model', () => {
    // gpt-4o: input $2.50/M, output $10.00/M
    // 1000 input tokens = 0.0025, 500 output tokens = 0.005 → 0.0075
    const cost = calculateCost('openai', 'gpt-4o', { inputTokens: 1000, outputTokens: 500 })
    expect(cost).toBe(0.0075)
  })

  it('returns undefined for unknown model', () => {
    expect(calculateCost('openai', 'gpt-99-ultra', { inputTokens: 1000, outputTokens: 500 })).toBeUndefined()
  })

  it('returns undefined when usage is undefined for non-ollama provider', () => {
    expect(calculateCost('openai', 'gpt-4o', undefined)).toBeUndefined()
  })
})

describe('runSummarize cost field', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const mockConfigOpenAI: Config = {
    userName: 'Szymon',
    aiProvider: 'openai',
    aiModel: 'gpt-4o',
    aiApiKey: 'sk-test',
    notionToken: 'secret_test',
    notionDatabaseId: 'db-123',
    projects: [],
    audioSource: 'system_and_mic',
  }

  const ollamaConfig: Config = {
    userName: 'Szymon',
    aiProvider: 'ollama',
    aiModel: 'llama3.2',
    notionToken: 'secret_test',
    notionDatabaseId: 'db-123',
    projects: [],
    audioSource: 'system_and_mic',
  }

  const validOutput = {
    title: 'T', tldr: 'S', keyPoints: [], fullSummary: 'F',
  }

  it('sets summary.cost from token usage for known model', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript content')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({
      output: validOutput,
      usage: { inputTokens: 1000, outputTokens: 500 },
    } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({ transcriptPath: '/tmp/t.txt', project: null, recordingDir: '/tmp', config: mockConfigOpenAI })

    // gpt-4o: 1000 input @ $2.50/M + 500 output @ $10.00/M = 0.0025 + 0.005 = 0.0075
    expect(result.cost).toBe(0.0075)
  })

  it('sets summary.cost to undefined for unknown model', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({
      output: validOutput,
      usage: { inputTokens: 1000, outputTokens: 500 },
    } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const unknownModelConfig: Config = { ...mockConfigOpenAI, aiModel: 'gpt-99-ultra' }
    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({ transcriptPath: '/tmp/t.txt', project: null, recordingDir: '/tmp', config: unknownModelConfig })

    expect(result.cost).toBeUndefined()
  })

  it('sets summary.cost to 0 for ollama provider', async () => {
    const fs = await import('fs')
    vi.mocked(fs.readFileSync).mockImplementation(() => 'transcript')
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const ai = await import('ai')
    vi.mocked(ai.generateText).mockResolvedValue({
      output: validOutput,
      usage: { inputTokens: 0, outputTokens: 0 },
    } as Awaited<ReturnType<typeof ai.generateText>>)

    const providerModule = await import('./provider.js')
    vi.mocked(providerModule.createProviderModel).mockReturnValue('mock-model' as unknown as ReturnType<typeof providerModule.createProviderModel>)

    const { runSummarize } = await import('./summarize.js')
    const result = await runSummarize({ transcriptPath: '/tmp/t.txt', project: null, recordingDir: '/tmp', config: ollamaConfig })

    expect(result.cost).toBe(0)
  })
})
