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

  it('does not write to stdout', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    banner.printBanner()
    expect(write).not.toHaveBeenCalled()
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
