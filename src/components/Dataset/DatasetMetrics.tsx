import { useState } from 'react'
import { ChevronDown, Fingerprint, Sigma, type LucideIcon } from 'lucide-react'
import type { Metric } from '../../types/analysis'
import { formatNumber } from '../../utils/format'
import './DatasetMetrics.css'

const METRIC_OPERATION_LABEL: Record<Metric['type'], string> = {
  sum: 'SUM',
  unique_count: 'UNIQUE COUNT',
}

const METRIC_ICON: Record<Metric['type'], LucideIcon> = {
  sum: Sigma,
  unique_count: Fingerprint,
}

const CALCULATED_BY = 'pandas'

interface DatasetMetricsProps {
  metrics: Metric[]
  rowsAnalyzed: number
}

function DatasetMetrics({ metrics, rowsAnalyzed }: DatasetMetricsProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (metrics.length === 0) return null

  return (
    <div className="dataset-metrics">
      {metrics.map((metric) => {
        const key = `${metric.type}-${metric.column}`
        const expanded = expandedKey === key
        const Icon = METRIC_ICON[metric.type]
        return (
          <div key={key} className={`dataset-metric-card ${expanded ? 'expanded' : ''}`}>
            <button type="button" onClick={() => setExpandedKey(expanded ? null : key)}>
              <span className="dataset-metric-icon">
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="dataset-metric-text">
                <span className="dataset-metric-value">{formatNumber(metric.value)}</span>
                <span className="dataset-metric-label">{metric.label}</span>
              </span>
              <ChevronDown size={16} strokeWidth={2} className="dataset-metric-chevron" />
            </button>
            {expanded && (
              <dl className="dataset-metric-detail">
                <dt>Operation</dt>
                <dd>{METRIC_OPERATION_LABEL[metric.type]}</dd>
                <dt>Column</dt>
                <dd>{metric.column}</dd>
                <dt>Rows analyzed</dt>
                <dd>{formatNumber(rowsAnalyzed)}</dd>
                <dt>Calculated by</dt>
                <dd>{CALCULATED_BY}</dd>
              </dl>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DatasetMetrics
