import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const { testDataDir } = vi.hoisted(() => {
  const { mkdtempSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const { tmpdir } = require('os') as typeof import('os')
  return { testDataDir: mkdtempSync(join(tmpdir(), 'kayman-retry-test-')) }
})

vi.mock('@kayman/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@kayman/shared')>()
  return {
    ...actual,
    DATA_DIR: testDataDir,
    loadConfig: vi.fn(),
    notify: vi.fn(),
    notifyError: vi.fn(),
  }
})

vi.mock('../pipeline/export.js', () => ({
  runExport: vi.fn(),
}))

import { retryCommand } from './retry.js'
import { runExport } from '../pipeline/export.js'
import type { Config, Summary } from '@kayman/shared'

const mockConfig: Config = {
  userName: 'Test',
  aiProvider: 'openai',
  aiModel: 'gpt-4',
  aiApiKey: 'key',
  notionToken: 'tok',
  notionDatabaseId: 'db',
  projects: [],
  audioSource: 'system_and_mic',
}

const mockSummary: Summary = {
  title: 'Test Meeting',
  tldr: 'Summary',
  keyPoints: [],
  fullSummary: 'Full.',
  project: 'Proj',
  recordedAt: '2026-03-01T10:00:00Z',
  transcriptPath: '/tmp/audio.txt',
}

function createRecording(dir: string, opts: { exported?: boolean; tags?: string[] } = {}) {
  const recordingDir = path.join(testDataDir, 'recordings', dir)
  fs.mkdirSync(recordingDir, { recursive: true })
  fs.writeFileSync(path.join(recordingDir, 'summary.json'), JSON.stringify(mockSummary), 'utf8')
  if (opts.exported) {
    fs.writeFileSync(path.join(recordingDir, '.exported'), '', 'utf8')
  }
  if (opts.tags) {
    fs.writeFileSync(path.join(recordingDir, 'session.json'), JSON.stringify({ tags: opts.tags }), 'utf8')
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const recDir = path.join(testDataDir, 'recordings')
  try { fs.rmSync(recDir, { recursive: true, force: true }) } catch { /* ok */ }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('retryCommand', () => {
  it('prints "No failed exports found." when all have .exported', async () => {
    createRecording('2026-03-01-proj', { exported: true })

    await retryCommand(mockConfig, {})

    expect(process.stdout.write).toHaveBeenCalledWith('No failed exports found.\n')
  })

  it('prints "No failed exports found." when no recordings exist', async () => {
    await retryCommand(mockConfig, {})
    expect(process.stdout.write).toHaveBeenCalledWith('No failed exports found.\n')
  })

  it('retries most recent failed export by default', async () => {
    createRecording('2026-03-01-proj')
    vi.mocked(runExport).mockResolvedValue('page-id')

    await retryCommand(mockConfig, {})

    expect(runExport).toHaveBeenCalledOnce()
    expect(process.stdout.write).toHaveBeenCalledWith('Export succeeded for "Test Meeting".\n')
    // .exported marker should be written
    const exported = path.join(testDataDir, 'recordings', '2026-03-01-proj', '.exported')
    expect(fs.existsSync(exported)).toBe(true)
  })

  it('retries specific path with --path', async () => {
    const dir = path.join(testDataDir, 'recordings', '2026-03-01-proj')
    createRecording('2026-03-01-proj')
    vi.mocked(runExport).mockResolvedValue('page-id')

    await retryCommand(mockConfig, { path: dir })

    expect(runExport).toHaveBeenCalledOnce()
  })

  it('exits 1 when --path has no summary.json', async () => {
    const dir = path.join(testDataDir, 'recordings', 'empty')
    fs.mkdirSync(dir, { recursive: true })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(retryCommand(mockConfig, { path: dir })).rejects.toThrow('exit')
    expect(process.stderr.write).toHaveBeenCalledWith(expect.stringContaining('No summary.json'))
    exitSpy.mockRestore()
  })

  it('retries all with --all and prints summary', async () => {
    createRecording('2026-03-01-a')
    createRecording('2026-03-02-b')
    vi.mocked(runExport).mockResolvedValue('page-id')

    await retryCommand(mockConfig, { all: true })

    expect(runExport).toHaveBeenCalledTimes(2)
    expect(process.stdout.write).toHaveBeenCalledWith('Retried 2 exports: 2 succeeded, 0 failed.\n')
  })

  it('continues on individual failures with --all', async () => {
    createRecording('2026-03-01-a')
    createRecording('2026-03-02-b')
    vi.mocked(runExport)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('page-id')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(retryCommand(mockConfig, { all: true })).rejects.toThrow('exit')
    expect(process.stdout.write).toHaveBeenCalledWith('Retried 2 exports: 1 succeeded, 1 failed.\n')
    exitSpy.mockRestore()
  })

  it('does not write .exported on retry failure', async () => {
    createRecording('2026-03-01-proj')
    vi.mocked(runExport).mockRejectedValue(new Error('Notion down'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') })

    await expect(retryCommand(mockConfig, {})).rejects.toThrow('exit')
    const exported = path.join(testDataDir, 'recordings', '2026-03-01-proj', '.exported')
    expect(fs.existsSync(exported)).toBe(false)
    exitSpy.mockRestore()
  })
})
