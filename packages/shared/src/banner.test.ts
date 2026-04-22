import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('printBanner — TTY mode', () => {
  let banner: typeof import('./banner.js')

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    banner = await import('./banner.js')
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    vi.resetModules()
  })

  it('writes banner to stdout in TTY', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    banner.printBanner()
    expect(write).toHaveBeenCalledOnce()
    const output = write.mock.calls[0][0] as string
    expect(output).toContain('@')
    write.mockRestore()
  })

  it('banner output contains kayman ASCII art', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    banner.printBanner()
    const output = write.mock.calls[0][0] as string
    expect(output.split('\n').length).toBeGreaterThan(10)
    write.mockRestore()
  })
})

describe('printBanner — non-TTY mode', () => {
  let banner: typeof import('./banner.js')

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
    banner = await import('./banner.js')
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    vi.resetModules()
  })

  it('does not write to stdout when piped/redirected', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    banner.printBanner()
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })
})

describe('printBanner — isTTY undefined', () => {
  let banner: typeof import('./banner.js')

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    banner = await import('./banner.js')
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('does not write when isTTY is undefined', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    banner.printBanner()
    expect(write).not.toHaveBeenCalled()
    write.mockRestore()
  })
})
