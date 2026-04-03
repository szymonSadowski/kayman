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

const [,, audioPath, projectArg, transcriptSaveDir] = process.argv
const project = projectArg === '' ? null : projectArg

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
    })

    notify(PipelineStage.Exporting)
    await runExport({ summary, config })

    notify(PipelineStage.Done)

    // Write last-summary pointer
    fs.mkdirSync(path.dirname(LAST_SUMMARY_PATH), { recursive: true })
    const summaryPath = path.join(transcriptSaveDir, 'summary.json')
    fs.writeFileSync(LAST_SUMMARY_PATH, JSON.stringify({ summaryPath }), 'utf8')

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
