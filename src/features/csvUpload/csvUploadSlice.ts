import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

type CsvSummary = {
  rows: number
  columns: number
  column_info: { name: string; dtype: string }[]
  preview: Record<string, unknown>[]
}

type CsvUploadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; result: CsvSummary }

export const uploadCsv = createAsyncThunk<CsvSummary, File, { rejectValue: string }>(
  'csvUpload/upload',
  async (file, { rejectWithValue }) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return rejectWithValue('Please select a .csv file.')
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/csv/summary', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) return rejectWithValue(body.detail ?? 'Failed to process the file.')
      return body as CsvSummary
    } catch {
      return rejectWithValue('Could not reach the server. Is the backend running?')
    }
  },
)

const csvUploadSlice = createSlice({
  name: 'csvUpload',
  initialState: { kind: 'idle' } as CsvUploadState,
  reducers: {
    reset: () => ({ kind: 'idle' }) as CsvUploadState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadCsv.pending, () => ({ kind: 'loading' }))
      .addCase(uploadCsv.fulfilled, (_, action) => ({ kind: 'success', result: action.payload }))
      .addCase(uploadCsv.rejected, (_, action) => ({
        kind: 'error',
        message: action.payload ?? 'Something went wrong.',
      }))
  },
})

export const { reset } = csvUploadSlice.actions
export default csvUploadSlice.reducer
