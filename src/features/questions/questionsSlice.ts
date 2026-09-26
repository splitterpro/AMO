import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { AnalysisResult, CalculationDetails, Visualization } from '../../types/analysis'

interface QuestionState {
  status: 'loading' | 'success' | 'error'
  answer?: string
  table?: Record<string, unknown>[] | null
  visualization?: Visualization
  calculation?: CalculationDetails
  error?: string
}

type QuestionsState = Record<number, QuestionState>

const initialState: QuestionsState = {}

export const askQuestion = createAsyncThunk(
  'questions/ask',
  async ({ datasetId, questionId }: { datasetId: string; questionId: number }) => {
    const res = await fetch('/api/csv/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, question_id: questionId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail ?? 'Something went wrong.')
    }
    return (await res.json()) as AnalysisResult
  },
)

const questionsSlice = createSlice({
  name: 'questions',
  initialState,
  reducers: {
    resetQuestions: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(askQuestion.pending, (state, action) => {
        state[action.meta.arg.questionId] = { status: 'loading' }
      })
      .addCase(askQuestion.fulfilled, (state, action) => {
        state[action.payload.question_id] = {
          status: 'success',
          answer: action.payload.answer,
          table: action.payload.table,
          visualization: action.payload.visualization,
          calculation: action.payload.calculation,
        }
      })
      .addCase(askQuestion.rejected, (state, action) => {
        state[action.meta.arg.questionId] = {
          status: 'error',
          error: action.error.message ?? 'Something went wrong.',
        }
      })
  },
})

export const { resetQuestions } = questionsSlice.actions
export default questionsSlice.reducer
