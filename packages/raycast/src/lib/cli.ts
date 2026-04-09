import { execa } from 'execa'
import { showToast, Toast } from '@raycast/api'

export class KaymanNotFoundError extends Error {
  constructor() {
    super('kayman CLI not found in PATH. Run `pnpm link --global` from packages/cli.')
    this.name = 'KaymanNotFoundError'
  }
}

export async function runKayman(args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execa('kayman', args, { reject: true })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new KaymanNotFoundError()
    }
    throw err
  }
}

export async function showKaymanError(err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await showToast({ style: Toast.Style.Failure, title: 'kayman error', message })
}
