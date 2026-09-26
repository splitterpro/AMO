import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import csvUploadReducer, { reset, uploadCsv, type CsvSummary } from './csvUploadSlice'

const sampleFile = new File(['a,b\n1,2'], 'sample.csv', { type: 'text/csv' })

const sampleSummary: CsvSummary = {
  dataset_id: 'abc-123',
  rows: 1,
  columns: 2,
  column_info: [],
  preview: [],
  metrics: [],
  questions: [],
}

function buildStore() {
  return configureStore({ reducer: { csvUpload: csvUploadReducer } })
}

describe('csvUploadSlice reducer transitions', () => {
  it('starts idle', () => {
    expect(csvUploadReducer(undefined, { type: '@@INIT' })).toEqual({ kind: 'idle' })
  })

  it('goes to loading on pending, capturing file name/size', () => {
    const action = uploadCsv.pending('req-1', sampleFile)
    const state = csvUploadReducer({ kind: 'idle' }, action)
    expect(state).toEqual({ kind: 'loading', fileName: 'sample.csv', fileSize: sampleFile.size })
  })

  it('goes to success on fulfilled, carrying the parsed summary', () => {
    const action = uploadCsv.fulfilled(sampleSummary, 'req-1', sampleFile)
    const state = csvUploadReducer({ kind: 'loading', fileName: 'sample.csv', fileSize: 8 }, action)
    expect(state).toEqual({ kind: 'success', result: sampleSummary, fileName: 'sample.csv', fileSize: sampleFile.size })
  })

  it('goes to error on rejected, using the reject payload message', () => {
    const action = uploadCsv.rejected(new Error('boom'), 'req-1', sampleFile, 'Please select a .csv file.')
    const state = csvUploadReducer({ kind: 'idle' }, action)
    expect(state).toEqual({ kind: 'error', message: 'Please select a .csv file.' })
  })

  it('falls back to a generic error message when no reject payload is present', () => {
    const action = uploadCsv.rejected(new Error('boom'), 'req-1', sampleFile, undefined)
    const state = csvUploadReducer({ kind: 'idle' }, action)
    expect(state).toEqual({ kind: 'error', message: 'Something went wrong.' })
  })

  it('reset returns to idle from any state', () => {
    expect(csvUploadReducer({ kind: 'error', message: 'x' }, reset())).toEqual({ kind: 'idle' })
  })
})

describe('uploadCsv thunk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a non-.csv file without calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const store = buildStore()

    await store.dispatch(uploadCsv(new File(['x'], 'notes.txt')))

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(store.getState().csvUpload).toEqual({ kind: 'error', message: 'Please select a .csv file.' })
  })

  it('dispatches success with the parsed body on a 200 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(sampleSummary) }),
    )
    const store = buildStore()

    await store.dispatch(uploadCsv(sampleFile))

    const state = store.getState().csvUpload
    expect(state.kind).toBe('success')
    if (state.kind === 'success') expect(state.result).toEqual(sampleSummary)
  })

  it('dispatches the backend detail message on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ detail: 'The CSV file has no data.' }) }),
    )
    const store = buildStore()

    await store.dispatch(uploadCsv(sampleFile))

    expect(store.getState().csvUpload).toEqual({ kind: 'error', message: 'The CSV file has no data.' })
  })
})
