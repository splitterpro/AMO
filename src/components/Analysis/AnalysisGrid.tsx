import { useState } from 'react'
import type { AnalysisQuestion } from '../../types/analysis'
import AnalysisCard from './AnalysisCard'
import AnalysisDetailPanel from './AnalysisDetailPanel'
import './AnalysisGrid.css'

interface AnalysisGridProps {
  datasetId: string
  questions: AnalysisQuestion[]
}

function AnalysisGrid({ datasetId, questions }: AnalysisGridProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const handleSelect = (questionId: number) => {
    setSelectedId((current) => (current === questionId ? null : questionId))
  }

  if (questions.length === 0) {
    return <p className="analysis-grid-empty">No analyses match your filters.</p>
  }

  const selectedQuestion = questions.find((q) => q.id === selectedId) ?? null

  return (
    <>
      <div className="analysis-grid">
        {questions.map((question) => (
          <AnalysisCard
            key={question.id}
            question={question}
            selected={selectedId === question.id}
            onSelect={handleSelect}
          />
        ))}
      </div>
      <AnalysisDetailPanel question={selectedQuestion} datasetId={datasetId} onClose={() => setSelectedId(null)} />
    </>
  )
}

export default AnalysisGrid
