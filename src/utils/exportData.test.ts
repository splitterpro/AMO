import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, downloadJson, slugify } from './exportData'

describe('slugify', () => {
  it('lowercases and dashes a normal label', () => {
    expect(slugify('Total Sales by Region')).toBe('total-sales-by-region')
  })

  it('strips punctuation and collapses separators', () => {
    expect(slugify('Sales vs. Profit (Correlation)!')).toBe('sales-vs-profit-correlation')
  })

  it('falls back to "analysis" for a label with no alphanumeric characters', () => {
    expect(slugify('???')).toBe('analysis')
  })
})

describe('downloadCsv / downloadJson', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let capturedParts: string[] | null
  let capturedType: string | null

  beforeEach(() => {
    capturedParts = null
    capturedType = null
    // Real jsdom/Node Blob instances don't round-trip cleanly through .text() or the
    // native Response constructor across realms in this test environment - mocking
    // the Blob constructor itself to capture its raw input is more reliable than
    // trying to read the Blob back.
    vi.stubGlobal(
      'Blob',
      vi.fn((parts: string[], options: { type: string }) => {
        capturedParts = parts
        capturedType = options.type
        return {}
      }),
    )
    createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
    vi.stubGlobal('URL', { createObjectURL: createObjectURLSpy, revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does nothing for an empty row set', async () => {
    downloadCsv('report', [])
    downloadJson('report', [])
    expect(createObjectURLSpy).not.toHaveBeenCalled()
  })

  it('builds a CSV with headers and escapes commas/quotes', () => {
    downloadCsv('report', [
      { category: 'East, Coast', value: 100 },
      { category: 'Say "hi"', value: 200 },
    ])
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    expect(capturedType).toBe('text/csv;charset=utf-8')
    const lines = capturedParts![0].split('\n')
    expect(lines[0]).toBe('category,value')
    expect(lines[1]).toBe('"East, Coast",100')
    expect(lines[2]).toBe('"Say ""hi""",200')
  })

  it('builds pretty-printed JSON matching the input rows', () => {
    const rows = [{ category: 'East', value: 100 }]
    downloadJson('report', rows)
    expect(capturedType).toBe('application/json')
    expect(JSON.parse(capturedParts![0])).toEqual(rows)
  })
})
