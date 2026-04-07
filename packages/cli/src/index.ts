#!/usr/bin/env node
import { Command } from 'commander'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { startCommand } from './commands/start'
import { stopCommand } from './commands/stop'
import { lastCommand } from './commands/last'
import { memoCommand } from './commands/memo'
import { statusCommand } from './commands/status'
import { listCommand } from './commands/list'
import { retryCommand } from './commands/retry'
import { verifyCommand } from './commands/verify'

const program = new Command()
  .name('kayman')
  .description('Meeting recording and AI summary tool')
  .version('0.0.1')

let config: Config

// Validate config before every command (except verify which handles its own config)
program.hook('preAction', (_thisCommand, actionCommand) => {
  if (actionCommand.name() === 'verify') return
  try {
    config = loadConfig()
  } catch (err) {
    process.stderr.write((err as Error).message + '\n')
    process.exit(1)
  }
})

program
  .command('start [project]')
  .description('Start a recording session')
  .option('--tags <tags...>', 'Tags for the recording session')
  .action(async (project: string | undefined, opts: { tags?: string[] }) => {
    await startCommand(project, config, opts.tags ?? [])
  })

program
  .command('stop')
  .description('Stop the active recording session')
  .action(async () => {
    await stopCommand(config)
  })

program
  .command('last')
  .description('Show the most recent meeting summary TL;DR')
  .action(async () => {
    await lastCommand(config)
  })

program
  .command('memo')
  .description('Start a memo recording (no project picker)')
  .action(async () => {
    await memoCommand(config)
  })

program
  .command('status')
  .description('Check whether a recording is active')
  .action(async () => {
    await statusCommand(config)
  })

program
  .command('list')
  .description('List past meeting recordings')
  .option('--project <name>', 'Filter by project name')
  .option('--from <date>', 'Show recordings from this date (YYYY-MM-DD)')
  .option('--to <date>', 'Show recordings up to this date (YYYY-MM-DD)')
  .option('--tag <tag...>', 'Filter by tag (AND logic)')
  .action(async (opts: { project?: string; from?: string; to?: string; tag?: string[] }) => {
    await listCommand(config, opts)
  })

program
  .command('retry')
  .description('Re-export failed Notion exports')
  .option('--path <dir>', 'Retry export for a specific recording directory')
  .option('--all', 'Retry all failed exports')
  .action(async (opts: { path?: string; all?: boolean }) => {
    await retryCommand(config, opts)
  })

program
  .command('verify')
  .description('Validate kayman setup and dependencies')
  .action(async () => {
    await verifyCommand(config)
  })

program.parse()
