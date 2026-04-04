import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

const DEFAULT_WHISPER_BINARY = '/usr/local/bin/whisper'
const DEFAULT_WHISPER_MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper')
const DEFAULT_WHISPER_MODEL_NAME = 'base.en'

export async function runTranscribe(input: {
  audioPath: string
  transcriptDir: string
  config: Config
}): Promise<string> {
  const { audioPath, transcriptDir, config } = input

  const binaryPath = config.whisperBinaryPath ?? DEFAULT_WHISPER_BINARY

  if (!fs.existsSync(binaryPath)) {
    throw new PipelineError(PipelineStage.Transcribing, `whisper binary not found at ${binaryPath}`)
  }

  // whisperModelPath may be a model name (e.g. "base.en") or a full path to a .pt/.bin file
  const modelPathOrName = config.whisperModelPath ?? DEFAULT_WHISPER_MODEL_NAME
  const isFilePath = modelPathOrName.includes(path.sep) || modelPathOrName.endsWith('.bin') || modelPathOrName.endsWith('.pt')

  let modelArgs: string[]
  if (isFilePath) {
    if (!fs.existsSync(modelPathOrName)) {
      throw new PipelineError(PipelineStage.Transcribing, `whisper model not found at ${modelPathOrName}`)
    }
    modelArgs = ['--model', path.basename(modelPathOrName).replace(/\.(pt|bin)$/, ''), '--model_dir', path.dirname(modelPathOrName)]
  } else {
    modelArgs = ['--model', modelPathOrName, '--model_dir', DEFAULT_WHISPER_MODEL_DIR]
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      binaryPath,
      [...modelArgs, '--output_format', 'txt', '--output_dir', transcriptDir, audioPath],
      { stdio: 'pipe' },
    )

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new PipelineError(PipelineStage.Transcribing, `whisper exited with code ${code}`))
      } else {
        resolve()
      }
    })

    child.on('error', (err) => {
      reject(new PipelineError(PipelineStage.Transcribing, err.message))
    })
  })

  // whisper names the output file by stripping the extension from the input file
  const baseName = path.basename(audioPath, path.extname(audioPath))
  return path.join(transcriptDir, `${baseName}.txt`)
}
