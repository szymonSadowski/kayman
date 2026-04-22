#!/usr/bin/env node
import { Command } from 'commander'
import { loadConfig, error, printBanner } from '@kayman/shared'
import type { Config } from '@kayman/shared'
import { startCommand } from './commands/start'
import { stopCommand } from './commands/stop'
import { lastCommand } from './commands/last'
import { memoCommand } from './commands/memo'
import { statusCommand } from './commands/status'
import { completionCommand } from './completion/completion'
import { listCommand } from './commands/list'
import { retryCommand } from './commands/retry'
import { verifyCommand } from './commands/verify'
import { helpCommand } from './commands/help'
import { modelsCommand } from './commands/models'
import { configCommand } from './commands/config-command'
import { offlineCommand } from './commands/offline'
import { onlineCommand } from './commands/online'

const program = new Command()
  .name('kayman')
  .description('Meeting recording and AI summary tool')
  .version('0.0.1')
  .addHelpCommand(false)
  .helpOption(false)

program.option('-h, --help', 'Show help')

const argv = process.argv.slice(2)
if (!argv.includes('--help') && !argv.includes('-h') && !argv.includes('--version')) {
  printBanner()
}

let config: Config

// Validate config before every command (skip for commands that work without config)
program.hook('preAction', (_thisCommand, actionCommand) => {
  if (actionCommand === program || ['completion', 'verify', 'help', 'config', 'offline', 'online'].includes(actionCommand.name())) return
  try {
    config = loadConfig()
  } catch (err) {
    process.stderr.write(error((err as Error).message) + '\n')
    process.exit(1)
  }
})

program
  .command('start [project]')
  .description('Start a recording session')
  .option('--tags <tags...>', 'Tags for the recording session')
  .option('--skip-checks', 'Skip pre-flight dependency checks')
  .action(async (project: string | undefined, opts: { tags?: string[]; skipChecks?: boolean }) => {
    await startCommand(project, config, opts.tags ?? [], opts.skipChecks ?? false)
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
  .option('--skip-checks', 'Skip pre-flight dependency checks')
  .action(async (opts: { skipChecks?: boolean }) => {
    await memoCommand(config, opts.skipChecks ?? false)
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

program
  .command('help [command]')
  .description('Show command help')
  .action(async (cmd?: string) => {
    await helpCommand(cmd)
  })

program
  .command('config [subcommand] [args...]')
  .description('View and edit kayman configuration')
  .action(async (subcommand?: string, args?: string[]) => {
    const all = [subcommand, ...(args ?? [])].filter((x): x is string => x !== undefined)
    await configCommand(all)
  })

program
  .command('models [subcommand] [model]')
  .description('Manage local whisper models (list, download, remove)')
  .action(async (subcommand?: string, model?: string) => {
    const args = [subcommand, model].filter((x): x is string => x !== undefined)
    await modelsCommand(args, config)
  })

program
  .command('offline')
  .description('Switch to offline mode (local AI)')
  .option('--model <name>', 'Local model to use (default: llama3.2)')
  .action(async (opts: { model?: string }) => {
    await offlineCommand(opts)
  })

program
  .command('online')
  .description('Switch back to online mode (cloud AI)')
  .action(async () => {
    await onlineCommand()
  })

program.action(async () => {
  await helpCommand()
})

program.parse()
