import { ChevronRight } from 'lucide-react'
import type { AnalysisQuestion } from '../../types/analysis'
import { CATEGORY_STYLE, CATEGORY_STYLE_FALLBACK } from './categoryStyle'
import './AnalysisCard.css'

interface AnalysisCardProps {
  question: AnalysisQuestion
  selected: boolean
  onSelect: (questionId: number) => void
}

function AnalysisCard({ question, selected, onSelect }: AnalysisCardProps) {
  const style = CATEGORY_STYLE[question.category] ?? CATEGORY_STYLE_FALLBACK
  const Icon = style.icon

  return (
    <div className={`analysis-card ${selected ? 'expanded' : ''}`}>
      <button type="button" title={question.question} onClick={() => onSelect(question.id)}>
        <span className="analysis-card-icon" style={{ color: style.color, background: style.background }}>
          <Icon size={24} strokeWidth={2} />
        </span>
        <span className="analysis-card-text">
          <span className="analysis-card-category">{question.category}</span>
          <span className="analysis-card-label">{question.label}</span>
          <span className="analysis-card-description">{question.description}</span>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="analysis-card-chevron" />
      </button>
    </div>
  )
}

export default AnalysisCard
