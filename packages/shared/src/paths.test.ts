import { describe, it, expect } from 'vitest'
import os from 'os'
import path from 'path'
import { CONFIG_DIR, DATA_DIR, SESSION_PATH, LAST_SUMMARY_PATH, recordingDir } from './paths'

describe('paths', () => {
  it('CONFIG_DIR is under home', () => {
    expect(CONFIG_DIR).toBe(path.join(os.homedir(), '.config', 'kayman'))
  })

  it('DATA_DIR is under home', () => {
    expect(DATA_DIR).toBe(path.join(os.homedir(), '.local', 'share', 'kayman'))
  })

  it('SESSION_PATH is inside CONFIG_DIR', () => {
    expect(SESSION_PATH).toBe(path.join(CONFIG_DIR, 'session.json'))
  })

  it('LAST_SUMMARY_PATH is inside DATA_DIR', () => {
    expect(LAST_SUMMARY_PATH).toBe(path.join(DATA_DIR, 'last-summary.json'))
  })

  it('recordingDir uses date and project slug', () => {
    const result = recordingDir('2026-03-12', 'Project Kayman')
    expect(result).toBe(
      path.join(DATA_DIR, 'recordings', '2026-03-12-project-kayman'),
    )
  })

  it('recordingDir uses memo for null project', () => {
    const result = recordingDir('2026-03-12', null)
    expect(result).toBe(path.join(DATA_DIR, 'recordings', '2026-03-12-memo'))
  })

  it('recordingDir sanitizes slashes in project name', () => {
    const result = recordingDir('2026-03-12', 'Q1/Planning')
    expect(result).toBe(path.join(DATA_DIR, 'recordings', '2026-03-12-q1-planning'))
  })

  it('recordingDir sanitizes special chars in project name', () => {
    const result = recordingDir('2026-03-12', 'My: Project (2026)')
    expect(result).toBe(path.join(DATA_DIR, 'recordings', '2026-03-12-my-project-2026'))
  })
})
