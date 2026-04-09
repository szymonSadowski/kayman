import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@kayman/shared', () => ({
  loadConfig: vi.fn(),
}))

import { completionCommand } from './completion.js'
import { loadConfig } from '@kayman/shared'

const mockLoadConfig = vi.mocked(loadConfig)

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('completionCommand - projects', () => {
  it('prints project names line-separated from config', async () => {
    mockLoadConfig.mockReturnValue({
      projects: [{ name: 'Kayman', notionPageId: 'x' }, { name: 'Foo', notionPageId: 'y' }],
    } as unknown as ReturnType<typeof loadConfig>)

    await completionCommand(['projects'])

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toBe('Kayman\nFoo\n')
  })

  it('prints nothing and exits 0 when loadConfig throws (no config file)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    mockLoadConfig.mockImplementation(() => { throw new Error('Config error: config file not found') })

    await completionCommand(['projects'])

    expect(process.stdout.write).not.toHaveBeenCalled()
    expect(process.stderr.write).not.toHaveBeenCalled()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('prints nothing and exits 0 when projects array is empty', async () => {
    mockLoadConfig.mockReturnValue({
      projects: [],
    } as unknown as ReturnType<typeof loadConfig>)

    await completionCommand(['projects'])

    expect(process.stdout.write).not.toHaveBeenCalled()
  })
})

describe('completionCommand - script', () => {
  it('script zsh contains compdef _kayman kayman and kayman completion projects', async () => {
    await completionCommand(['script', 'zsh'])

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('compdef _kayman kayman')
    expect(out).toContain('kayman completion projects')
  })

  it('script bash contains complete -F _kayman kayman', async () => {
    await completionCommand(['script', 'bash'])

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('complete -F _kayman kayman')
  })

  it('script with unknown shell writes to stderr and exits 1', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(completionCommand(['script', 'fish'])).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith('Usage: kayman completion script [zsh|bash]\n')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('script with no shell arg writes to stderr and exits 1', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(completionCommand(['script'])).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith('Usage: kayman completion script [zsh|bash]\n')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

describe('completionCommand - install', () => {
  it('install prints zsh and bash sourcing instructions', async () => {
    await completionCommand(['install'])

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('~/.zshrc')
    expect(out).toContain('~/.bashrc')
    expect(out).toContain('kayman completion script zsh')
    expect(out).toContain('kayman completion script bash')
  })

  it('no args prints install instructions', async () => {
    await completionCommand([])

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('~/.zshrc')
    expect(out).toContain('~/.bashrc')
  })
})

describe('completionCommand - unknown action', () => {
  it('unknown action writes to stderr and exits 1', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(completionCommand(['unknown'])).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith('Unknown completion action: unknown\n')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
