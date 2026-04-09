#!/usr/bin/env node
import { Command } from 'commander'
import { loadConfig } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { startCommand } from './commands/start'
import { stopCommand } from './commands/stop'
import { lastCommand } from './commands/last'
import { memoCommand } from './commands/memo'
import { statusCommand } from './commands/status'
import { completionCommand } from './completion/completion'

const program = new Command()
  .name('kayman')
  .description('Meeting recording and AI summary tool')
  .version('0.0.1')

let config: Config

// Validate config before every command (skip for commands that work without config)
program.hook('preAction', (_thisCommand, actionCommand) => {
  if (actionCommand.name() === 'completion') return
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
  .action(async (project?: string) => {
    await startCommand(project, config)
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
  .command('completion [action] [shell]')
  .description('Shell completion helpers (run "kayman completion install" for setup)')
  .action(async (action: string | undefined, shell: string | undefined) => {
    await completionCommand([action, shell].filter((x): x is string => Boolean(x)))
  })

program.parse()
