import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import { accessSync, constants } from 'fs'
import path from 'path'

const BINARY = path.resolve(__dirname, '../bin/kayman-capture')

describe('kayman-capture binary', () => {
  it('exists at packages/cli/bin/kayman-capture', () => {
    expect(() => accessSync(BINARY, constants.F_OK)).not.toThrow()
  })

  it('is executable', () => {
    expect(() => accessSync(BINARY, constants.X_OK)).not.toThrow()
  })
})

describe('kayman-capture argument validation', () => {
  function run(...args: string[]) {
    return spawnSync(BINARY, args, { encoding: 'utf8', timeout: 5000 })
  }

  it('exits 1 with no args and prints usage to stderr', () => {
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage:')
  })

  it('exits 1 when --source value is invalid', () => {
    const result = run('--source', 'invalid_source', '--output', '/tmp/test.caf')
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/system_and_mic|mic_only|system_only/)
  })

  it('exits 1 when --source has no value', () => {
    const result = run('--source')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--source')
  })

  it('exits 1 when --output has no value', () => {
    const result = run('--source', 'system_and_mic', '--output')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--output')
  })

  it('exits 1 when --output is missing', () => {
    const result = run('--source', 'system_and_mic')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage:')
  })

  it('exits 1 when --source is missing', () => {
    const result = run('--output', '/tmp/test.caf')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Usage:')
  })

  it('exits 1 on unknown argument', () => {
    const result = run('--source', 'system_and_mic', '--output', '/tmp/test.caf', '--unknown')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('unknown argument')
  })
})
