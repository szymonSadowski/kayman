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

export function writeSession(session: Session): void {
  fs.mkdirSync(path.dirname(SESSION_PATH), { recursive: true })
  fs.writeFileSync(SESSION_PATH, JSON.stringify(session, null, 2), 'utf8')
}

export function readSession(): Session | null {
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8')
    const session = JSON.parse(raw) as Session
    if (!isProcessAlive(session.pid)) {
      fs.unlinkSync(SESSION_PATH)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    fs.unlinkSync(SESSION_PATH)
  } catch {
    // already cleared
  }
}
