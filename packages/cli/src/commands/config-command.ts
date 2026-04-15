import { loadConfig, error } from '@kayman/shared'
import { CONFIG_PATH, setConfigValue } from './config-writer.js'

type FieldDef =
  | { type: 'string' }
  | { type: 'enum'; values: string[] }

const CONFIG_FIELDS: Record<string, FieldDef> = {
  ai_provider:        { type: 'enum', values: ['openai', 'anthropic', 'google', 'ollama'] },
  ai_model:           { type: 'string' },
  ai_api_key:         { type: 'string' },
  ai_base_url:        { type: 'string' },
  notion_token:       { type: 'string' },
  notion_database_id: { type: 'string' },
  whisper_binary_path:{ type: 'string' },
  whisper_model_path: { type: 'string' },
  audio_source:       { type: 'enum', values: ['system_and_mic', 'mic_only', 'system_only'] },
  user_name:          { type: 'string' },
  projects:           { type: 'string' }, // not settable via config set, handled specially
}

const SENSITIVE_KEYS = new Set(['ai_api_key', 'notion_token'])

function maskValue(value: string): string {
  if (value.length <= 9) return '***'
  return value.slice(0, 3) + '...' + value.slice(-6)
}

// Map camelCase Config fields to snake_case YAML keys
const CAMEL_TO_YAML: Record<string, string> = {
  userName:          'user_name',
  aiProvider:        'ai_provider',
  aiModel:           'ai_model',
  aiApiKey:          'ai_api_key',
  aiBaseUrl:         'ai_base_url',
  notionToken:       'notion_token',
  notionDatabaseId:  'notion_database_id',
  whisperBinaryPath: 'whisper_binary_path',
  whisperModelPath:  'whisper_model_path',
  audioSource:       'audio_source',
  projects:          'projects',
}

export async function configCommand(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args

  if (subcommand === 'path') {
    process.stdout.write(CONFIG_PATH + '\n')
    return
  }

  if (subcommand === 'list') {
    const config = loadConfig()
    for (const [camel, yamlKey] of Object.entries(CAMEL_TO_YAML)) {
      const raw = (config as unknown as Record<string, unknown>)[camel]
      if (raw === undefined) {
        process.stdout.write(`${yamlKey}: (not set)\n`)
        continue
      }
      let display: string
      if (yamlKey === 'projects') {
        display = Array.isArray(raw) ? `[${(raw as { name: string }[]).map((p) => p.name).join(', ')}]` : String(raw)
      } else {
        const strVal = String(raw)
        display = SENSITIVE_KEYS.has(yamlKey) ? maskValue(strVal) : strVal
      }
      process.stdout.write(`${yamlKey}: ${display}\n`)
    }
    return
  }

  if (subcommand === 'get') {
    const [key] = rest
    if (!key || !(key in CONFIG_FIELDS)) {
      process.stderr.write(error(`Unknown config field: ${key}`) + '\n')
      process.exit(1)
    }
    const config = loadConfig()
    // Find camelCase key from yaml key
    const camel = Object.entries(CAMEL_TO_YAML).find(([, v]) => v === key)?.[0]
    if (!camel) {
      process.stderr.write(error(`Unknown config field: ${key}`) + '\n')
      process.exit(1)
    }
    const val = (config as unknown as Record<string, unknown>)[camel]
    process.stdout.write((val !== undefined ? String(val) : '(not set)') + '\n')
    return
  }

  if (subcommand === 'set') {
    const [key, value] = rest
    if (!key || !(key in CONFIG_FIELDS)) {
      process.stderr.write(error(`Unknown config field: ${key}`) + '\n')
      process.exit(1)
    }
    if (key === 'projects') {
      process.stdout.write(
        `"projects" is a complex field. Edit ~/.config/kayman/config.yaml directly to manage projects.\n`,
      )
      return
    }
    if (!value) {
      process.stderr.write(error(`Missing value for ${key}`) + '\n')
      process.exit(1)
    }
    const def = CONFIG_FIELDS[key]
    if (def.type === 'enum' && !def.values.includes(value)) {
      process.stderr.write(
        error(`Invalid value for ${key}. Supported: ${def.values.join(', ')}`) + '\n',
      )
      process.exit(1)
    }
    // Wrap in quotes if value contains spaces; escape inner double quotes
    const yamlValue = /\s/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
    setConfigValue(key, yamlValue)
    process.stdout.write(`${key} set to "${value}"\n`)
    return
  }

  // Unknown or missing subcommand — show usage
  process.stdout.write(
    'Usage: kayman config <list|get <key>|set <key> <value>|path>\n',
  )
}
