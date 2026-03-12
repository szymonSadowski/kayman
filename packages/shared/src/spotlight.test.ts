import { describe, it, expect } from 'vitest'
import { applySpotlight } from './spotlight'

describe('applySpotlight', () => {
  it('bolds single occurrence of user name', () => {
    const result = applySpotlight(['Szymon reviewed the PR'], 'Szymon')
    expect(result).toEqual(['**Szymon** reviewed the PR'])
  })

  it('bolds multiple occurrences', () => {
    const result = applySpotlight(['Szymon and Szymon agreed'], 'Szymon')
    expect(result).toEqual(['**Szymon** and **Szymon** agreed'])
  })

  it('does not modify points without the user name', () => {
    const result = applySpotlight(['Alice reviewed the PR'], 'Szymon')
    expect(result).toEqual(['Alice reviewed the PR'])
  })

  it('is case-insensitive', () => {
    const result = applySpotlight(['szymon did the thing'], 'Szymon')
    expect(result).toEqual(['**szymon** did the thing'])
  })

  it('returns unchanged array when userName is empty', () => {
    const points = ['Alice did something']
    const result = applySpotlight(points, '')
    expect(result).toEqual(points)
  })

  it('handles multiple key points', () => {
    const result = applySpotlight(
      ['Szymon opened the meeting', 'Bob presented', 'Szymon closed'],
      'Szymon',
    )
    expect(result).toEqual([
      '**Szymon** opened the meeting',
      'Bob presented',
      '**Szymon** closed',
    ])
  })
})
