import { Detail } from '@raycast/api'
import { runKayman, showKaymanError } from './lib/cli'

// Implementation: Story 4.3
// runKayman / showKaymanError wired in scaffold for Story 4.3 use
void runKayman
void showKaymanError

export default function Status() {
  return <Detail markdown="## Recording Status\n\nNot yet implemented (Story 4.3)" />
}
