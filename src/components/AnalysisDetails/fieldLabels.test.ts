import { describe, expect, it } from 'vitest'
import { columnLabel, isPercentField, kpiFieldLabel, resolveSeriesKeys } from './fieldLabels'

describe('isPercentField', () => {
  it('flags known percent fields', () => {
    expect(isPercentField('growth_rate_pct')).toBe(true)
    expect(isPercentField('share_pct')).toBe(true)
    expect(isPercentField('pct_change')).toBe(true)
  })

  it('does not flag non-percent fields', () => {
    expect(isPercentField('value')).toBe(false)
    expect(isPercentField('correlation')).toBe(false)
  })
})

describe('kpiFieldLabel', () => {
  it('returns known labels', () => {
    expect(kpiFieldLabel('growth_rate_pct')).toBe('Growth rate')
    expect(kpiFieldLabel('n')).toBe('Sample size')
  })

  it('falls back to the raw key for unknown fields', () => {
    expect(kpiFieldLabel('something_new')).toBe('something_new')
  })
})

describe('columnLabel', () => {
  it('prefers COLUMN_LABEL entries', () => {
    expect(columnLabel('category')).toBe('Category')
    expect(columnLabel('share_pct')).toBe('Share %')
  })

  it('falls back to KPI_FIELD_LABEL when not a column field', () => {
    expect(columnLabel('growth_rate_pct')).toBe('Growth rate')
  })

  it('falls back to title-casing an unknown snake_case key', () => {
    expect(columnLabel('some_unknown_field')).toBe('Some Unknown Field')
  })
})

describe('resolveSeriesKeys', () => {
  it('resolves distribution rows (bin/count)', () => {
    expect(resolveSeriesKeys({ bin: '(0,10]', bin_min: 0, bin_max: 10, count: 5 })).toEqual({
      xKey: 'bin',
      yKey: 'count',
    })
  })

  it('resolves concentration rows (category/value)', () => {
    expect(resolveSeriesKeys({ category: 'East', value: 100, share_pct: 40 })).toEqual({
      xKey: 'category',
      yKey: 'value',
    })
  })

  it('resolves bin_relationship rows (band/value)', () => {
    expect(resolveSeriesKeys({ band: '(0,10]', value: 5 })).toEqual({ xKey: 'band', yKey: 'value' })
  })

  it('resolves trend rows (period/value)', () => {
    expect(resolveSeriesKeys({ period: '2023-01', value: 100 })).toEqual({ xKey: 'period', yKey: 'value' })
  })

  it('defaults to category/value when the row is undefined', () => {
    expect(resolveSeriesKeys(undefined)).toEqual({ xKey: 'category', yKey: 'value' })
  })
})
