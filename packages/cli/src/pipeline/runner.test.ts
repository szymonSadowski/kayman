import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('fs')
vi.mock('./transcribe.js')
vi.mock('./summarize.js')
vi.mock('./export.js')
vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    loadConfig: vi.fn(),
    notify: vi.fn(),
    notifyError: vi.fn(),
  }
})

const flush = () => new Promise<void>((r) => setTimeout(r, 0))

const mockSummary = {
  title: 'Test Meeting',
  tldr: 'Summary',
  keyPoints: [],
  fullSummary: 'Full.',
  project: 'MyProject',
  recordedAt: '2026-04-03T10:00:00.000Z',
  transcriptPath: '/tmp/recordings/audio.txt',
}

describe('pipeline runner', () => {
  let exitSpy: { mockRestore(): void; mock: { calls: unknown[][] } }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.argv = ['node', 'runner.js', '/tmp/audio.caf', 'MyProject', '/tmp/recordings']
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never)
  })

  afterEach(() => {
    exitSpy.mockRestore()
  })

  it('happy path: notifies all stages, writes pointer, cleans up audio and transcript', async () => {
    const shared = await import('@kayman/shared')
    const { runTranscribe } = await import('./transcribe.js')
    const { runSummarize } = await import('./summarize.js')
    const { runExport } = await import('./export.js')
    const fs = await import('fs')

    vi.mocked(shared.loadConfig).mockReturnValue({} as never)
    vi.mocked(runTranscribe).mockResolvedValue('/tmp/recordings/audio.txt')
    vi.mocked(runSummarize).mockResolvedValue(mockSummary as never)
    vi.mocked(runExport).mockResolvedValue('page-id')
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as never)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined)

    await import('./runner.js')
    await flush()

    expect(shared.notify).toHaveBeenCalledWith(shared.PipelineStage.Transcribing)
    expect(shared.notify).toHaveBeenCalledWith(shared.PipelineStage.Summarizing)
    expect(shared.notify).toHaveBeenCalledWith(shared.PipelineStage.Exporting)
    expect(shared.notify).toHaveBeenCalledWith(shared.PipelineStage.Done)
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      shared.LAST_SUMMARY_PATH,
      expect.stringContaining('summaryPath'),
      'utf8',
    )
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/recordings/.exported',
      '',
      'utf8',
    )
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/audio.caf')
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/recordings/audio.txt')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('notifyError with transcribe stage and exits 1 on transcribe PipelineError', async () => {
    const shared = await import('@kayman/shared')
    const { runTranscribe } = await import('./transcribe.js')

    vi.mocked(shared.loadConfig).mockReturnValue({} as never)
    const err = new shared.PipelineError(shared.PipelineStage.Transcribing, 'whisper not found')
    vi.mocked(runTranscribe).mockRejectedValue(err)

    await import('./runner.js')
    await flush()

    expect(shared.notifyError).toHaveBeenCalledWith(shared.PipelineStage.Transcribing, err, undefined)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('notifyError with summarize stage and transcript path on summarize PipelineError', async () => {
    const shared = await import('@kayman/shared')
    const { runTranscribe } = await import('./transcribe.js')
    const { runSummarize } = await import('./summarize.js')

    vi.mocked(shared.loadConfig).mockReturnValue({} as never)
    vi.mocked(runTranscribe).mockResolvedValue('/tmp/recordings/audio.txt')
    const err = new shared.PipelineError(shared.PipelineStage.Summarizing, 'AI error')
    vi.mocked(runSummarize).mockRejectedValue(err)

    await import('./runner.js')
    await flush()

    expect(shared.notifyError).toHaveBeenCalledWith(
      shared.PipelineStage.Summarizing,
      err,
      '/tmp/recordings/audio.txt',
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('uses Transcribing stage for unknown (non-PipelineError) errors', async () => {
    const shared = await import('@kayman/shared')
    const { runTranscribe } = await import('./transcribe.js')

    vi.mocked(shared.loadConfig).mockReturnValue({} as never)
    const unknownErr = new Error('Something unexpected')
    vi.mocked(runTranscribe).mockRejectedValue(unknownErr)

    await import('./runner.js')
    await flush()

    expect(shared.notifyError).toHaveBeenCalledWith(
      shared.PipelineStage.Transcribing,
      unknownErr,
      undefined,
    )
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('passes empty string project arg as null to summarize', async () => {
    process.argv = ['node', 'runner.js', '/tmp/audio.caf', '', '/tmp/recordings']

    const shared = await import('@kayman/shared')
    const { runTranscribe } = await import('./transcribe.js')
    const { runSummarize } = await import('./summarize.js')
    const { runExport } = await import('./export.js')
    const fs = await import('fs')

    vi.mocked(shared.loadConfig).mockReturnValue({} as never)
    vi.mocked(runTranscribe).mockResolvedValue('/tmp/recordings/audio.txt')
    vi.mocked(runSummarize).mockResolvedValue({ ...mockSummary, project: null } as never)
    vi.mocked(runExport).mockResolvedValue('page-id')
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined as never)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined)

    await import('./runner.js')
    await flush()

    const summarizeCall = vi.mocked(runSummarize).mock.calls.at(-1)![0]
    expect(summarizeCall.project).toBeNull()
  })
})
