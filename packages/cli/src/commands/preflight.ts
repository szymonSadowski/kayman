import fs from 'fs'
import { Client, RequestTimeoutError } from '@notionhq/client'
import { generateText } from 'ai'
import { warn, error } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { createProviderModel } from '../pipeline/provider.js'

export async function runPreflightChecks(config: Config): Promise<void> {
  // 1. Whisper binary (sync filesystem check)
  const binaryPath = config.whisperBinaryPath ?? '/usr/local/bin/whisper'
  try {
    fs.accessSync(binaryPath, fs.constants.X_OK)
  } catch {
    process.stderr.write(error(`Whisper binary not found or not executable at ${binaryPath}. Install whisper.cpp.`) + '\n')
    process.exit(1)
  }

  // 2. Whisper model (sync, only if explicit path configured)
  if (config.whisperModelPath) {
    try {
      fs.accessSync(config.whisperModelPath, fs.constants.R_OK)
    } catch {
      process.stderr.write(error(`Whisper model not found at ${config.whisperModelPath}. Download the model or update whisper_model_path in config.yaml.`) + '\n')
      process.exit(1)
    }
  }

  // 3. AI provider (async, 5s timeout)
  try {
    const model = createProviderModel(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      await generateText({ model, prompt: 'Reply with OK', maxOutputTokens: 1, abortSignal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    const e = err as Error
    if (e.name === 'AbortError' || e.message.toLowerCase().includes('timeout') || e.message.includes('ENOTFOUND')) {
      process.stdout.write(warn('AI provider check timed out — proceeding anyway.') + '\n')
    } else {
      process.stderr.write(error('AI provider authentication failed. Check ai_api_key in config.yaml.') + '\n')
      process.exit(1)
    }
  }

  // 4. Notion (async, 5s timeout via client timeoutMs)
  try {
    const notion = new Client({ auth: config.notionToken, timeoutMs: 5000 })
    await notion.databases.retrieve({ database_id: config.notionDatabaseId })
  } catch (err) {
    if (RequestTimeoutError.isRequestTimeoutError(err) || (err as Error).message.includes('ENOTFOUND')) {
      process.stdout.write(warn('Notion check timed out — proceeding anyway.') + '\n')
    } else {
      process.stderr.write(error('Notion access failed. Check notion_token and notion_database_id in config.yaml.') + '\n')
      process.exit(1)
    }
  }
}
