import { loadConfig } from '@kayman/shared'

const ZSH_SCRIPT = `#compdef kayman

_kayman() {
  local -a subcommands
  subcommands=(
    'start:Start a recording session'
    'stop:Stop the active recording session'
    'last:Show the most recent meeting summary TL;DR'
    'memo:Start a memo recording (no project picker)'
    'status:Check whether a recording is active'
    'completion:Shell completion helpers'
  )

  if (( CURRENT == 2 )); then
    _describe 'subcommand' subcommands
    return
  fi

  case "\${words[2]}" in
    start)
      local -a projects
      projects=(\${(f)"\$(kayman completion projects 2>/dev/null)"})
      compadd -M 'm:{a-zA-Z}={A-Za-z}' -a projects
      ;;
  esac
}

compdef _kayman kayman
`

const BASH_SCRIPT = `_kayman() {
  local cur subcommands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  subcommands="start stop last memo status completion"

  if [ "\$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( \$(compgen -W "\$subcommands" -- "\$cur") )
    return 0
  fi

  if [ "\${COMP_WORDS[1]}" = "start" ] && [ "\$COMP_CWORD" -eq 2 ]; then
    local project cur_lower
    COMPREPLY=()
    cur_lower=\$(printf '%s' "\$cur" | tr '[:upper:]' '[:lower:]')
    while IFS= read -r project; do
      [ -z "\$project" ] && continue
      if [[ "\$(printf '%s' "\$project" | tr '[:upper:]' '[:lower:]')" == "\${cur_lower}"* ]]; then
        COMPREPLY+=("\$project")
      fi
    done < <(kayman completion projects 2>/dev/null)
    return 0
  fi
}

complete -F _kayman kayman
`

export async function completionCommand(args: string[]): Promise<void> {
  const [action, shell] = args

  if (action === 'projects') {
    try {
      const config = loadConfig()
      for (const p of config.projects) process.stdout.write(`${p.name}\n`)
    } catch {
      // Graceful degrade — empty output, exit 0
    }
    return
  }

  if (action === 'script') {
    if (shell === 'zsh') process.stdout.write(ZSH_SCRIPT)
    else if (shell === 'bash') process.stdout.write(BASH_SCRIPT)
    else {
      process.stderr.write('Usage: kayman completion script [zsh|bash]\n')
      process.exit(1)
    }
    return
  }

  if (action === 'install' || action === undefined) {
    process.stdout.write(`# zsh — add to ~/.zshrc:
eval "$(kayman completion script zsh)"

# bash — add to ~/.bashrc:
eval "$(kayman completion script bash)"
`)
    return
  }

  process.stderr.write(`Unknown completion action: ${action}\n`)
  process.exit(1)
}
