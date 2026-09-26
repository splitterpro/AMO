import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { afterEach, describe, expect, it, vi } from 'vitest'
import questionsReducer from '../../features/questions/questionsSlice'
import type { AnalysisQuestion } from '../../types/analysis'
import AnalysisGrid from './AnalysisGrid'

const questions: AnalysisQuestion[] = [
  { id: 1, label: 'Total Sales by Region', question: 'Q1', description: 'D1', category: 'Comparisons' },
  { id: 2, label: 'Monthly Sales Trend', question: 'Q2', description: 'D2', category: 'Trends' },
]

function renderGrid(items: AnalysisQuestion[] = questions) {
  const store = configureStore({ reducer: { questions: questionsReducer } })
  render(
    <Provider store={store}>
      <AnalysisGrid datasetId="ds-1" questions={items} />
    </Provider>,
  )
}

describe('AnalysisGrid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state when there are no questions to display', () => {
    renderGrid([])
    expect(screen.getByText('No analyses match your filters.')).toBeInTheDocument()
  })

  it('renders one card per question', () => {
    renderGrid()
    expect(screen.getByText('Total Sales by Region')).toBeInTheDocument()
    expect(screen.getByText('Monthly Sales Trend')).toBeInTheDocument()
  })

  it('only highlights one card as selected at a time', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))) // never resolves - stay in "loading"
    const user = userEvent.setup()
    renderGrid()

    const card1Button = screen.getByText('Total Sales by Region').closest('button')!
    const card2Button = screen.getByText('Monthly Sales Trend').closest('button')!

    await user.click(card1Button)
    expect(card1Button.closest('.analysis-card')).toHaveClass('expanded')
    expect(card2Button.closest('.analysis-card')).not.toHaveClass('expanded')

    await user.click(card2Button)
    expect(card1Button.closest('.analysis-card')).not.toHaveClass('expanded')
    expect(card2Button.closest('.analysis-card')).toHaveClass('expanded')
  })

  it('deselects a card when it is clicked again, closing the panel', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const user = userEvent.setup()
    renderGrid()

    const card1Button = screen.getByText('Total Sales by Region').closest('button')!
    await user.click(card1Button)
    expect(card1Button.closest('.analysis-card')).toHaveClass('expanded')

    await user.click(card1Button)
    expect(card1Button.closest('.analysis-card')).not.toHaveClass('expanded')
  })

  it('opens the detail panel with the selected question when a card is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const user = userEvent.setup()
    renderGrid()

    await user.click(screen.getByText('Monthly Sales Trend').closest('button')!)

    const panel = document.querySelector('.analysis-panel')!
    expect(panel).toHaveClass('open')
    expect(screen.getByRole('heading', { name: 'Monthly Sales Trend' })).toBeInTheDocument()
  })
})
