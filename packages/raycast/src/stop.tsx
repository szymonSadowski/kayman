import { showToast, Toast } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

export default async function Stop() {
  try {
    await runKayman(['stop'])
    await showToast({ style: Toast.Style.Success, title: 'Recording stopped', message: 'Pipeline running in background' })
  } catch (err) {
    await showKaymanError(err)
  }
}
