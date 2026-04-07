import fs from 'fs'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { Client } from '@notionhq/client'
import { generateText } from 'ai'
import { createProviderModel } from '../pipeline/provider'

interface CheckResult {
  name: string
  pass: boolean
  message: string
}

async function checkConfig(): Promise<{ result: CheckResult; config: Config | null }> {
  try {
    const config = loadConfig()
    return { result: { name: 'Config file', pass: true, message: 'Config loaded successfully' }, config }
  } catch (err) {
    return { result: { name: 'Config file', pass: false, message: (err as Error).message }, config: null }
  }
}

function checkWhisperBinary(config: Config): CheckResult {
  const binaryPath = config.whisperBinaryPath ?? '/usr/local/bin/whisper'
  try {
    fs.accessSync(binaryPath, fs.constants.X_OK)
    return { name: 'Whisper binary', pass: true, message: `Found at ${binaryPath}` }
  } catch {
    return { name: 'Whisper binary', pass: false, message: `Not found or not executable at ${binaryPath}. Install whisper.cpp and ensure it is in your PATH.` }
  }
}

function checkWhisperModel(config: Config): CheckResult {
  const modelPath = config.whisperModelPath
  if (!modelPath) {
    return { name: 'Whisper model', pass: true, message: 'Using default model' }
  }
  try {
    fs.accessSync(modelPath, fs.constants.R_OK)
    return { name: 'Whisper model', pass: true, message: `Found at ${modelPath}` }
  } catch {
    return { name: 'Whisper model', pass: false, message: `Model not found at ${modelPath}. Download the model or update whisper_model_path in config.` }
  }
}

async function checkAiProvider(config: Config): Promise<CheckResult> {
  try {
    const model = createProviderModel(config)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      await generateText({
        model,
        prompt: 'Reply with OK',
        maxOutputTokens: 1,
        abortSignal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    return { name: 'AI provider', pass: true, message: `${config.aiProvider} (${config.aiModel}) credentials valid` }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { name: 'AI provider', pass: false, message: `AI provider check timed out — check network connectivity` }
    }
    return { name: 'AI provider', pass: false, message: `AI provider authentication failed. Check ai_api_key in config.yaml.` }
  }
}

async function checkNotion(config: Config): Promise<CheckResult> {
  try {
    const notion = new Client({ auth: config.notionToken })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      await notion.databases.retrieve({ database_id: config.notionDatabaseId })
    } finally {
      clearTimeout(timeout)
    }
    return { name: 'Notion access', pass: true, message: 'Database accessible' }
  } catch (err) {
    const msg = (err as Error).message
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND')) {
      return { name: 'Notion access', pass: false, message: 'Notion check failed — check network connectivity' }
    }
    return { name: 'Notion access', pass: false, message: 'Notion access failed. Check notion_token and notion_database_id in config.yaml.' }
  }
}

function printResult(r: CheckResult): void {
  const icon = r.pass ? 'PASS' : 'FAIL'
  process.stdout.write(`[${icon}] ${r.name}: ${r.message}\n`)
}

export async function verifyCommand(_config: Config): Promise<void> {
  const results: CheckResult[] = []

  // 1. Config
  const { result: configResult, config } = await checkConfig()
  results.push(configResult)
  printResult(configResult)

  if (!config) {
    process.stdout.write('Fix config errors first, then re-run kayman verify.\n')
    process.exit(1)
  }

  // 2. Whisper binary
  const whisperResult = checkWhisperBinary(config)
  results.push(whisperResult)
  printResult(whisperResult)

  // 3. Whisper model
  const modelResult = checkWhisperModel(config)
  results.push(modelResult)
  printResult(modelResult)

  // 4. AI provider
  const aiResult = await checkAiProvider(config)
  results.push(aiResult)
  printResult(aiResult)

  // 5. Notion
  const notionResult = await checkNotion(config)
  results.push(notionResult)
  printResult(notionResult)

  const allPassed = results.every((r) => r.pass)
  if (allPassed) {
    process.stdout.write('All checks passed. kayman is ready to use.\n')
  } else {
    process.exit(1)
  }
}
