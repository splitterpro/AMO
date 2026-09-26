import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CalculationDetails, Operation } from '../../types/analysis'
import { formatNumber } from '../../utils/format'
import './CalculationDetailsPanel.css'

const OPERATION_LABEL: Record<Operation, string> = {
  groupby_sum: 'Group by (sum)',
  groupby_mean: 'Group by (average)',
  groupby_count: 'Group by (count)',
  groupby_median: 'Group by (median)',
  groupby_min: 'Group by (minimum)',
  groupby_max: 'Group by (maximum)',
  top_n: 'Top N',
  bottom_n: 'Bottom N',
  trend_daily: 'Trend (daily)',
  trend_weekly: 'Trend (weekly)',
  trend_monthly: 'Trend (monthly)',
  trend_yearly: 'Trend (yearly)',
  percentage_change: 'Percentage change',
  growth_rate: 'Growth rate',
  distribution: 'Distribution',
  standard_deviation: 'Standard deviation',
  correlation: 'Correlation',
  concentration: 'Concentration',
  bin_relationship: 'Binned relationship',
  scatter_relationship: 'Scatter relationship',
}

interface CalculationDetailsPanelProps {
  calculation: CalculationDetails
}

function CalculationDetailsPanel({ calculation }: CalculationDetailsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const columnRows: { label: string; value: string }[] = [
    { label: 'Dimension', value: calculation.dimension_column ?? '' },
    { label: 'Measure', value: calculation.measure_column ?? '' },
    { label: 'Secondary measure', value: calculation.secondary_measure_column ?? '' },
    { label: 'Date column', value: calculation.date_column ?? '' },
  ].filter((row) => row.value)

  return (
    <div className={`calculation-details ${expanded ? 'expanded' : ''}`}>
      <button type="button" onClick={() => setExpanded((e) => !e)}>
        Calculation details
        <ChevronDown size={14} strokeWidth={2} className="calculation-details-chevron" />
      </button>
      {expanded && (
        <dl className="calculation-details-body">
          <dt>Operation</dt>
          <dd>{OPERATION_LABEL[calculation.operation]}</dd>
          {columnRows.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </Fragment>
          ))}
          <dt>Aggregation</dt>
          <dd>{calculation.aggregation}</dd>
          <dt>Rows analyzed</dt>
          <dd>{formatNumber(calculation.rows_analyzed)}</dd>
          <dt>Calculated by</dt>
          <dd>{calculation.calculated_by}</dd>
        </dl>
      )}
    </div>
  )
}

export default CalculationDetailsPanel
