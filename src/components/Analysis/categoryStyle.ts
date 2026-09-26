import { ArrowUpDown, BarChart3, GitCompare, Scale, Sparkles, TrendingUp, type LucideIcon } from 'lucide-react'
import type { AnalysisCategory } from '../../types/analysis'

export const CATEGORY_STYLE: Record<AnalysisCategory, { icon: LucideIcon; color: string; background: string }> = {
  Trends: { icon: TrendingUp, color: 'var(--info)', background: 'var(--info-soft)' },
  Comparisons: { icon: Scale, color: 'var(--warning)', background: 'var(--warning-soft)' },
  'Top & Bottom': { icon: ArrowUpDown, color: 'var(--danger)', background: 'var(--danger-soft)' },
  Relationships: { icon: GitCompare, color: 'var(--success)', background: 'var(--success-soft)' },
  Statistics: { icon: BarChart3, color: 'var(--primary)', background: 'var(--primary-soft)' },
}

export const CATEGORY_STYLE_FALLBACK = { icon: Sparkles, color: 'var(--primary)', background: 'var(--primary-soft)' }

export const CATEGORY_ORDER: AnalysisCategory[] = [
  'Trends',
  'Comparisons',
  'Top & Bottom',
  'Relationships',
  'Statistics',
]
