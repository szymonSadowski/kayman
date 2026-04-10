import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const { testDataDir, testLastSummaryPath } = vi.hoisted(() => {
  const { mkdtempSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const { tmpdir } = require('os') as typeof import('os')
  const dir = mkdtempSync(join(tmpdir(), 'kayman-last-test-'))
  return {
    testDataDir: dir,
    testLastSummaryPath: join(dir, 'last-summary.json'),
  }
})

vi.mock('@kayman/shared', () => ({
  LAST_SUMMARY_PATH: testLastSummaryPath,
  info: (s: string) => s,
  error: (s: string) => s,
  bold: (s: string) => s,
  dim: (s: string) => s,
}))

import { lastCommand } from './last.js'
import type { Config, Summary } from '@kayman/shared'

const mockConfig = {} as Config

const mockSummary: Summary = {
  title: 'Roadmap planning Q2',
  tldr: 'We aligned on shipping Epic 4 next sprint.',
  keyPoints: ['kp1', 'kp2'],
  fullSummary: 'A long full summary that should NOT be printed.',
  project: 'kayman',
  recordedAt: '2026-04-08T10:00:00Z',
  transcriptPath: '/tmp/audio.txt',
}

function writePointer(summaryPath: string) {
  fs.writeFileSync(testLastSummaryPath, JSON.stringify({ summaryPath }), 'utf8')
}

function writeSummary(filename: string, summary: Summary): string {
  const summaryPath = path.join(testDataDir, filename)
  fs.writeFileSync(summaryPath, JSON.stringify(summary), 'utf8')
  return summaryPath
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  try { fs.unlinkSync(testLastSummaryPath) } catch { /* ok */ }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('lastCommand', () => {
  it('prints title, project, and tldr when pointer + summary exist', async () => {
    const summaryPath = writeSummary('summary-happy.json', mockSummary)
    writePointer(summaryPath)

    await lastCommand(mockConfig)

    const calls = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string)
    const out = calls.join('')
    expect(out).toContain('Roadmap planning Q2')
    expect(out).toContain('(kayman)')
    expect(out).toContain('We aligned on shipping Epic 4 next sprint.')
  })

  it('does not print keyPoints or fullSummary', async () => {
    const summaryPath = writeSummary('summary-scope.json', mockSummary)
    writePointer(summaryPath)

    await lastCommand(mockConfig)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).not.toContain('A long full summary')
    expect(out).not.toContain('kp1')
  })

  it('prints empty-state message and exits 0 when pointer file missing', async () => {
    await lastCommand(mockConfig)

    expect(process.stdout.write).toHaveBeenCalledWith(
      'No meeting summaries yet. Run kayman stop after your next meeting.\n',
    )
    expect(process.stderr.write).not.toHaveBeenCalled()
  })

  it('writes stderr and exits 1 when summary.json is missing', async () => {
    writePointer(path.join(testDataDir, 'does-not-exist.json'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(lastCommand(mockConfig)).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('summary not found'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('writes stderr and exits 1 when summary.json is malformed', async () => {
    const summaryPath = path.join(testDataDir, 'malformed-summary.json')
    fs.writeFileSync(summaryPath, '{ not valid json', 'utf8')
    writePointer(summaryPath)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(lastCommand(mockConfig)).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('summary not found or unreadable'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('writes stderr and exits 1 when pointer file is malformed', async () => {
    fs.writeFileSync(testLastSummaryPath, 'not valid json', 'utf8')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(lastCommand(mockConfig)).rejects.toThrow('exit')

    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('malformed pointer file'))
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('writes stderr and exits 1 on non-ENOENT pointer read error', async () => {
    fs.writeFileSync(testLastSummaryPath, JSON.stringify({ summaryPath: '/any' }), 'utf8')
    fs.chmodSync(testLastSummaryPath, 0o000)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    try {
      await expect(lastCommand(mockConfig)).rejects.toThrow('exit')
      expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('failed to read'))
      expect(exitSpy).toHaveBeenCalledWith(1)
    } finally {
      fs.chmodSync(testLastSummaryPath, 0o644)
      exitSpy.mockRestore()
    }
  })

  it('renders project as "memo" when summary.project is null', async () => {
    const memoSummary: Summary = { ...mockSummary, project: null, title: 'Quick Note' }
    const summaryPath = writeSummary('summary-memo.json', memoSummary)
    writePointer(summaryPath)

    await lastCommand(mockConfig)

    const out = vi.mocked(process.stdout.write).mock.calls.map((c) => c[0] as string).join('')
    expect(out).toContain('Quick Note')
    expect(out).toContain('(memo)')
  })
})
