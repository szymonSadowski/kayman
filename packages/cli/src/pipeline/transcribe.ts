import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config } from '@kayman/shared'

const DEFAULT_WHISPER_BINARY = '/usr/local/bin/whisper'
const DEFAULT_WHISPER_MODEL = path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.en.bin')

export async function runTranscribe(input: {
  audioPath: string
  transcriptDir: string
  config: Config
}): Promise<string> {
  const { audioPath, transcriptDir, config } = input

  const binaryPath = config.whisperBinaryPath ?? DEFAULT_WHISPER_BINARY
  const modelPath = config.whisperModelPath ?? DEFAULT_WHISPER_MODEL

  if (!fs.existsSync(binaryPath)) {
    throw new PipelineError(PipelineStage.Transcribing, `whisper binary not found at ${binaryPath}`)
  }

  if (!fs.existsSync(modelPath)) {
    throw new PipelineError(PipelineStage.Transcribing, `whisper model not found at ${modelPath}`)
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      binaryPath,
      ['--model', modelPath, '--output-txt', '--output-dir', transcriptDir, audioPath],
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
