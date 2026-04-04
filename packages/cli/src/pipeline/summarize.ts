import fs from 'fs'
import path from 'path'
import { generateText } from 'ai'
import { applySpotlight, PipelineError, PipelineStage } from '@kayman/shared'
import { createProviderModel } from './provider'
import type { Config, Summary } from '@kayman/shared'

function buildPrompt(transcript: string): string {
  return `You are a meeting summarizer. Analyze the following transcript and return a JSON object with these exact fields:
{
  "title": "A concise meeting title (5-10 words)",
  "tldr": "A one-paragraph summary of the meeting",
  "keyPoints": ["Key point 1", "Key point 2", "..."],
  "fullSummary": "A detailed multi-paragraph summary"
}

Return only valid JSON, no other text.

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

  let text: string
  try {
    const result = await generateText({ model, prompt: buildPrompt(transcript) })
    text = result.text
  } catch (err) {
    throw new PipelineError(PipelineStage.Summarizing, (err as Error).message)
  }

  let parsed: { title: string; tldr: string; keyPoints: string[]; fullSummary: string }
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    parsed = JSON.parse(cleaned) as typeof parsed
  } catch {
    throw new PipelineError(PipelineStage.Summarizing, `AI returned invalid JSON response. Raw: ${text.slice(0, 300)}`)
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
