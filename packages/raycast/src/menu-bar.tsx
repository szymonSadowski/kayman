import { MenuBarExtra, showToast, Toast, launchCommand, LaunchType } from '@raycast/api'
import { readSessionFile } from '@kayman/shared'
import { runKayman, showKaymanError } from './lib/cli'

export default function MenuBar() {
  let session = null
  try {
    session = readSessionFile()
  } catch {
    // non-ENOENT filesystem error — treat as no active session
  }
  const now = Date.now()

  if (!session) {
    return (
      <MenuBarExtra title="⏺ kayman" tooltip="No active recording">
        <MenuBarExtra.Item title="No active recording" />
      </MenuBarExtra>
    )
  }

  const startTime = new Date(session.startedAt).getTime()
  const elapsedSec = Number.isNaN(startTime) ? 0 : Math.max(0, Math.floor((now - startTime) / 1000))
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')
  const project = session.project ?? 'memo'

  return (
    <MenuBarExtra title={`⏺ ${mm}:${ss}`} tooltip={`Recording: ${project}`}>
      <MenuBarExtra.Item title={`Project: ${project}`} />
      <MenuBarExtra.Item
        title="Stop Recording"
        onAction={async () => {
          try {
            await runKayman(['stop'])
            await showToast({ style: Toast.Style.Success, title: 'Recording stopped' })
          } catch (err) {
            await showKaymanError(err)
          }
        }}
      />
      <MenuBarExtra.Item
        title="Show Status"
        onAction={async () => {
          try {
            await launchCommand({ name: 'status', type: LaunchType.UserInitiated })
          } catch {
            // launchCommand can fail if status command is disabled — ignore silently
          }
        }}
      />
    </MenuBarExtra>
  )
}
