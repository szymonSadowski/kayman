import path from 'path'
import os from 'os'

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'kayman')
export const DATA_DIR = path.join(os.homedir(), '.local', 'share', 'kayman')
export const SESSION_PATH = path.join(CONFIG_DIR, 'session.json')
export const LAST_SUMMARY_PATH = path.join(DATA_DIR, 'last-summary.json')

export function recordingDir(date: string, project: string | null): string {
  const slug = project ? project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'memo'
  return path.join(DATA_DIR, 'recordings', `${date}-${slug}`)
}
