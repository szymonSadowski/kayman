import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

vi.mock('@ai-sdk/openai')
vi.mock('@ai-sdk/anthropic')
vi.mock('@ai-sdk/google')

const baseConfig: Config = {
  userName: 'Szymon',
  aiModel: 'test-model',
  aiApiKey: 'test-key',
  notionToken: 'secret_test',
  notionDatabaseId: 'db-123',
  projects: [],
  audioSource: 'system_and_mic',
  aiProvider: 'openai',
}

describe('createProviderModel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls createOpenAI with apiKey and returns model for openai provider', async () => {
    const { createOpenAI } = await import('@ai-sdk/openai')
    const mockModel = 'openai-model-instance'
    const mockClient = vi.fn().mockReturnValue(mockModel)
    vi.mocked(createOpenAI).mockReturnValue(mockClient as unknown as ReturnType<typeof createOpenAI>)

    const { createProviderModel } = await import('./provider')
    const result = createProviderModel({ ...baseConfig, aiProvider: 'openai' })

    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(mockClient).toHaveBeenCalledWith('test-model')
    expect(result).toBe(mockModel)
  })

  it('calls createAnthropic with apiKey and returns model for anthropic provider', async () => {
    const { createAnthropic } = await import('@ai-sdk/anthropic')
    const mockModel = 'anthropic-model-instance'
    const mockClient = vi.fn().mockReturnValue(mockModel)
    vi.mocked(createAnthropic).mockReturnValue(mockClient as unknown as ReturnType<typeof createAnthropic>)

    const { createProviderModel } = await import('./provider')
    const result = createProviderModel({ ...baseConfig, aiProvider: 'anthropic' })

    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(mockClient).toHaveBeenCalledWith('test-model')
    expect(result).toBe(mockModel)
  })

  it('calls createGoogleGenerativeAI with apiKey and returns model for google provider', async () => {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
    const mockModel = 'google-model-instance'
    const mockClient = vi.fn().mockReturnValue(mockModel)
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(mockClient as unknown as ReturnType<typeof createGoogleGenerativeAI>)

    const { createProviderModel } = await import('./provider')
    const result = createProviderModel({ ...baseConfig, aiProvider: 'google' })

    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(mockClient).toHaveBeenCalledWith('test-model')
    expect(result).toBe(mockModel)
  })

  it('throws PipelineError with Summarizing stage for unsupported provider', async () => {
    const { createProviderModel } = await import('./provider')

    expect(() => createProviderModel({ ...baseConfig, aiProvider: 'mistral' })).toThrow(PipelineError)
    expect(() => createProviderModel({ ...baseConfig, aiProvider: 'mistral' })).toThrow('mistral')

    try {
      createProviderModel({ ...baseConfig, aiProvider: 'mistral' })
    } catch (err) {
      expect((err as PipelineError).stage).toBe(PipelineStage.Summarizing)
    }
  })

  it('error message for unsupported provider lists supported providers', async () => {
    const { createProviderModel } = await import('./provider')

    expect(() => createProviderModel({ ...baseConfig, aiProvider: 'mistral' })).toThrow(
      'openai, anthropic, google',
    )
  })
})
