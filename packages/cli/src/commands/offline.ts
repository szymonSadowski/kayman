import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadConfig } from '@kayman/shared'
import { setConfigValues, CONFIG_PATH } from './config-writer.js'

const SNAPSHOT_PATH = path.join(os.homedir(), '.config', 'kayman', '.online-config')

function readRawFields(): { provider: string; model: string; apiKey: string } {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    const get = (key: string) => raw.match(new RegExp(`^${key}:\\s*(.+)`, 'm'))?.[1]?.trim() ?? ''
    return { provider: get('ai_provider'), model: get('ai_model'), apiKey: get('ai_api_key') }
  } catch {
    return { provider: '', model: '', apiKey: '' }
  }
}

export async function offlineCommand(opts: { model?: string }): Promise<void> {
  let currentProvider: string
  let currentModel: string
  let currentApiKey: string

  try {
    const config = loadConfig()
    currentProvider = config.aiProvider
    currentModel = config.aiModel
    currentApiKey = config.aiApiKey ?? ''
  } catch {
    const fields = readRawFields()
    currentProvider = fields.provider
    currentModel = fields.model
    currentApiKey = fields.apiKey
  }

  if (currentProvider === 'ollama') {
    process.stdout.write(`Already in offline mode (provider: ollama, model: ${currentModel}).\n`)
    process.exit(0)
  }

  // Save cloud settings snapshot
  const snapshot = {
    ai_provider: currentProvider,
    ai_model: currentModel,
    ai_api_key: currentApiKey,
  }
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true })
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8')

  const model = opts.model ?? 'llama3.2'
  setConfigValues({ ai_provider: 'ollama', ai_model: model, ai_api_key: '' })

  process.stdout.write(
    `Switched to offline mode (provider: ollama, model: ${model}). Your API settings are saved — run kayman online to restore.\n`,
  )
}
