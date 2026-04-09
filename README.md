# kayman

Meeting recording and AI summary tool.

## Tab Completion

Add tab completion for `kayman` commands and project names to your shell.

**zsh** — add to `~/.zshrc`:
```zsh
# Required if not already present:
autoload -U compinit && compinit

eval "$(kayman completion script zsh)"
```

**bash** — add to `~/.bashrc`:
```bash
eval "$(kayman completion script bash)"
```

> **Note (bash on macOS):** macOS ships with bash 3.2. The completion script is compatible with bash 3.2+.
