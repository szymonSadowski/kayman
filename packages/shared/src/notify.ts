import notifier from 'node-notifier'
import path from 'path'
import fs from 'fs'
import { PipelineStage } from './types'

const ICON_PATH = path.resolve(__dirname, '../assets/kayman.png')
const ICON_EXISTS = fs.existsSync(ICON_PATH)
const iconField = ICON_EXISTS ? { contentImage: ICON_PATH } : {}

const STAGE_MESSAGES: Record<PipelineStage, string> = {
  [PipelineStage.Recording]: 'Recording started',
  [PipelineStage.Transcribing]: 'Transcribing...',
  [PipelineStage.Summarizing]: 'Summarizing...',
  [PipelineStage.Exporting]: 'Exporting to Notion...',
  [PipelineStage.Done]: 'Done — entry created in Notion',
}

export function notify(stage: PipelineStage): void {
  notifier.notify({
    title: 'kayman',
    message: STAGE_MESSAGES[stage],
    ...iconField,
  })
}

export function notifyCustom(message: string): void {
  notifier.notify({ title: 'kayman', message, ...iconField })
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
    ...iconField,
  })
}
