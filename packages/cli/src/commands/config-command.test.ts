import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

vi.mock('./config-writer.js', () => ({
  CONFIG_PATH: '/mock/.config/kayman/config.yaml',
  setConfigValue: vi.fn(),
}))

vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    loadConfig: vi.fn(),
  }
})

import { CONFIG_PATH, setConfigValue } from './config-writer.js'
import { loadConfig } from '@kayman/shared'
import { configCommand } from './config-command.js'

const mockConfig = {
  userName: 'Szymon',
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: 'sk-abcdefghij123456',
  aiBaseUrl: undefined,
  notionToken: 'secret_notionTOKEN',
  notionDatabaseId: 'dbid',
  projects: [],
  audioSource: 'system_and_mic' as const,
  whisperBinaryPath: undefined,
  whisperModelPath: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  vi.mocked(loadConfig).mockReturnValue(mockConfig)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// --- list ---

describe('configCommand list', () => {
  it('prints all fields as key: value', async () => {
    await configCommand(['list'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('ai_provider: openai')
    expect(out).toContain('user_name: Szymon')
  })

  it('masks ai_api_key', async () => {
    await configCommand(['list'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).not.toContain('sk-abcdefghij123456')
    expect(out).toContain('sk-...123456')
  })

  it('masks notion_token', async () => {
    await configCommand(['list'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).not.toContain('secret_notionTOKEN')
    expect(out).toContain('sec...nTOKEN')
  })
})

// --- get ---

describe('configCommand get', () => {
  it('prints value for known field', async () => {
    await configCommand(['get', 'ai_provider'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('openai')
  })

  it('prints unmasked sensitive value for explicit get', async () => {
    await configCommand(['get', 'ai_api_key'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('sk-abcdefghij123456')
  })

  it('exits 1 for unknown field', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(configCommand(['get', 'nonexistent_field'])).rejects.toThrow('exit')
    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Unknown config field')
    exitSpy.mockRestore()
  })
})

// --- set ---

describe('configCommand set', () => {
  it('sets valid enum value and prints confirmation', async () => {
    await configCommand(['set', 'ai_provider', 'ollama'])
    expect(vi.mocked(setConfigValue)).toHaveBeenCalledWith('ai_provider', 'ollama')
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('ai_provider set to "ollama"')
  })

  it('sets string field and prints confirmation', async () => {
    await configCommand(['set', 'user_name', 'Szymon'])
    expect(vi.mocked(setConfigValue)).toHaveBeenCalled()
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('user_name set to "Szymon"')
  })

  it('exits 1 for invalid enum value, does not write', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(configCommand(['set', 'ai_provider', 'invalid_provider'])).rejects.toThrow('exit')
    expect(vi.mocked(setConfigValue)).not.toHaveBeenCalled()
    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Invalid value for ai_provider')
    expect(err).toContain('openai')
    exitSpy.mockRestore()
  })

  it('exits 1 for unknown field, does not write', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(configCommand(['set', 'nonexistent_field', 'val'])).rejects.toThrow('exit')
    expect(vi.mocked(setConfigValue)).not.toHaveBeenCalled()
    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Unknown config field')
    exitSpy.mockRestore()
  })

  it('prints special message for projects field and exits 0', async () => {
    await configCommand(['set', 'projects', 'anything'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('complex field')
    expect(vi.mocked(setConfigValue)).not.toHaveBeenCalled()
  })

  it('exits 1 for missing value on string field, does not write', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    await expect(configCommand(['set', 'user_name'])).rejects.toThrow('exit')
    expect(vi.mocked(setConfigValue)).not.toHaveBeenCalled()
    const err = vi.mocked(process.stderr.write).mock.calls.map((c) => c[0] as string).join('')
    expect(err).toContain('Missing value for user_name')
    exitSpy.mockRestore()
  })

  it('wraps value with spaces in quotes and escapes inner double quotes', async () => {
    await configCommand(['set', 'user_name', 'say "hi" there'])
    expect(vi.mocked(setConfigValue)).toHaveBeenCalledWith('user_name', '"say \\"hi\\" there"')
  })
})

// --- path ---

describe('configCommand path', () => {
  it('prints CONFIG_PATH', async () => {
    await configCommand(['path'])
    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain(CONFIG_PATH)
  })
})
