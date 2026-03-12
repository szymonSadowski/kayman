import notifier from 'node-notifier'
import { PipelineStage } from './types'

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
  })
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
  })
}
