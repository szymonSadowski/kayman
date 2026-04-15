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

vi.mock('@inquirer/select', () => ({
  default: vi.fn(),
}))

vi.mock('@inquirer/input', () => ({
  default: vi.fn(),
}))

import { setConfigValues } from './config-writer.js'
import { loadConfig } from '@kayman/shared'
import { onlineCommand } from './online.js'

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

const snapshot = {
  ai_provider: 'openai',
  ai_model: 'gpt-4o-mini',
  ai_api_key: 'sk-abc',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('onlineCommand', () => {
  it('already online — prints message and exits 0', async () => {
    vi.mocked(loadConfig).mockReturnValue(cloudConfig as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(onlineCommand()).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(0)
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Already in online mode (provider: openai)')
    expect(vi.mocked(setConfigValues)).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('from ollama with snapshot — restores settings', async () => {
    vi.mocked(loadConfig).mockReturnValue(offlineConfig as never)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(snapshot) as never)

    await onlineCommand()

    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith({
      ai_provider: 'openai',
      ai_model: 'gpt-4o-mini',
      ai_api_key: 'sk-abc',
    })

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Switched to online mode (provider: openai, model: gpt-4o-mini)')
  })

  it('from ollama without snapshot — runs interactive prompts and saves', async () => {
    vi.mocked(loadConfig).mockReturnValue(offlineConfig as never)
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const { default: select } = await import('@inquirer/select')
    const { default: input } = await import('@inquirer/input')
    vi.mocked(select).mockResolvedValue('anthropic' as never)
    vi.mocked(input)
      .mockResolvedValueOnce('claude-haiku-4-5-20251001')
      .mockResolvedValueOnce('sk-ant-key')

    await onlineCommand()

    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      SNAPSHOT_PATH,
      expect.stringContaining('"ai_provider"'),
      'utf8',
    )
    const snapshotArg = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string
    const saved = JSON.parse(snapshotArg)
    expect(saved.ai_provider).toBe('anthropic')
    expect(saved.ai_model).toBe('claude-haiku-4-5-20251001')
    expect(saved.ai_api_key).toBe('sk-ant-key')

    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith({
      ai_provider: 'anthropic',
      ai_model: 'claude-haiku-4-5-20251001',
      ai_api_key: 'sk-ant-key',
    })

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Switched to online mode (provider: anthropic')
  })

  it('corrupted snapshot — warns and falls back to interactive prompts', async () => {
    vi.mocked(loadConfig).mockReturnValue(offlineConfig as never)
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{' as never)
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined)
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined)

    const { default: select } = await import('@inquirer/select')
    const { default: input } = await import('@inquirer/input')
    vi.mocked(select).mockResolvedValue('openai' as never)
    vi.mocked(input)
      .mockResolvedValueOnce('gpt-4o-mini')
      .mockResolvedValueOnce('sk-new-key')

    await onlineCommand()

    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Warning')
    expect(err).toContain('invalid')
    expect(vi.mocked(setConfigValues)).toHaveBeenCalledWith({
      ai_provider: 'openai',
      ai_model: 'gpt-4o-mini',
      ai_api_key: 'sk-new-key',
    })
  })

  it('broken config — falls back to raw YAML provider check', async () => {
    vi.mocked(loadConfig).mockImplementation(() => { throw new Error('Config error') })
    vi.mocked(fs.readFileSync).mockReturnValue('ai_provider: openai\nai_model: gpt-4o-mini\n' as never)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(onlineCommand()).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(0)
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Already in online mode (provider: openai)')
    exitSpy.mockRestore()
  })
})
