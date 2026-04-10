import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

// Mock fs and child_process before importing the module under test
vi.mock('fs')
vi.mock('child_process')

const mockConfig: Config = {
  userName: 'Szymon',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: 'sk-test',
  notionToken: 'secret_test',
  notionDatabaseId: 'db-123',
  projects: [],
  audioSource: 'system_and_mic',
  whisperBinaryPath: '/usr/local/bin/whisper',
  whisperModelPath: '/models/ggml-base.en.bin',
}

describe('runTranscribe', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('throws PipelineError when whisper binary is missing', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockImplementation((p) => p !== '/usr/local/bin/whisper')

    const { runTranscribe } = await import('./transcribe.js')

    await expect(
      runTranscribe({ audioPath: '/tmp/audio.caf', transcriptDir: '/tmp', config: mockConfig }),
    ).rejects.toThrow(PipelineError)

    await expect(
      runTranscribe({ audioPath: '/tmp/audio.caf', transcriptDir: '/tmp', config: mockConfig }),
    ).rejects.toThrow('whisper binary not found at /usr/local/bin/whisper')
  })

  it('throws PipelineError when whisper model is missing', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockImplementation((p) => p !== '/models/ggml-base.en.bin')

    const { runTranscribe } = await import('./transcribe.js')

    await expect(
      runTranscribe({ audioPath: '/tmp/audio.caf', transcriptDir: '/tmp', config: mockConfig }),
    ).rejects.toThrow('whisper model not found at /models/ggml-base.en.bin')
  })

  it('throws PipelineError when whisper exits non-zero', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const cp = await import('child_process')
    const fakeChild = new EventEmitter() as ReturnType<typeof cp.spawn>
    vi.mocked(cp.spawn).mockReturnValue(fakeChild)

    const { runTranscribe } = await import('./transcribe.js')
    const promise = runTranscribe({
      audioPath: '/tmp/audio.caf',
      transcriptDir: '/tmp',
      config: mockConfig,
    })

    fakeChild.emit('close', 1)

    await expect(promise).rejects.toThrow('Transcription failed: audio file may be corrupted or too short.')
    await expect(promise).rejects.toBeInstanceOf(PipelineError)
  })

  it('returns transcript path on success', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const cp = await import('child_process')
    const fakeChild = new EventEmitter() as ReturnType<typeof cp.spawn>
    vi.mocked(cp.spawn).mockReturnValue(fakeChild)

    const { runTranscribe } = await import('./transcribe.js')
    const promise = runTranscribe({
      audioPath: '/tmp/recordings/audio.caf',
      transcriptDir: '/tmp/recordings',
      config: mockConfig,
    })

    fakeChild.emit('close', 0)

    const result = await promise
    expect(result).toBe('/tmp/recordings/audio.txt')
  })

  it('uses default binary/model paths when config omits them', async () => {
    const configWithoutPaths: Config = { ...mockConfig, whisperBinaryPath: undefined, whisperModelPath: undefined }

    const fs = await import('fs')
    const existsSyncMock = vi.mocked(fs.existsSync)
    existsSyncMock.mockReturnValue(false)

    const { runTranscribe } = await import('./transcribe.js')

    await expect(
      runTranscribe({ audioPath: '/tmp/audio.caf', transcriptDir: '/tmp', config: configWithoutPaths }),
    ).rejects.toThrow('whisper binary not found at /usr/local/bin/whisper')
  })

  it('throws PipelineError on child process error event', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(true)

    const cp = await import('child_process')
    const fakeChild = new EventEmitter() as ReturnType<typeof cp.spawn>
    vi.mocked(cp.spawn).mockReturnValue(fakeChild)

    const { runTranscribe } = await import('./transcribe.js')
    const promise = runTranscribe({
      audioPath: '/tmp/audio.caf',
      transcriptDir: '/tmp',
      config: mockConfig,
    })

    fakeChild.emit('error', new Error('spawn ENOENT'))

    await expect(promise).rejects.toBeInstanceOf(PipelineError)
    await expect(promise).rejects.toThrow('spawn ENOENT')
  })

  it('PipelineError has correct stage', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)

    const { runTranscribe } = await import('./transcribe.js')

    try {
      await runTranscribe({ audioPath: '/tmp/audio.caf', transcriptDir: '/tmp', config: mockConfig })
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineError)
      expect((err as PipelineError).stage).toBe(PipelineStage.Transcribing)
    }
  })
})
