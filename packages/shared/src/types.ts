export enum PipelineStage {
  Recording = 'recording',
  Transcribing = 'transcribing',
  Summarizing = 'summarizing',
  Exporting = 'exporting',
  Done = 'done',
}

export class PipelineError extends Error {
  constructor(
    public readonly stage: PipelineStage,
    message: string,
  ) {
    super(`${stage} failed: ${message}`)
    this.name = 'PipelineError'
  }
}

export interface Config {
  userName: string
  aiProvider: string
  aiModel: string
  aiApiKey?: string
  aiBaseUrl?: string
  notionToken: string
  notionDatabaseId: string
  projects: Array<{ name: string; notionPageId: string; promptTemplate?: string }>
  audioSource: 'system_and_mic' | 'mic_only' | 'system_only'
  whisperBinaryPath?: string
  whisperModelPath?: string
}

export interface Session {
  pid: number
  audioPath: string
  project: string | null
  startedAt: string
  tags: string[]
}

export interface Summary {
  title: string
  tldr: string
  keyPoints: string[]
  fullSummary: string
  project: string | null
  recordedAt: string
  transcriptPath: string
  cost?: number
}
