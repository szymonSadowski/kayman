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
  const wordCount = transcript.split(/\s+/).length
  const shortTranscript = wordCount < 300

  return `You are an expert summarizer for recorded audio: meetings, conversations, podcasts, lectures, or any spoken content.

Analyze the transcript below and return a structured JSON summary with:
- title: concise descriptive title (5-10 words) reflecting the actual topic discussed
- tldr: one-paragraph summary capturing the core message and takeaways
- keyPoints: array of specific, actionable or informative points discussed (not meta-commentary about recording quality)
- fullSummary: detailed multi-paragraph summary of everything discussed

Rules:
- Focus on SUBSTANCE. Extract every piece of information, opinion, recommendation, or fact mentioned.
- Never describe the transcript itself (e.g. "incomplete recording", "fragmentary dialogue"). Summarize what WAS said.
- If the transcript is short, still extract all available information rather than commenting on brevity.
${shortTranscript ? '- The transcript is short so every sentence matters. Include ALL information mentioned.\n' : ''}
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

  const wordCount = transcript.split(/\s+/).length
  const fullSummary = wordCount < 300
    ? `${parsed.fullSummary}\n\n---\n\n**Full Transcript:**\n${transcript}`
    : parsed.fullSummary

  const summary: Summary = {
    title: parsed.title,
    tldr: parsed.tldr,
    keyPoints,
    fullSummary,
    project,
    recordedAt: new Date().toISOString(),
    transcriptPath,
  }

  const summaryPath = path.join(recordingDir, 'summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')

  return summary
}
