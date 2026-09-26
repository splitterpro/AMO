import type { CalculationDetails, Visualization } from '../../types/analysis'
import { formatCompactNumber } from '../../utils/format'
import { resolveSeriesKeys } from './fieldLabels'
import './AnalysisSummaryStats.css'

const NON_ADDITIVE_AGGREGATIONS = new Set(['AVERAGE', 'MEDIAN', 'MIN', 'MAX', 'BINNED_AVERAGE'])

interface AnalysisSummaryStatsProps {
  visualization: Visualization
  calculation?: CalculationDetails
}

function AnalysisSummaryStats({ visualization, calculation }: AnalysisSummaryStatsProps) {
  const { type, data } = visualization
  if (type === 'kpi' || data.length === 0) return null

  const { yKey } = resolveSeriesKeys(data[0])
  const values = data.map((row) => Number(row[yKey])).filter((n) => !Number.isNaN(n))
  if (values.length === 0) return null

  const total = values.reduce((sum, n) => sum + n, 0)
  const average = total / values.length
  const showTotal = !NON_ADDITIVE_AGGREGATIONS.has(calculation?.aggregation ?? '')

  let change: number | null = null
  if (type === 'line' && data.length >= 2) {
    const first = values[0]
    const last = values[values.length - 1]
    if (first !== 0) change = ((last - first) / first) * 100
  }

  const tiles: { label: string; value: string; color?: string }[] = []
  if (showTotal) tiles.push({ label: 'Total', value: formatCompactNumber(total) })
  tiles.push({ label: 'Average', value: formatCompactNumber(average) })
  tiles.push({ label: 'Count', value: formatCompactNumber(values.length) })
  if (change !== null) {
    tiles.push({
      label: 'Change',
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      color: change >= 0 ? 'var(--success)' : 'var(--danger)',
    })
  }

  return (
    <div className="analysis-summary-stats">
      {tiles.map((tile) => (
        <div key={tile.label} className="analysis-summary-stat">
          <span className="analysis-summary-stat-value" style={tile.color ? { color: tile.color } : undefined}>
            {tile.value}
          </span>
          <span className="analysis-summary-stat-label">{tile.label}</span>
        </div>
      ))}
    </div>
  )
}

export default AnalysisSummaryStats
