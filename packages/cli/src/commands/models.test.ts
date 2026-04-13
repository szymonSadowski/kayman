import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

vi.mock('./config-writer.js', () => ({
  setConfigValue: vi.fn(),
}))

import { setConfigValue } from './config-writer.js'
import { modelsCommand } from './models.js'
import type { Config } from '@kayman/shared'

const WHISPER_MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper')

const mockConfig: Config = {
  userName: 'Test',
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: 'key',
  notionToken: 'tok',
  notionDatabaseId: 'db',
  projects: [],
  audioSource: 'system_and_mic',
  whisperBinaryPath: undefined,
  whisperModelPath: undefined,
}

function makeBody(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('modelsCommand list', () => {
  it('shows all models with downloaded status', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p).endsWith('ggml-base.bin')
    })

    await modelsCommand(['list'], mockConfig)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('tiny')
    expect(out).toContain('base')
    expect(out).toContain('small')
    expect(out).toContain('medium')
    expect(out).toContain('large')
  })

  it('highlights active model when whisperModelPath set', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const config = { ...mockConfig, whisperModelPath: path.join(WHISPER_MODEL_DIR, 'ggml-small.bin') }

    await modelsCommand(['list'], config)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('← active')
  })

  it('runs list when no subcommand given', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    await modelsCommand([], mockConfig)
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('tiny')
  })
})

describe('modelsCommand download', () => {
  it('downloads model to correct path and updates config', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined)

    const fakeChunk = new TextEncoder().encode('data')
    const mockWriter = {
      write: vi.fn(),
      end: vi.fn((cb: (err?: Error | null) => void) => cb()),
    }
    vi.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriter as unknown as ReturnType<typeof fs.createWriteStream>)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (h: string) => h === 'content-length' ? String(fakeChunk.length) : null },
      body: makeBody(fakeChunk),
    } as unknown as Response)

    await modelsCommand(['download', 'base'], mockConfig)

    const expectedDest = path.join(WHISPER_MODEL_DIR, 'ggml-base.bin')
    expect(vi.mocked(fs.createWriteStream)).toHaveBeenCalledWith(expectedDest)
    expect(mockWriter.write).toHaveBeenCalledWith(fakeChunk)
    expect(setConfigValue).toHaveBeenCalledWith('whisper_model_path', expectedDest)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Downloaded to')
  })

  it('exits code 1 for invalid model name', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(modelsCommand(['download', 'giant'], mockConfig)).rejects.toThrow('exit')

    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Unknown model')
    expect(err).toContain('tiny')
    exitSpy.mockRestore()
  })

  it('skips download if model already downloaded', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    global.fetch = vi.fn()

    await modelsCommand(['download', 'base'], mockConfig)

    expect(global.fetch).not.toHaveBeenCalled()
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('already downloaded')
  })
})

describe('modelsCommand remove', () => {
  it('deletes model file and prints confirmation', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

    await modelsCommand(['remove', 'base'], mockConfig)

    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(WHISPER_MODEL_DIR, 'ggml-base.bin'))
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Removed model')
  })

  it('warns when removing the active model', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined)

    const config = { ...mockConfig, whisperModelPath: path.join(WHISPER_MODEL_DIR, 'ggml-base.bin') }
    await modelsCommand(['remove', 'base'], config)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Warning: active model removed')
  })

  it('exits code 1 for unknown model name', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(modelsCommand(['remove', 'giant'], mockConfig)).rejects.toThrow('exit')

    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Unknown model')
    exitSpy.mockRestore()
  })

  it('exits code 1 when model is not downloaded', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(modelsCommand(['remove', 'base'], mockConfig)).rejects.toThrow('exit')

    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('not downloaded')
    exitSpy.mockRestore()
  })
})
