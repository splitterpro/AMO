import { configureStore } from '@reduxjs/toolkit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import questionsReducer, { askQuestion, resetQuestions } from './questionsSlice'
import type { AnalysisResult } from '../../types/analysis'

const sampleResult: AnalysisResult = {
  question_id: 1,
  answer: 'East leads with 640 in sales.',
  table: [{ category: 'East', value: 640 }],
  visualization: { type: 'bar', data: [{ category: 'East', value: 640 }] },
  calculation: {
    operation: 'groupby_sum',
    dimension_column: 'Region',
    measure_column: 'Sales',
    secondary_measure_column: null,
    date_column: null,
    aggregation: 'SUM',
    rows_analyzed: 8,
    calculated_by: 'pandas',
  },
}

function buildStore() {
  return configureStore({ reducer: { questions: questionsReducer } })
}

describe('questionsSlice reducer transitions', () => {
  it('starts empty', () => {
    expect(questionsReducer(undefined, { type: '@@INIT' })).toEqual({})
  })

  it('sets loading for the specific question id on pending', () => {
    const action = askQuestion.pending('req-1', { datasetId: 'ds-1', questionId: 3 })
    const state = questionsReducer({}, action)
    expect(state).toEqual({ 3: { status: 'loading' } })
  })

  it('stores the full result under the question id on fulfilled', () => {
    const action = askQuestion.fulfilled(sampleResult, 'req-1', { datasetId: 'ds-1', questionId: 1 })
    const state = questionsReducer({ 1: { status: 'loading' } }, action)
    expect(state).toEqual({
      1: {
        status: 'success',
        answer: sampleResult.answer,
        table: sampleResult.table,
        visualization: sampleResult.visualization,
        calculation: sampleResult.calculation,
      },
    })
  })

  it('stores the error message under the question id on rejected', () => {
    const action = askQuestion.rejected(new Error('Dataset not found.'), 'req-1', { datasetId: 'ds-1', questionId: 5 })
    const state = questionsReducer({}, action)
    expect(state).toEqual({ 5: { status: 'error', error: 'Dataset not found.' } })
  })

  it('does not disturb other questions already in state', () => {
    const existing = { 1: { status: 'success' as const, answer: 'already answered' } }
    const action = askQuestion.pending('req-2', { datasetId: 'ds-1', questionId: 2 })
    const state = questionsReducer(existing, action)
    expect(state[1]).toEqual(existing[1])
    expect(state[2]).toEqual({ status: 'loading' })
  })

  it('resetQuestions clears all state', () => {
    const existing = { 1: { status: 'success' as const, answer: 'x' } }
    expect(questionsReducer(existing, resetQuestions())).toEqual({})
  })
})

describe('askQuestion thunk', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches success with the full AnalysisResult on a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(sampleResult) }))
    const store = buildStore()

    await store.dispatch(askQuestion({ datasetId: 'ds-1', questionId: 1 }))

    expect(store.getState().questions[1]).toEqual({
      status: 'success',
      answer: sampleResult.answer,
      table: sampleResult.table,
      visualization: sampleResult.visualization,
      calculation: sampleResult.calculation,
    })
  })

  it('dispatches the backend detail message as the error on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ detail: 'Unknown question_id 9.' }) }),
    )
    const store = buildStore()

    await store.dispatch(askQuestion({ datasetId: 'ds-1', questionId: 9 }))

    expect(store.getState().questions[9]).toEqual({ status: 'error', error: 'Unknown question_id 9.' })
  })
})
