import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    isTTY: false,
    bold: (s: string) => s,
    dim: (s: string) => s,
    warn: (s: string) => `[warn] ${s}`,
  }
})

import { helpCommand } from './help.js'

function captureOutput(fn: () => Promise<void>): Promise<string> {
  const calls: string[] = []
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    calls.push(String(chunk))
    return true
  })
  return fn().finally(() => {
    spy.mockRestore()
  }).then(() => calls.join(''))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('helpCommand', () => {
  it('no arg: output contains Quick Start section', async () => {
    const output = await captureOutput(() => helpCommand())
    expect(output).toContain('Quick Start')
    expect(output).toContain('kayman verify')
    expect(output).toContain('kayman start')
    expect(output).toContain('kayman stop')
    expect(output).toContain('kayman last')
  })

  it('no arg: output contains all 4 command groups', async () => {
    const output = await captureOutput(() => helpCommand())
    expect(output).toContain('Recording')
    expect(output).toContain('Results')
    expect(output).toContain('Setup')
    expect(output).toContain('Help')
  })

  it('no arg: output contains all command names', async () => {
    const output = await captureOutput(() => helpCommand())
    const commands = ['start', 'stop', 'status', 'memo', 'last', 'list', 'retry', 'verify', 'completion', 'help']
    for (const cmd of commands) {
      expect(output).toContain(`kayman ${cmd}`)
    }
  })

  it('helpCommand("start"): output contains usage and flags', async () => {
    const output = await captureOutput(() => helpCommand('start'))
    expect(output).toContain('kayman start')
    expect(output).toContain('Usage')
    expect(output).toContain('--tags')
    expect(output).toContain('--skip-checks')
    expect(output).toContain('Examples')
  })

  it('helpCommand("stop"): output contains stop details', async () => {
    const output = await captureOutput(() => helpCommand('stop'))
    expect(output).toContain('kayman stop')
    expect(output).toContain('Usage')
  })

  it('helpCommand("list"): output contains list flags', async () => {
    const output = await captureOutput(() => helpCommand('list'))
    expect(output).toContain('--project')
    expect(output).toContain('--from')
    expect(output).toContain('--to')
    expect(output).toContain('--tag')
  })

  it('helpCommand("retry"): output contains retry flags', async () => {
    const output = await captureOutput(() => helpCommand('retry'))
    expect(output).toContain('--path')
    expect(output).toContain('--all')
  })

  it('helpCommand("help"): valid command, prints own description', async () => {
    const output = await captureOutput(() => helpCommand('help'))
    expect(output).toContain('kayman help')
    expect(output).toContain('Usage')
  })

  it('helpCommand("invalid"): prints unknown command message and exits 0', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })
    const output = await captureOutput(() => helpCommand('invalid'))
    expect(output).toContain('Unknown command: "invalid"')
    expect(output).toContain('kayman help')
    expect(exitSpy).not.toHaveBeenCalled()
    exitSpy.mockRestore()
  })

  it('helpCommand("foobar"): prints unknown command message', async () => {
    const output = await captureOutput(() => helpCommand('foobar'))
    expect(output).toContain('Unknown command: "foobar"')
  })
})
