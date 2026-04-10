import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node-notifier', () => ({
  default: { notify: vi.fn() },
}))

import notifier from 'node-notifier'
import { notifyCustom } from './notify'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyCustom', () => {
  it('calls notifier with title kayman and given message', () => {
    notifyCustom('foo')
    expect(notifier.notify).toHaveBeenCalledWith({ title: 'kayman', message: 'foo' })
  })
})
