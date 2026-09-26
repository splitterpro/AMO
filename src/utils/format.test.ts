import { describe, expect, it } from 'vitest'
import { formatCompactNumber, formatFileSize, formatNumber } from './format'

describe('formatNumber', () => {
  it('matches the environment locale grouping', () => {
    // Not hardcoded to 'en-US' grouping: toLocaleString() follows the runtime's
    // default locale, which can differ between environments (and end users).
    expect(formatNumber(1234567)).toBe((1234567).toLocaleString())
  })

  it('handles zero and small numbers', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(42)).toBe('42')
  })
})

describe('formatCompactNumber', () => {
  it('compacts large numbers', () => {
    expect(formatCompactNumber(12900)).toBe('12.9K')
    expect(formatCompactNumber(4200000)).toBe('4.2M')
  })

  it('leaves small numbers as-is', () => {
    expect(formatCompactNumber(42)).toBe('42')
  })
})

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024 * 3.5)).toBe('3.5 MB')
  })
})
