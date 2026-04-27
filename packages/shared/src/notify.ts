import notifier from 'node-notifier'
import path from 'path'
import fs from 'fs'
import { PipelineStage } from './types'

const STAGE_MESSAGES: Record<PipelineStage, string> = {
  [PipelineStage.Recording]: 'Recording started',
  [PipelineStage.Transcribing]: 'Transcribing...',
  [PipelineStage.Summarizing]: 'Summarizing...',
  [PipelineStage.Exporting]: 'Exporting to Notion...',
  [PipelineStage.Done]: 'Done — entry created in Notion',
}

function iconField(): { contentImage: string } | Record<string, never> {
  try {
    const iconPath = path.resolve(__dirname, '../assets/kayman.png')
    return fs.existsSync(iconPath) ? { contentImage: iconPath } : {}
  } catch {
    return {}
  }
}

export function notify(stage: PipelineStage): void {
  notifier.notify({
    title: 'kayman',
    message: STAGE_MESSAGES[stage],
    ...iconField(),
  })
}

export function notifyCustom(message: string): void {
  notifier.notify({ title: 'kayman', message, ...iconField() })
}

export function notifyError(
  stage: PipelineStage,
  err: Error,
  transcriptPath?: string,
): void {
  const detail = transcriptPath
    ? `${stage} failed: ${err.message}. Transcript saved to ${transcriptPath}.`
    : `${stage} failed: ${err.message}`
  notifier.notify({
    title: 'kayman',
    message: detail,
    ...iconField(),
  })
}
