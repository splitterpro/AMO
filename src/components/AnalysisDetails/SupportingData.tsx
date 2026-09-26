import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react'
import { downloadCsv, downloadJson, slugify } from '../../utils/exportData'
import { formatNumber } from '../../utils/format'
import { columnLabel, isPercentField } from './fieldLabels'
import './SupportingData.css'

const PAGE_SIZE = 8

type SortDirection = 'asc' | 'desc' | null

interface SortState {
  key: string | null
  direction: SortDirection
}

interface SupportingDataProps {
  table: Record<string, unknown>[]
  questionLabel: string
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  const numA = Number(a)
  const numB = Number(b)
  if (!Number.isNaN(numA) && !Number.isNaN(numB)) return numA - numB
  return String(a).localeCompare(String(b))
}

function formatCell(key: string, value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'number') {
    return isPercentField(key) ? `${formatNumber(value)}%` : formatNumber(value)
  }
  return String(value)
}

function SupportingData({ table, questionLabel }: SupportingDataProps) {
  const [sort, setSort] = useState<SortState>({ key: null, direction: null })
  const [page, setPage] = useState(0)

  useEffect(() => {
    setPage(0)
    setSort({ key: null, direction: null })
  }, [table])

  const columns = table.length > 0 ? Object.keys(table[0]) : []

  const sortedTable = useMemo(() => {
    if (!sort.key || !sort.direction) return table
    const key = sort.key
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...table].sort((a, b) => factor * compareValues(a[key], b[key]))
  }, [table, sort])

  const pageCount = Math.ceil(sortedTable.length / PAGE_SIZE)
  const pagedTable = sortedTable.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const handleHeaderClick = (key: string) => {
    setSort((current) => {
      if (current.key !== key) return { key, direction: 'asc' }
      if (current.direction === 'asc') return { key, direction: 'desc' }
      return { key: null, direction: null }
    })
  }

  const filenameBase = slugify(questionLabel)

  if (table.length === 0) {
    return <p className="supporting-data-empty">No data to display.</p>
  }

  return (
    <div className="supporting-data">
      <div className="supporting-data-header">
        <span className="supporting-data-title">Supporting data</span>
        <div className="supporting-data-export">
          <button type="button" onClick={() => downloadCsv(filenameBase, sortedTable)}>
            <Download size={14} strokeWidth={2} /> CSV
          </button>
          <button type="button" onClick={() => downloadJson(filenameBase, sortedTable)}>
            <Download size={14} strokeWidth={2} /> JSON
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((key) => {
              const active = sort.key === key
              const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
              return (
                <th key={key}>
                  <button type="button" className="supporting-data-sort" onClick={() => handleHeaderClick(key)}>
                    {columnLabel(key)}
                    <Icon size={12} strokeWidth={2} className={active ? 'active' : ''} />
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {pagedTable.map((row, i) => (
            <tr key={i}>
              {columns.map((key) => <td key={key}>{formatCell(key, row[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {pageCount > 1 && (
        <div className="supporting-data-pagination">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}

export default SupportingData
