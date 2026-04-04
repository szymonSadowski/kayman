import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'google'] as const

export function createProviderModel(config: Config): LanguageModel {
  const { aiProvider, aiModel, aiApiKey } = config

  switch (aiProvider) {
    case 'openai':
      return createOpenAI({ apiKey: aiApiKey })(aiModel)
    case 'anthropic':
      return createAnthropic({ apiKey: aiApiKey })(aiModel)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: aiApiKey })(aiModel)
    default:
      throw new PipelineError(
        PipelineStage.Summarizing,
        `Unsupported AI provider "${aiProvider}". Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}.`,
      )
  }
}
