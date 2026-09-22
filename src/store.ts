import { configureStore } from '@reduxjs/toolkit'
import csvUploadReducer from './features/csvUpload/csvUploadSlice'
import questionsReducer from './features/questions/questionsSlice'

export const store = configureStore({
  reducer: { csvUpload: csvUploadReducer, questions: questionsReducer },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
