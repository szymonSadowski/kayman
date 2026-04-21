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

const MEMO_PROMPT = `You are a personal note-taking assistant processing a voice memo — a single person thinking out loud.

Analyze the transcript below and return a structured JSON summary with:
- title: concise title describing the main topic (5-10 words)
- tldr: one-paragraph summary of the core idea or decision
- keyPoints: specific points, facts, ideas, or decisions mentioned (actionable where possible)
- fullSummary: complete structured notes including all details, next steps, and open questions

Rules:
- This is a solo recording (one speaker). Avoid meeting language like "participants discussed" or "the team agreed".
- Use first-person friendly language where natural ("decided to", "need to", "the idea is").
- Extract ALL action items and decisions explicitly.
- If the speaker mentions open questions or things to research, list them in fullSummary.
- Focus on substance — do not comment on recording quality or brevity.`

export function buildPrompt(transcript: string, promptTemplate?: string, isMemo = false): string {
  if (promptTemplate && promptTemplate.trim()) {
    return promptTemplate.trim() + '\nTranscript:\n' + transcript
  }

  if (isMemo) {
    return MEMO_PROMPT + '\nTranscript:\n' + transcript
  }

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
  isMemo?: boolean
}): Promise<Summary> {
  const { transcriptPath, project, recordingDir, config, isMemo } = input

  const transcript = fs.readFileSync(transcriptPath, 'utf8')

  if (!transcript.trim()) {
    const summary: Summary = {
      title: 'Empty Recording',
      tldr: 'No speech detected in this recording.',
      keyPoints: [],
      fullSummary: 'No speech was detected in this recording. The audio may have been silent or the microphone was disconnected.',
      project,
      recordedAt: new Date().toISOString(),
      transcriptPath,
    }
    const summaryPath = path.join(recordingDir, 'summary.json')
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
    return summary
  }

  const projectConfig = project ? config.projects.find(p => p.name === project) : undefined
  const promptTemplate = projectConfig?.promptTemplate

  const model = createProviderModel(config)

  let parsed: z.infer<typeof summarySchema>
  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: summarySchema }),
      prompt: buildPrompt(transcript, promptTemplate, isMemo),
    })
    parsed = result.output
  } catch (err) {
    if (config.aiProvider === 'ollama') {
      const msg = (err as Error).message ?? ''
      const cause = ((err as { cause?: Error }).cause?.message) ?? ''
      const baseURL = config.aiBaseUrl ?? 'http://localhost:11434'
      const isConnError = msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET') || cause.includes('ECONNREFUSED') || cause.includes('ECONNRESET')
      if (isConnError) {
        throw new PipelineError(PipelineStage.Summarizing, `Ollama not reachable at ${baseURL}. Start Ollama or switch to an API provider with: kayman online`)
      }
      if (msg.toLowerCase().includes('model') && (msg.toLowerCase().includes('not found') || msg.includes('404'))) {
        throw new PipelineError(PipelineStage.Summarizing, `Model '${config.aiModel}' not found in Ollama. Run: ollama pull ${config.aiModel}`)
      }
    }
    throw new PipelineError(PipelineStage.Summarizing, (err as Error).message)
  }

  const keyPoints = applySpotlight(parsed.keyPoints, config.userName)

  const wordCount = transcript.split(/\s+/).length
  const fullSummary = !promptTemplate && wordCount < 300
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
