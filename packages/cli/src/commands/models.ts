import fs from 'fs'
import path from 'path'
import os from 'os'
import { bold, dim, success, warn, error } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { setConfigValue } from './config-writer.js'

const WHISPER_MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper')

interface WhisperModel {
  name: string
  filename: string
  sizeMb: number
}

const WHISPER_MODELS: WhisperModel[] = [
  { name: 'tiny',   filename: 'ggml-tiny.bin',   sizeMb: 75 },
  { name: 'base',   filename: 'ggml-base.bin',   sizeMb: 142 },
  { name: 'small',  filename: 'ggml-small.bin',  sizeMb: 466 },
  { name: 'medium', filename: 'ggml-medium.bin', sizeMb: 1500 },
  { name: 'large',  filename: 'ggml-large.bin',  sizeMb: 2900 },
]

function modelDownloadUrl(name: string): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${name}.bin`
}

function modelPath(filename: string): string {
  return path.join(WHISPER_MODEL_DIR, filename)
}

function isDownloaded(filename: string): boolean {
  return fs.existsSync(modelPath(filename))
}

function activeModelName(config: Config): string | null {
  const mp = config.whisperModelPath
  if (!mp) return null
  if (mp.endsWith('.bin')) {
    const base = path.basename(mp)
    return base.replace(/^ggml-/, '').replace(/\.bin$/, '')
  }
  return mp
}

function findModel(name: string): WhisperModel | undefined {
  return WHISPER_MODELS.find((m) => m.name === name)
}

function formatSize(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`
  return `${mb} MB`
}

function handleList(config: Config): void {
  const active = activeModelName(config)
  process.stdout.write(bold('Available whisper models:') + '\n\n')

  const header = '  ' + 'Name'.padEnd(10) + 'Size'.padEnd(10) + 'Downloaded'.padEnd(12) + 'Active'
  process.stdout.write(dim(header) + '\n')

  for (const m of WHISPER_MODELS) {
    const downloaded = isDownloaded(m.filename)
    const isActive = active === m.name
    const name = m.name.padEnd(10)
    const size = formatSize(m.sizeMb).padEnd(10)
    const dl = (downloaded ? 'yes' : 'no').padEnd(12)
    const activeMarker = isActive ? bold('← active') : ''
    const line = `  ${name}${size}${dl}${activeMarker}\n`
    process.stdout.write(isActive ? bold(line) : line)
  }
  process.stdout.write('\n')
}

async function handleDownload(modelName: string, _config: Config): Promise<void> {
  const model = findModel(modelName)
  if (!model) {
    process.stderr.write(error(`Unknown model "${modelName}". Available: ${WHISPER_MODELS.map((m) => m.name).join(', ')}`) + '\n')
    process.exit(1)
  }

  const dest = modelPath(model.filename)
  if (isDownloaded(model.filename)) {
    process.stdout.write(success(`Model "${modelName}" already downloaded at ${dest}.`) + '\n')
    return
  }

  fs.mkdirSync(WHISPER_MODEL_DIR, { recursive: true })

  const url = modelDownloadUrl(modelName)
  const response = await fetch(url)
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download model: HTTP ${response.status}`)
  }

  const total = parseInt(response.headers.get('content-length') ?? '0', 10)
  let downloaded = 0
  const writer = fs.createWriteStream(dest)

  try {
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      writer.write(chunk)
      downloaded += chunk.length
      const pct = total ? Math.floor((downloaded / total) * 100) : 0
      process.stdout.write(`\rDownloading ${modelName}... ${pct}%`)
    }

    await new Promise<void>((resolve, reject) => {
      writer.end((err: Error | null | undefined) => {
        if (err) reject(err)
        else resolve()
      })
    })
  } catch (err) {
    writer.destroy()
    if (fs.existsSync(dest)) fs.unlinkSync(dest)
    throw err
  }

  process.stdout.write('\n')
  process.stdout.write(success(`Downloaded to ${dest}`) + '\n')

  setConfigValue('whisper_model_path', dest)
  process.stdout.write(success(`Updated whisper_model_path in config.`) + '\n')
}

function handleRemove(modelName: string, config: Config): void {
  const model = findModel(modelName)
  if (!model) {
    process.stderr.write(error(`Unknown model "${modelName}". Available: ${WHISPER_MODELS.map((m) => m.name).join(', ')}`) + '\n')
    process.exit(1)
  }

  const dest = modelPath(model.filename)
  if (!isDownloaded(model.filename)) {
    process.stderr.write(error(`Model "${modelName}" is not downloaded.`) + '\n')
    process.exit(1)
  }

  fs.unlinkSync(dest)
  process.stdout.write(success(`Removed model "${modelName}" from ${dest}.`) + '\n')

  const active = activeModelName(config)
  if (active === modelName) {
    process.stdout.write(warn('Warning: active model removed. Run kayman models download <size> to get a new one.') + '\n')
  }
}

export async function modelsCommand(args: string[], config: Config): Promise<void> {
  const [subcommand, modelName] = args

  if (!subcommand || subcommand === 'list') {
    handleList(config)
    return
  }

  if (subcommand === 'download') {
    if (!modelName) {
      process.stderr.write(error('Usage: kayman models download <model>') + '\n')
      process.stderr.write(error(`Available: ${WHISPER_MODELS.map((m) => m.name).join(', ')}`) + '\n')
      process.exit(1)
    }
    await handleDownload(modelName, config)
    return
  }

  if (subcommand === 'remove') {
    if (!modelName) {
      process.stderr.write(error('Usage: kayman models remove <model>') + '\n')
      process.exit(1)
    }
    handleRemove(modelName, config)
    return
  }

  process.stderr.write(error(`Unknown subcommand "${subcommand}". Use: list, download, remove`) + '\n')
  process.exit(1)
}
