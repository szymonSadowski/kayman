import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@kayman/shared', () => ({
  warn: (s: string) => s,
  error: (s: string) => s,
  isTTY: false,
}))

vi.mock('fs', () => ({
  default: {
    accessSync: vi.fn(),
    constants: { X_OK: 1, R_OK: 4 },
  },
}))

const generateTextMock = vi.hoisted(() => vi.fn())
vi.mock('ai', () => ({ generateText: generateTextMock }))

const createProviderModelMock = vi.hoisted(() => vi.fn())
vi.mock('../pipeline/provider.js', () => ({ createProviderModel: createProviderModelMock }))

const retrieveMock = vi.hoisted(() => vi.fn())
vi.mock('@notionhq/client', () => ({
  Client: vi.fn().mockImplementation(() => ({
    databases: { retrieve: retrieveMock },
  })),
  RequestTimeoutError: {
    isRequestTimeoutError: (err: unknown) => (err as Error)?.name === 'RequestTimeoutError',
  },
}))

import fs from 'fs'
import { runPreflightChecks } from './preflight.js'
import type { Config } from '@kayman/shared'

const mockConfig: Config = {
  userName: 'Test',
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: 'key',
  notionToken: 'tok',
  notionDatabaseId: 'db',
  projects: [],
  audioSource: 'system_and_mic',
}

const ollamaConfig: Config = {
  ...mockConfig,
  aiProvider: 'ollama',
  aiModel: 'llama3',
  aiApiKey: '',
}

const mockConfigWithModel: Config = {
  ...mockConfig,
  whisperModelPath: '/path/to/model.bin',
}

const fetchMock = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  vi.clearAllMocks()
  ;(fs.accessSync as Mock).mockReturnValue(undefined)
  createProviderModelMock.mockReturnValue({})
  generateTextMock.mockResolvedValue({ text: 'OK' })
  retrieveMock.mockResolvedValue({ id: 'db' })
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ models: [{ name: 'llama3:latest' }] }) })
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

describe('runPreflightChecks', () => {
  it('passes when all checks succeed', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(runPreflightChecks(mockConfig)).resolves.toBeUndefined()
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('exits 1 when whisper binary missing', async () => {
    ;(fs.accessSync as Mock).mockImplementation((p, flag) => {
      if (flag === fs.constants.X_OK) throw new Error('ENOENT')
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Whisper binary not found'))
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('exits 1 when whisper model missing (when path configured)', async () => {
    ;(fs.accessSync as Mock).mockImplementation((p, flag) => {
      if (flag === fs.constants.R_OK) throw new Error('ENOENT')
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfigWithModel)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Whisper model not found'))
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('skips model check when whisperModelPath not set', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(runPreflightChecks(mockConfig)).resolves.toBeUndefined()
    // accessSync should only be called once (for binary)
    expect(fs.accessSync).toHaveBeenCalledTimes(1)
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('exits 1 when AI provider auth fails', async () => {
    generateTextMock.mockRejectedValue(new Error('401 Unauthorized'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('AI provider authentication failed'))
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('warns and proceeds when AI provider times out', async () => {
    const abortErr = Object.assign(new Error('signal is aborted'), { name: 'AbortError' })
    generateTextMock.mockRejectedValue(abortErr)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).resolves.toBeUndefined()
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('AI provider check timed out'))
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('exits 1 when Notion auth fails', async () => {
    retrieveMock.mockRejectedValue(new Error('Unauthorized'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Notion access failed'))
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('warns and proceeds when Notion times out', async () => {
    const timeoutErr = Object.assign(new Error('Request to Notion API timed out'), { name: 'RequestTimeoutError' })
    retrieveMock.mockRejectedValue(timeoutErr)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).resolves.toBeUndefined()
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Notion check timed out'))
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('warns and proceeds when Notion has DNS/network error', async () => {
    retrieveMock.mockRejectedValue(new Error('ENOTFOUND api.notion.com'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(mockConfig)).resolves.toBeUndefined()
    expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Notion check timed out'))
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('skips Notion check when aiProvider is ollama', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(ollamaConfig)).resolves.toBeUndefined()

    expect(retrieveMock).not.toHaveBeenCalled()
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('exits 1 when Ollama is not reachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(ollamaConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('Ollama not reachable'))
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('exits 1 when Ollama model is not pulled', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ models: [] }) })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(ollamaConfig)).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(
      expect.stringContaining('Ollama model "llama3" not available. Run: kayman verify to set up.')
    )
    expect(process.exit).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
  })

  it('passes when Ollama model is available', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ models: [{ name: 'llama3:latest' }] }) })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(runPreflightChecks(ollamaConfig)).resolves.toBeUndefined()
    expect(process.exit).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })
})
