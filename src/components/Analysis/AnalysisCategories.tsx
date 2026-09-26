import type { AnalysisCategory } from '../../types/analysis'
import { CATEGORY_STYLE } from './categoryStyle'
import './AnalysisCategories.css'

interface AnalysisCategoriesProps {
  categories: AnalysisCategory[]
  counts: Partial<Record<AnalysisCategory, number>>
  totalCount: number
  selected: AnalysisCategory | 'All'
  onSelect: (category: AnalysisCategory | 'All') => void
}

function AnalysisCategories({ categories, counts, totalCount, selected, onSelect }: AnalysisCategoriesProps) {
  return (
    <div className="analysis-categories">
      <button
        type="button"
        className={`analysis-category-pill ${selected === 'All' ? 'active' : ''}`}
        onClick={() => onSelect('All')}
      >
        All <span className="analysis-category-count">{totalCount}</span>
      </button>
      {categories.map((category) => {
        const style = CATEGORY_STYLE[category]
        const active = selected === category
        return (
          <button
            key={category}
            type="button"
            className={`analysis-category-pill ${active ? 'active' : ''}`}
            style={active ? { color: style.color, background: style.background, borderColor: style.color } : undefined}
            onClick={() => onSelect(category)}
          >
            {category} <span className="analysis-category-count">{counts[category] ?? 0}</span>
          </button>
        )
      })}
    </div>
  )
}

export default AnalysisCategories
