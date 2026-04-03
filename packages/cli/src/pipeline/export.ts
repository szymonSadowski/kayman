import { Client } from '@notionhq/client'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createPage(notion: Client, config: Config, summary: Summary): Promise<string> {
  const project = summary.project
    ? config.projects.find((p) => p.name === summary.project)
    : null

  const response = await notion.pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties: {
      Name: {
        title: [{ text: { content: summary.title } }],
      },
      'TL;DR': {
        rich_text: [{ text: { content: summary.tldr } }],
      },
      'Key Points': {
        rich_text: [{ text: { content: summary.keyPoints.join('\n') } }],
      },
      'Full Summary': {
        rich_text: [{ text: { content: summary.fullSummary } }],
      },
      ...(project
        ? { Project: { relation: [{ id: project.notionPageId }] } }
        : {}),
    },
  })

  return response.id
}

export async function runExport(input: { summary: Summary; config: Config }): Promise<string> {
  const { summary, config } = input

  const notion = new Client({ auth: config.notionToken })

  let lastErr: Error | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await createPage(notion, config, summary)
    } catch (err) {
      const status = (err as { status?: number }).status

      if (status === 401) {
        throw new PipelineError(
          PipelineStage.Exporting,
          'Notion auth failed: check notion_token in config',
        )
      }

      if (status === 429 || (status !== undefined && status >= 500)) {
        lastErr = err as Error
        await sleep(Math.min(1000 * Math.pow(2, attempt), 8000))
        continue
      }

      throw new PipelineError(PipelineStage.Exporting, (err as Error).message)
    }
  }

  throw new PipelineError(
    PipelineStage.Exporting,
    `Notion export failed after 3 attempts: ${lastErr?.message}`,
  )
}
