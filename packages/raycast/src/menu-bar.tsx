import { MenuBarExtra } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

// Implementation: Story 4.4
// runKayman / showKaymanError wired in scaffold for Story 4.4 use
void runKayman
void showKaymanError

export default function MenuBar() {
  return <MenuBarExtra title="⏺ kayman" />
}
