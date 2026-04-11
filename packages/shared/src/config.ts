import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { CONFIG_DIR } from './paths'
import type { Config } from './types'

const REQUIRED_FIELDS = [
  'user_name',
  'ai_provider',
  'ai_model',
  'ai_api_key',
  'notion_token',
  'notion_database_id',
] as const

export function loadConfig(configPath = path.join(CONFIG_DIR, 'config.yaml')): Config {
  let raw: string
  try {
    raw = fs.readFileSync(configPath, 'utf8')
  } catch {
    throw new Error(`Config error: config file not found at ${configPath}`)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = yaml.load(raw) as Record<string, unknown>
  } catch {
    throw new Error('Config error: malformed YAML in config file')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Config error: config file is empty or invalid')
  }

  for (const field of REQUIRED_FIELDS) {
    if (!parsed[field]) {
      throw new Error(`Config error: ${field} is required`)
    }
  }

  const SUPPORTED_AI_PROVIDERS = ['openai', 'anthropic', 'google']
  if (!SUPPORTED_AI_PROVIDERS.includes(parsed.ai_provider as string)) {
    throw new Error(
      `Config error: ai_provider "${parsed.ai_provider}" is not supported. Supported values: ${SUPPORTED_AI_PROVIDERS.join(', ')}.`,
    )
  }

  const VALID_AUDIO_SOURCES: Config['audioSource'][] = [
    'system_and_mic',
    'mic_only',
    'system_only',
  ]
  const audioSource = (parsed.audio_source as Config['audioSource']) ?? 'system_and_mic'
  if (!VALID_AUDIO_SOURCES.includes(audioSource)) {
    throw new Error(
      `Config error: audio_source must be one of ${VALID_AUDIO_SOURCES.join(', ')}`,
    )
  }

  return {
    userName: parsed.user_name as string,
    aiProvider: parsed.ai_provider as string,
    aiModel: parsed.ai_model as string,
    aiApiKey: parsed.ai_api_key as string,
    notionToken: parsed.notion_token as string,
    notionDatabaseId: parsed.notion_database_id as string,
    projects: (
      (parsed.projects as Array<{ name: string; notion_page_id: string; prompt_template?: unknown }>) ?? []
    ).map((p) => {
      if (p.prompt_template !== undefined && typeof p.prompt_template !== 'string') {
        throw new Error('Config error: prompt_template must be a string')
      }
      return {
        name: p.name,
        notionPageId: p.notion_page_id,
        promptTemplate: p.prompt_template,
      }
    }),
    audioSource,
    whisperBinaryPath: parsed.whisper_binary_path as string | undefined,
    whisperModelPath: parsed.whisper_model_path as string | undefined,
  }
}
