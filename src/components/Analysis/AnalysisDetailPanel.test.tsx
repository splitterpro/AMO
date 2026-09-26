import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import questionsReducer from '../../features/questions/questionsSlice'
import type { AnalysisQuestion } from '../../types/analysis'
import AnalysisDetailPanel from './AnalysisDetailPanel'

const question: AnalysisQuestion = {
  id: 1,
  label: 'Total Sales by Region',
  question: 'What are total sales by region?',
  description: 'Sum of sales grouped by region.',
  category: 'Comparisons',
}

function renderPanel(props: { question: AnalysisQuestion | null; onClose: () => void }) {
  const store = configureStore({ reducer: { questions: questionsReducer } })
  return render(
    <Provider store={store}>
      <AnalysisDetailPanel datasetId="ds-1" question={props.question} onClose={props.onClose} />
    </Provider>,
  )
}

describe('AnalysisDetailPanel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.style.overflow = ''
  })

  it('renders nothing selected when question is null', () => {
    renderPanel({ question: null, onClose: vi.fn() })
    expect(document.querySelector('.analysis-panel')).not.toHaveClass('open')
    expect(document.querySelector('.analysis-panel-header')).not.toBeInTheDocument()
  })

  it('opens with the selected question content when a question is provided', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    renderPanel({ question, onClose: vi.fn() })

    expect(document.querySelector('.analysis-panel')).toHaveClass('open')
    expect(screen.getByRole('heading', { name: 'Total Sales by Region' })).toBeInTheDocument()
    expect(screen.getByText('Sum of sales grouped by region.')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderPanel({ question, onClose })

    await user.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderPanel({ question, onClose })

    await user.click(document.querySelector('.analysis-panel-backdrop')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderPanel({ question, onClose })

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open and restores it on close', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const store = configureStore({ reducer: { questions: questionsReducer } })
    const { rerender } = render(
      <Provider store={store}>
        <AnalysisDetailPanel datasetId="ds-1" question={question} onClose={vi.fn()} />
      </Provider>,
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Provider store={store}>
        <AnalysisDetailPanel datasetId="ds-1" question={null} onClose={vi.fn()} />
      </Provider>,
    )
    expect(document.body.style.overflow).toBe('')
  })
})
