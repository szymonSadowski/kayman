import { bold, dim, warn } from '@kayman/shared'

const COMMAND_GROUPS: Array<{ group: string; commands: Array<{ name: string; desc: string }> }> = [
  {
    group: 'Recording',
    commands: [
      { name: 'start',  desc: 'Start a recording session (project picker or specify name)' },
      { name: 'stop',   desc: 'Stop the active session and process in background' },
      { name: 'status', desc: 'Check whether a recording is active and show duration' },
      { name: 'memo',   desc: 'Start a memo recording (no project picker)' },
    ],
  },
  {
    group: 'Results',
    commands: [
      { name: 'last',  desc: 'Show the most recent meeting summary TL;DR' },
      { name: 'list',  desc: 'List past recordings (filter by project, date, tags)' },
      { name: 'retry', desc: 'Re-export failed Notion exports' },
    ],
  },
  {
    group: 'Setup',
    commands: [
      { name: 'verify',     desc: 'Validate kayman setup and dependencies' },
      { name: 'completion', desc: 'Install shell tab completion for project names' },
      { name: 'config',     desc: 'Manage kayman configuration (coming soon)' },
      { name: 'models',     desc: 'Manage local whisper models (list, download, remove)' },
      { name: 'offline',    desc: 'Switch to offline mode (coming soon)' },
      { name: 'online',     desc: 'Switch back to online mode (coming soon)' },
    ],
  },
  {
    group: 'Help',
    commands: [
      { name: 'help', desc: 'Show this help (use "kayman help <command>" for details)' },
    ],
  },
]

const QUICK_START = [
  '  1. kayman verify        — check your setup',
  '  2. kayman start         — pick a project and record',
  '  3. kayman stop          — stop and process',
  '  4. kayman last          — see the summary',
]

const COMMAND_DETAILS: Record<string, () => string> = {
  start: () => `
${bold('kayman start')} — Start a recording session

${bold('Usage:')}  kayman start [project] [--tags tag1 tag2] [--skip-checks]

${bold('Options:')}
  [project]            Project name (optional — shows picker if omitted)
  --tags <tags...>     Tag this recording (e.g. --tags daily client)
  --skip-checks        Skip pre-flight dependency checks (for offline use)

${bold('Examples:')}
  kayman start
  kayman start "Daily Standup"
  kayman start "Client Demo" --tags client demo
  kayman start --skip-checks
`.trim(),

  stop: () => `
${bold('kayman stop')} — Stop the active recording session

${bold('Usage:')}  kayman stop

${bold('Examples:')}
  kayman stop
`.trim(),

  status: () => `
${bold('kayman status')} — Check whether a recording is active

${bold('Usage:')}  kayman status

${bold('Examples:')}
  kayman status
`.trim(),

  memo: () => `
${bold('kayman memo')} — Start a memo recording (no project picker)

${bold('Usage:')}  kayman memo [--skip-checks]

${bold('Options:')}
  --skip-checks        Skip pre-flight dependency checks (for offline use)

${bold('Examples:')}
  kayman memo
  kayman memo --skip-checks
`.trim(),

  last: () => `
${bold('kayman last')} — Show the most recent meeting summary TL;DR

${bold('Usage:')}  kayman last

${bold('Examples:')}
  kayman last
`.trim(),

  list: () => `
${bold('kayman list')} — List past meeting recordings

${bold('Usage:')}  kayman list [--project <name>] [--from <date>] [--to <date>] [--tag <tag...>]

${bold('Options:')}
  --project <name>     Filter by project name
  --from <date>        Show recordings from this date (YYYY-MM-DD)
  --to <date>          Show recordings up to this date (YYYY-MM-DD)
  --tag <tag...>       Filter by tag (AND logic)

${bold('Examples:')}
  kayman list
  kayman list --project "Daily Standup"
  kayman list --from 2026-04-01 --to 2026-04-10
  kayman list --tag client
`.trim(),

  retry: () => `
${bold('kayman retry')} — Re-export failed Notion exports

${bold('Usage:')}  kayman retry [--path <dir>] [--all]

${bold('Options:')}
  --path <dir>         Retry export for a specific recording directory
  --all                Retry all failed exports

${bold('Examples:')}
  kayman retry --all
  kayman retry --path ~/.kayman/recordings/2026-04-10_daily
`.trim(),

  verify: () => `
${bold('kayman verify')} — Validate kayman setup and dependencies

${bold('Usage:')}  kayman verify

${bold('Examples:')}
  kayman verify
`.trim(),

  completion: () => `
${bold('kayman completion')} — Install shell tab completion for project names

${bold('Usage:')}  kayman completion install [shell]

${bold('Options:')}
  install              Install shell completion script
  [shell]              Shell type: bash, zsh, fish (auto-detected if omitted)

${bold('Examples:')}
  kayman completion install
  kayman completion install zsh
`.trim(),

  models: () => `
${bold('kayman models')} — Manage local whisper models

${bold('Usage:')}  kayman models [list]
        kayman models download <model>
        kayman models remove <model>

${bold('Subcommands:')}
  list             Show available models with download status and size
  download <model> Download a whisper model to ~/.cache/whisper/
  remove <model>   Remove a downloaded model

${bold('Models:')}  tiny (75 MB), base (142 MB), small (466 MB), medium (1.5 GB), large (2.9 GB)

${bold('Examples:')}
  kayman models list
  kayman models download base
  kayman models remove large
`.trim(),

  help: () => `
${bold('kayman help')} — Show command help

${bold('Usage:')}  kayman help [command]

${bold('Options:')}
  [command]            Command name to get detailed help for

${bold('Examples:')}
  kayman help
  kayman help start
  kayman help list
`.trim(),
}

export async function helpCommand(commandName?: string): Promise<void> {
  if (!commandName) {
    process.stdout.write(bold('Quick Start:') + '\n')
    for (const line of QUICK_START) {
      process.stdout.write(dim(line) + '\n')
    }
    process.stdout.write('\n')

    process.stdout.write(bold('Commands:') + '\n')
    for (const { group, commands } of COMMAND_GROUPS) {
      process.stdout.write('\n' + bold(group + ':') + '\n')
      for (const { name, desc } of commands) {
        const namePadded = ('  kayman ' + name).padEnd(24)
        process.stdout.write(namePadded + dim('— ' + desc) + '\n')
      }
    }
    process.stdout.write('\n' + dim('Run "kayman help <command>" for detailed help on a specific command.') + '\n')
    return
  }

  const detail = COMMAND_DETAILS[commandName]
  if (!detail) {
    process.stdout.write(warn(`Unknown command: "${commandName}". Run kayman help for all commands.`) + '\n')
    return
  }
  process.stdout.write(detail() + '\n')
}
