import fs from 'fs'
import path from 'path'
import os from 'os'
import { loadConfig } from '@kayman/shared'
import { setConfigValues, CONFIG_PATH } from './config-writer.js'

const SNAPSHOT_PATH = path.join(os.homedir(), '.config', 'kayman', '.online-config')

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  google: 'gemini-2.0-flash',
}

function readRawProvider(): string {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    return raw.match(/^ai_provider:\s*(\S+)/m)?.[1] ?? ''
  } catch {
    return ''
  }
}

async function runInteractiveSetup(): Promise<{ provider: string; model: string; apiKey: string }> {
  const { default: select } = await import('@inquirer/select')
  const { default: input } = await import('@inquirer/input')

  const provider = await select({
    message: 'Select AI provider:',
    choices: ['openai', 'anthropic', 'google'].map((v) => ({ name: v, value: v })),
  })
  const model = await input({ message: 'Model name:', default: DEFAULT_MODELS[provider] })
  const apiKey = await input({ message: `${provider} API key:` })
  return { provider, model, apiKey }
}

async function applyInteractiveSetup(): Promise<void> {
  const { provider, model, apiKey } = await runInteractiveSetup()
  const snapshot = { ai_provider: provider, ai_model: model, ai_api_key: apiKey }
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true })
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8')
  setConfigValues({ ai_provider: provider, ai_model: model, ai_api_key: apiKey })
  process.stdout.write(`Switched to online mode (provider: ${provider}, model: ${model}).\n`)
}

export async function onlineCommand(): Promise<void> {
  let currentProvider: string
  try {
    const config = loadConfig()
    currentProvider = config.aiProvider
  } catch {
    currentProvider = readRawProvider()
  }

  if (currentProvider !== 'ollama') {
    process.stdout.write(`Already in online mode (provider: ${currentProvider}).\n`)
    process.exit(0)
  }

  if (fs.existsSync(SNAPSHOT_PATH)) {
    let snapshot: { ai_provider: string; ai_model: string; ai_api_key: string }
    try {
      const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const provider = typeof parsed.ai_provider === 'string' && parsed.ai_provider ? parsed.ai_provider : ''
      const model = typeof parsed.ai_model === 'string' && parsed.ai_model ? parsed.ai_model : ''
      const apiKey = typeof parsed.ai_api_key === 'string' ? parsed.ai_api_key : ''
      if (!provider || !model) throw new Error('snapshot missing required fields')
      snapshot = { ai_provider: provider, ai_model: model, ai_api_key: apiKey }
    } catch (err) {
      process.stderr.write(
        `Warning: .online-config snapshot is invalid (${(err as Error).message}). Running interactive setup.\n`,
      )
      await applyInteractiveSetup()
      return
    }
    setConfigValues({ ai_provider: snapshot.ai_provider, ai_model: snapshot.ai_model, ai_api_key: snapshot.ai_api_key })
    process.stdout.write(`Switched to online mode (provider: ${snapshot.ai_provider}, model: ${snapshot.ai_model}).\n`)
    return
  }

  // No snapshot — interactive setup
  await applyInteractiveSetup()
}
