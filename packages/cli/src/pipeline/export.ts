import { Client } from '@notionhq/client'
import { PipelineError, PipelineStage } from '@kayman/shared'
import type { Config, Summary } from '@kayman/shared'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createPage(notion: Client, config: Config, summary: Summary): Promise<string> {
  const matchedProject = summary.project
    ? config.projects.find((p) => p.name === summary.project)
    : undefined

  const response = await notion.pages.create({
    parent: { database_id: config.notionDatabaseId },
    properties: {
      Name: {
        title: [{ text: { content: summary.title } }],
      },
      Date: {
        date: { start: summary.recordedAt },
      },
      ...(matchedProject && {
        Project: { relation: [{ id: matchedProject.notionPageId }] },
      }),
    },
    children: [
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: { rich_text: [{ text: { content: 'TL;DR' } }] },
      },
      {
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: { rich_text: [{ text: { content: summary.tldr } }] },
      },
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: { rich_text: [{ text: { content: 'Key Points' } }] },
      },
      ...summary.keyPoints.map((point) => ({
        object: 'block' as const,
        type: 'bulleted_list_item' as const,
        bulleted_list_item: { rich_text: [{ text: { content: point } }] },
      })),
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: { rich_text: [{ text: { content: 'Full Summary' } }] },
      },
      {
        object: 'block' as const,
        type: 'paragraph' as const,
        paragraph: { rich_text: [{ text: { content: summary.fullSummary } }] },
      },
    ],
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
