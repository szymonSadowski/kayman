import { showToast, Toast } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

export default async function Memo() {
  try {
    await runKayman(['memo'])
    await showToast({ style: Toast.Style.Success, title: 'Memo recording started' })
  } catch (err) {
    await showKaymanError(err)
  }
}
