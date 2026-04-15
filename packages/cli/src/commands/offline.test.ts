import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('./config-writer.js', () => ({
  CONFIG_PATH: '/mock/.config/kayman/config.yaml',
  setConfigValue: vi.fn(),
  setConfigValues: vi.fn(),
}))

vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    loadConfig: vi.fn(),
  }
})

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    },
  }
})

import { setConfigValues } from './config-writer.js'
import { loadConfig } from '@kayman/shared'
import { offlineCommand } from './offline.js'

const SNAPSHOT_PATH = path.join(os.homedir(), '.config', 'kayman', '.online-config')

const cloudConfig = {
  userName: 'Szymon',
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiApiKey: 'sk-abc',
  notionToken: 'ntn',
  notionDatabaseId: 'dbid',
  projects: [],
  audioSource: 'system_and_mic' as const,
}

const offlineConfig = {
  ...cloudConfig,
  aiProvider: 'ollama',
  aiModel: 'llama3.2',
  aiApiKey: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('offlineCommand', () => {
  it('already offline — prints message and exits 0', async () => {
    vi.mocked(loadConfig).mockReturnValue(offlineConfig as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(offlineCommand({})).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(0)
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Already in offline mode')
    expect(vi.mocked(setConfigValues)).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('from cloud — saves snapshot and switches to ollama', async () => {
    vi.mocked(loadConfig).mockReturnValue(cloudConfig as never)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    await offlineCommand({})

    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      path.dirname(SNAPSHOT_PATH),
      { recursive: true },
    )
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      SNAPSHOT_PATH,
      expect.stringContaining('"ai_provider"'),
      'utf8',
    )
    const snapshotArg = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    const snapshot = JSON.parse(snapshotArg)
    expect(snapshot.ai_provider).toBe('openai')
    expect(snapshot.ai_model).toBe('gpt-4o-mini')
    expect(snapshot.ai_api_key).toBe('sk-abc')

    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith({
      ai_provider: 'ollama',
      ai_model: 'llama3.2',
      ai_api_key: '',
    })

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Switched to offline mode')
    expect(out).toContain('ollama')
    expect(out).toContain('llama3.2')
  })

  it('--model mistral — uses specified model', async () => {
    vi.mocked(loadConfig).mockReturnValue(cloudConfig as never)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    await offlineCommand({ model: 'mistral' })

    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith(
      expect.objectContaining({ ai_model: 'mistral' }),
    )
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('mistral')
  })

  it('broken config — falls back to raw YAML and switches to ollama', async () => {
    vi.mocked(loadConfig).mockImplementation(() => { throw new Error('Config error: ai_api_key is required') })
    vi.mocked(fs.readFileSync).mockReturnValue(
      'ai_provider: openai\nai_model: gpt-4o-mini\nai_api_key: sk-abc\n' as never,
    )
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    await offlineCommand({})

    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith({
      ai_provider: 'ollama',
      ai_model: 'llama3.2',
      ai_api_key: '',
    })
    const snapshotArg = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    const snapshot = JSON.parse(snapshotArg)
    expect(snapshot.ai_provider).toBe('openai')
    expect(snapshot.ai_api_key).toBe('sk-abc')
  })
})
