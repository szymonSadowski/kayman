import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('format helpers — TTY mode', () => {
  let format: typeof import('./format.js')

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })
    format = await import('./format.js')
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    vi.resetModules()
  })

  it('success() contains ✓ and green ANSI codes', () => {
    const result = format.success('msg')
    expect(result).toContain('✓')
    expect(result).toContain('msg')
    // picocolors green wraps with ANSI escape codes
    expect(result).toMatch(/\x1b\[/)
  })

  it('error() contains ✗ and red ANSI codes', () => {
    const result = format.error('msg')
    expect(result).toContain('✗')
    expect(result).toContain('msg')
    expect(result).toMatch(/\x1b\[/)
  })

  it('warn() contains ⚠ and yellow ANSI codes', () => {
    const result = format.warn('msg')
    expect(result).toContain('⚠')
    expect(result).toContain('msg')
    expect(result).toMatch(/\x1b\[/)
  })

  it('dim() wraps with ANSI dim codes', () => {
    const result = format.dim('msg')
    expect(result).toContain('msg')
    expect(result).toMatch(/\x1b\[/)
  })

  it('info() wraps with ANSI cyan codes', () => {
    const result = format.info('msg')
    expect(result).toContain('msg')
    expect(result).toMatch(/\x1b\[/)
  })

  it('bold() wraps with ANSI bold codes', () => {
    const result = format.bold('msg')
    expect(result).toContain('msg')
    expect(result).toMatch(/\x1b\[/)
  })
})

describe('format helpers — non-TTY mode', () => {
  let format: typeof import('./format.js')

  beforeEach(async () => {
    vi.resetModules()
    Object.defineProperty(process.stdout, 'isTTY', { value: undefined, configurable: true })
    format = await import('./format.js')
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('success() returns plain [ok] prefix, no ANSI', () => {
    const result = format.success('msg')
    expect(result).toBe('[ok] msg')
    expect(result).not.toMatch(/\x1b\[/)
  })

  it('error() returns plain [err] prefix, no ANSI', () => {
    const result = format.error('msg')
    expect(result).toBe('[err] msg')
    expect(result).not.toMatch(/\x1b\[/)
  })

  it('warn() returns plain [warn] prefix, no ANSI', () => {
    const result = format.warn('msg')
    expect(result).toBe('[warn] msg')
    expect(result).not.toMatch(/\x1b\[/)
  })

  it('dim() returns plain msg, no ANSI', () => {
    const result = format.dim('msg')
    expect(result).toBe('msg')
    expect(result).not.toMatch(/\x1b\[/)
  })

  it('info() returns plain msg, no ANSI', () => {
    const result = format.info('msg')
    expect(result).toBe('msg')
    expect(result).not.toMatch(/\x1b\[/)
  })

  it('bold() returns plain msg, no ANSI', () => {
    const result = format.bold('msg')
    expect(result).toBe('msg')
    expect(result).not.toMatch(/\x1b\[/)
  })
})
