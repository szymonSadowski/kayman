import fs from 'fs'
import path from 'path'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { applySpotlight, PipelineError, PipelineStage } from '@kayman/shared'
import { createProviderModel } from './provider'
import type { Config, Summary } from '@kayman/shared'

const summarySchema = z.object({
  title: z.string(),
  tldr: z.string(),
  keyPoints: z.array(z.string()),
  fullSummary: z.string(),
})

function buildPrompt(transcript: string): string {
  return `You are a meeting summarizer. Analyze the following transcript and return a structured summary with: a concise title (5-10 words), a one-paragraph tldr, an array of key points, and a detailed multi-paragraph fullSummary.

Transcript:
${transcript}`
}

export async function runSummarize(input: {
  transcriptPath: string
  project: string | null
  recordingDir: string
  config: Config
}): Promise<Summary> {
  const { transcriptPath, project, recordingDir, config } = input

  const transcript = fs.readFileSync(transcriptPath, 'utf8')

  const model = createProviderModel(config)

  let parsed: z.infer<typeof summarySchema>
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: summarySchema }),
      prompt: buildPrompt(transcript),
    })
    parsed = result.output
  } catch (err) {
    throw new PipelineError(PipelineStage.Summarizing, (err as Error).message)
  }

  const keyPoints = applySpotlight(parsed.keyPoints, config.userName)

  const summary: Summary = {
    title: parsed.title,
    tldr: parsed.tldr,
    keyPoints,
    fullSummary: parsed.fullSummary,
    project,
    recordedAt: new Date().toISOString(),
    transcriptPath,
  }

  const summaryPath = path.join(recordingDir, 'summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')

  return summary
}
