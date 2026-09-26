import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import SupportingData from './SupportingData'

const smallTable = [
  { category: 'Toys', value: 1920 },
  { category: 'Electronics', value: 5140 },
  { category: 'Home', value: 125 },
]

function bodyRowTexts() {
  const rows = screen.getAllByRole('row').slice(1) // skip header row
  return rows.map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent).join('|'))
}

describe('SupportingData', () => {
  it('shows an empty state for an empty table', () => {
    render(<SupportingData table={[]} questionLabel="Empty analysis" />)
    expect(screen.getByText('No data to display.')).toBeInTheDocument()
  })

  it('renders humanized headers and formatted numeric cells', () => {
    render(<SupportingData table={smallTable} questionLabel="Sales by category" />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
    expect(screen.getByText('5,140')).toBeInTheDocument()
  })

  it('cycles sort asc -> desc -> reset on repeated header clicks', async () => {
    const user = userEvent.setup()
    render(<SupportingData table={smallTable} questionLabel="Sales by category" />)

    expect(bodyRowTexts()).toEqual(['Toys|1,920', 'Electronics|5,140', 'Home|125'])

    const categoryHeader = screen.getByText('Category').closest('button')!
    await user.click(categoryHeader)
    expect(bodyRowTexts()).toEqual(['Electronics|5,140', 'Home|125', 'Toys|1,920'])

    await user.click(categoryHeader)
    expect(bodyRowTexts()).toEqual(['Toys|1,920', 'Home|125', 'Electronics|5,140'])

    await user.click(categoryHeader)
    expect(bodyRowTexts()).toEqual(['Toys|1,920', 'Electronics|5,140', 'Home|125'])
  })

  it('paginates at 8 rows per page', async () => {
    const bigTable = Array.from({ length: 10 }, (_, i) => ({ category: `Row ${i + 1}`, value: i }))
    const user = userEvent.setup()
    render(<SupportingData table={bigTable} questionLabel="Big table" />)

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(9) // header + 8 body rows
    expect(screen.getByText('Previous')).toBeDisabled()

    await user.click(screen.getByText('Next'))
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(3) // header + remaining 2 rows
    expect(screen.getByText('Next')).toBeDisabled()
  })

  it('does not render pagination controls for 8 or fewer rows', () => {
    render(<SupportingData table={smallTable} questionLabel="Sales by category" />)
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument()
  })

  it('renders CSV and JSON export buttons', () => {
    render(<SupportingData table={smallTable} questionLabel="Sales by category" />)
    expect(screen.getByText('CSV')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()
  })
})
