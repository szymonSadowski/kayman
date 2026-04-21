// Pipeline runner — detached process entry point
// Spawned by kayman stop: node runner.js <audioPath> <project|""> <transcriptSaveDir>
import fs from 'fs'
import path from 'path'
import {
  loadConfig,
  notify,
  notifyError,
  PipelineError,
  PipelineStage,
  LAST_SUMMARY_PATH,
} from '@kayman/shared'
import { runTranscribe } from './transcribe'
import { runSummarize } from './summarize'
import { runExport } from './export'

function isNetworkError(err: Error): boolean {
  const msg = err.message ?? ''
  const cause = ((err as { cause?: Error }).cause?.message) ?? ''
  return ['ENOTFOUND', 'ECONNREFUSED', 'fetch failed'].some(
    (token) => msg.includes(token) || cause.includes(token),
  )
}

const [,, audioPath, projectArg, transcriptSaveDir, tagsArg] = process.argv
const project = projectArg === '' ? null : projectArg
const tags = tagsArg ? tagsArg.split(',') : []

async function run(): Promise<void> {
  const config = loadConfig()

  let transcriptPath: string | undefined

  try {
    notify(PipelineStage.Transcribing)
    transcriptPath = await runTranscribe({ audioPath, transcriptDir: transcriptSaveDir, config })

    notify(PipelineStage.Summarizing)
    const summary = await runSummarize({
      transcriptPath,
      project,
      recordingDir: transcriptSaveDir,
      config,
      isMemo: project === null || tags.includes('memo'),
    })

    const summaryPath = path.join(transcriptSaveDir, 'summary.json')

    notify(PipelineStage.Exporting)
    let exportFailed = false
    try {
      await runExport({ summary, config, tags })
    } catch (exportErr) {
      if (config.aiProvider === 'ollama' && isNetworkError(exportErr as Error)) {
        exportFailed = true
        notifyError(PipelineStage.Exporting, new Error('Export failed: no network. Run kayman retry when back online.'), transcriptPath)
      } else {
        throw exportErr
      }
    }

    if (!exportFailed) {
      // Write .exported marker
      fs.writeFileSync(path.join(transcriptSaveDir, '.exported'), '', 'utf8')
      notify(PipelineStage.Done)
    }

    // Write last-summary pointer (always — so kayman last works offline)
    fs.mkdirSync(path.dirname(LAST_SUMMARY_PATH), { recursive: true })
    fs.writeFileSync(LAST_SUMMARY_PATH, JSON.stringify({ summaryPath }), 'utf8')

    if (exportFailed) {
      // Cleanup audio + transcript even on offline export failure
      try { fs.unlinkSync(audioPath) } catch { /* ignore */ }
      try { fs.unlinkSync(transcriptPath) } catch { /* ignore */ }
      process.exit(0)
    }

    // Cleanup on success
    try { fs.unlinkSync(audioPath) } catch { /* ignore */ }
    try { fs.unlinkSync(transcriptPath) } catch { /* ignore */ }
  } catch (err) {
    if (err instanceof PipelineError) {
      notifyError(err.stage, err, transcriptPath)
    } else {
      notifyError(PipelineStage.Transcribing, err as Error, transcriptPath)
    }
    process.exit(1)
  }
}

run().catch((err: Error) => {
  process.stderr.write(`Pipeline runner fatal error: ${err.message}\n`)
  process.exit(1)
})
