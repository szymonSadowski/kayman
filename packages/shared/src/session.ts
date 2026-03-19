import fs from 'fs'
import path from 'path'
import { SESSION_PATH } from './paths'
import type { Session } from './types'

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isValidSession(obj: unknown): obj is Session {
  if (!obj || typeof obj !== 'object') return false
  const s = obj as Record<string, unknown>
  return (
    typeof s.pid === 'number' &&
    s.pid > 0 &&
    typeof s.audioPath === 'string' &&
    s.audioPath.length > 0 &&
    (s.project === null || typeof s.project === 'string') &&
    typeof s.startedAt === 'string'
  )
}

export function writeSession(session: Session): void {
  if (session.pid <= 0) throw new Error(`writeSession: invalid pid ${session.pid}`)
  if (!session.audioPath) throw new Error('writeSession: audioPath must not be empty')
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8')
}

export function readSession(): Session | null {
  let raw: string
  try {
    raw = fs.readFileSync(SESSION_PATH, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    try { fs.unlinkSync(SESSION_PATH) } catch { /* ignore */ }
    return null
  }

  if (!isValidSession(parsed)) {
    try { fs.unlinkSync(SESSION_PATH) } catch { /* ignore */ }
    return null
  }

  if (!isProcessAlive(parsed.pid)) {
    try { fs.unlinkSync(SESSION_PATH) } catch { /* ignore */ }
    return null
  }

  return parsed
}

export function clearSession(): void {
  try {
    fs.unlinkSync(SESSION_PATH)
  } catch {
    // already cleared
  }
}
