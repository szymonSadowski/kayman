import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'

vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    loadConfig: vi.fn(),
  }
})

vi.mock('@notionhq/client')
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))
vi.mock('../pipeline/provider.js', () => ({
  createProviderModel: vi.fn(),
}))

import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { verifyCommand } from './verify.js'
import { Client } from '@notionhq/client'
import { generateText } from 'ai'
import { createProviderModel } from '../pipeline/provider.js'

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

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verifyCommand', () => {
  it('prints all pass when everything works', async () => {
    vi.mocked(loadConfig).mockReturnValue(mockConfig)
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined)
    vi.mocked(createProviderModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockResolvedValue({} as never)
    vi.mocked(Client).mockImplementation(() => ({
      databases: { retrieve: vi.fn().mockResolvedValue({}) },
    }) as unknown as InstanceType<typeof Client>)

    await verifyCommand(mockConfig)

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('[ok] Config file'))).toBe(true)
    expect(calls.some(c => c.includes('[ok] Whisper binary'))).toBe(true)
    expect(calls.some(c => c.includes('[ok] AI provider'))).toBe(true)
    expect(calls.some(c => c.includes('[ok] Notion access'))).toBe(true)
    expect(calls.some(c => c.includes('All checks passed'))).toBe(true)
  })

  it('exits 1 on config error and skips remaining checks', async () => {
    vi.mocked(loadConfig).mockImplementation(() => { throw new Error('Config error: missing field') })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(verifyCommand(mockConfig)).rejects.toThrow('exit')

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('[err] Config file'))).toBe(true)
    expect(calls.some(c => c.includes('Fix config errors first'))).toBe(true)
    // Should NOT have checked whisper, AI, or Notion
    expect(calls.some(c => c.includes('Whisper'))).toBe(false)
    exitSpy.mockRestore()
  })

  it('shows FAIL for whisper binary but continues all checks', async () => {
    vi.mocked(loadConfig).mockReturnValue(mockConfig)
    vi.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
    vi.mocked(createProviderModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockResolvedValue({} as never)
    vi.mocked(Client).mockImplementation(() => ({
      databases: { retrieve: vi.fn().mockResolvedValue({}) },
    }) as unknown as InstanceType<typeof Client>)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(verifyCommand(mockConfig)).rejects.toThrow('exit')

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('[err] Whisper binary'))).toBe(true)
    // Other checks still ran
    expect(calls.some(c => c.includes('AI provider'))).toBe(true)
    expect(calls.some(c => c.includes('Notion access'))).toBe(true)
    exitSpy.mockRestore()
  })

  it('shows FAIL for AI provider on auth error', async () => {
    vi.mocked(loadConfig).mockReturnValue(mockConfig)
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined)
    vi.mocked(createProviderModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockRejectedValue(new Error('Invalid API key'))
    vi.mocked(Client).mockImplementation(() => ({
      databases: { retrieve: vi.fn().mockResolvedValue({}) },
    }) as unknown as InstanceType<typeof Client>)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(verifyCommand(mockConfig)).rejects.toThrow('exit')

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('[err] AI provider'))).toBe(true)
    expect(calls.some(c => c.includes('ai_api_key'))).toBe(true)
    exitSpy.mockRestore()
  })

  it('shows FAIL for Notion on auth error', async () => {
    vi.mocked(loadConfig).mockReturnValue(mockConfig)
    vi.spyOn(fs, 'accessSync').mockReturnValue(undefined)
    vi.mocked(createProviderModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockResolvedValue({} as never)
    vi.mocked(Client).mockImplementation(() => ({
      databases: { retrieve: vi.fn().mockRejectedValue(new Error('Unauthorized')) },
    }) as unknown as InstanceType<typeof Client>)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(verifyCommand(mockConfig)).rejects.toThrow('exit')

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls.some(c => c.includes('[err] Notion access'))).toBe(true)
    exitSpy.mockRestore()
  })

  it('runs all checks even when multiple fail (no short-circuit)', async () => {
    vi.mocked(loadConfig).mockReturnValue(mockConfig)
    vi.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
    vi.mocked(createProviderModel).mockReturnValue({} as never)
    vi.mocked(generateText).mockRejectedValue(new Error('Invalid key'))
    vi.mocked(Client).mockImplementation(() => ({
      databases: { retrieve: vi.fn().mockRejectedValue(new Error('Unauthorized')) },
    }) as unknown as InstanceType<typeof Client>)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(verifyCommand(mockConfig)).rejects.toThrow('exit')

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    // All checks ran
    expect(calls.filter(c => c.includes('[err]')).length).toBeGreaterThanOrEqual(3)
    expect(calls.filter(c => c.includes('[ok]')).length).toBeGreaterThanOrEqual(1) // config passed
    exitSpy.mockRestore()
  })
})
