import pc from 'picocolors'

const isTTY = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR

export function success(msg: string): string {
  return isTTY ? pc.green(`✓ ${msg}`) : `[ok] ${msg}`
}

export function error(msg: string): string {
  return isTTY ? pc.red(`✗ ${msg}`) : `[err] ${msg}`
}

export function warn(msg: string): string {
  return isTTY ? pc.yellow(`⚠ ${msg}`) : `[warn] ${msg}`
}

export function info(msg: string): string {
  return isTTY ? pc.cyan(msg) : msg
}

export function dim(msg: string): string {
  return isTTY ? pc.dim(msg) : msg
}

export function bold(msg: string): string {
  return isTTY ? pc.bold(msg) : msg
}
