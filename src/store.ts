import { configureStore } from '@reduxjs/toolkit'
import csvUploadReducer from './features/csvUpload/csvUploadSlice'

export const store = configureStore({
  reducer: { csvUpload: csvUploadReducer },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
