import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const { testDataDir } = vi.hoisted(() => {
  const { mkdtempSync } = require('fs') as typeof import('fs')
  const { join } = require('path') as typeof import('path')
  const { tmpdir } = require('os') as typeof import('os')
  return { testDataDir: mkdtempSync(join(tmpdir(), 'kayman-list-test-')) }
})

vi.mock('@kayman/shared', () => ({
  DATA_DIR: testDataDir,
}))

import { listCommand } from './list'
import type { Config } from '@kayman/shared'

const mockConfig = {} as Config

function createRecording(dir: string, summary: Record<string, unknown>, session?: Record<string, unknown>) {
  const recordingDir = path.join(testDataDir, 'recordings', dir)
  fs.mkdirSync(recordingDir, { recursive: true })
  fs.writeFileSync(path.join(recordingDir, 'summary.json'), JSON.stringify(summary), 'utf8')
  if (session) {
    fs.writeFileSync(path.join(recordingDir, 'session.json'), JSON.stringify(session), 'utf8')
  }
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  // Clean recordings dir
  const recDir = path.join(testDataDir, 'recordings')
  try { fs.rmSync(recDir, { recursive: true, force: true }) } catch { /* ok */ }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listCommand', () => {
  it('prints "No recordings found." when no recordings exist', async () => {
    await listCommand(mockConfig, {})
    expect(process.stdout.write).toHaveBeenCalledWith('No recordings found.\n')
  })

  it('lists recordings sorted by date descending', async () => {
    createRecording('2026-03-01-proj', {
      title: 'March Meeting', project: 'Proj', recordedAt: '2026-03-01T10:00:00Z',
    })
    createRecording('2026-04-01-proj', {
      title: 'April Meeting', project: 'Proj', recordedAt: '2026-04-01T10:00:00Z',
    })

    await listCommand(mockConfig, {})

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls[0]).toContain('2026-04-01')
    expect(calls[1]).toContain('2026-03-01')
  })

  it('filters by project (case-insensitive)', async () => {
    createRecording('2026-03-01-a', {
      title: 'A Meeting', project: 'Project A', recordedAt: '2026-03-01T10:00:00Z',
    })
    createRecording('2026-03-02-b', {
      title: 'B Meeting', project: 'Project B', recordedAt: '2026-03-02T10:00:00Z',
    })

    await listCommand(mockConfig, { project: 'project a' })

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('A Meeting')
  })

  it('shows project-specific message when no match', async () => {
    createRecording('2026-03-01-a', {
      title: 'A Meeting', project: 'Project A', recordedAt: '2026-03-01T10:00:00Z',
    })

    await listCommand(mockConfig, { project: 'Nonexistent' })

    expect(process.stdout.write).toHaveBeenCalledWith('No recordings found for project "Nonexistent".\n')
  })

  it('filters by --from date', async () => {
    createRecording('2026-03-01-p', {
      title: 'Early', project: 'P', recordedAt: '2026-03-01T10:00:00Z',
    })
    createRecording('2026-04-01-p', {
      title: 'Late', project: 'P', recordedAt: '2026-04-01T10:00:00Z',
    })

    await listCommand(mockConfig, { from: '2026-04-01' })

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('Late')
  })

  it('filters by --to date', async () => {
    createRecording('2026-03-01-p', {
      title: 'Early', project: 'P', recordedAt: '2026-03-01T10:00:00Z',
    })
    createRecording('2026-04-01-p', {
      title: 'Late', project: 'P', recordedAt: '2026-04-01T10:00:00Z',
    })

    await listCommand(mockConfig, { to: '2026-03-31' })

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('Early')
  })

  it('filters by tag (AND logic)', async () => {
    createRecording('2026-03-01-a', {
      title: 'Tagged', project: 'P', recordedAt: '2026-03-01T10:00:00Z',
    }, { tags: ['daily', 'voc'] })
    createRecording('2026-03-02-b', {
      title: 'Partial', project: 'P', recordedAt: '2026-03-02T10:00:00Z',
    }, { tags: ['daily'] })

    await listCommand(mockConfig, { tag: ['daily', 'voc'] })

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('Tagged')
  })

  it('shows tags in output', async () => {
    createRecording('2026-03-01-a', {
      title: 'Tagged', project: 'P', recordedAt: '2026-03-01T10:00:00Z',
    }, { tags: ['daily', 'standup'] })

    await listCommand(mockConfig, {})

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls[0]).toContain('[daily, standup]')
  })

  it('skips directories without summary.json', async () => {
    const emptyDir = path.join(testDataDir, 'recordings', '2026-03-01-empty')
    fs.mkdirSync(emptyDir, { recursive: true })

    await listCommand(mockConfig, {})

    expect(process.stdout.write).toHaveBeenCalledWith('No recordings found.\n')
  })

  it('shows memo for null project', async () => {
    createRecording('2026-03-01-memo', {
      title: 'Quick Note', project: null, recordedAt: '2026-03-01T10:00:00Z',
    })

    await listCommand(mockConfig, {})

    const calls = vi.mocked(process.stdout.write).mock.calls.map(c => c[0] as string)
    expect(calls[0]).toContain('memo')
  })
})
