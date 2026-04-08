import { showToast, Toast } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

// Implementation: Story 4.3
// runKayman / showKaymanError wired in scaffold for Story 4.3 use
void runKayman
void showKaymanError

export default async function Memo() {
  await showToast({ style: Toast.Style.Failure, title: 'Not yet implemented (Story 4.3)' })
}
