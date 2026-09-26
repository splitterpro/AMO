import { useMemo, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import type { AnalysisCategory, AnalysisQuestion } from '../../types/analysis'
import { CATEGORY_ORDER } from './categoryStyle'
import AnalysisCategories from './AnalysisCategories'
import AnalysisSearch from './AnalysisSearch'
import AnalysisGrid from './AnalysisGrid'
import './ExploreData.css'

interface ExploreDataProps {
  datasetId: string
  questions: AnalysisQuestion[]
}

function matchesSearch(question: AnalysisQuestion, query: string): boolean {
  if (!query) return true
  const haystack = `${question.label} ${question.question} ${question.description}`.toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function ExploreData({ datasetId, questions }: ExploreDataProps) {
  const [selectedCategory, setSelectedCategory] = useState<AnalysisCategory | 'All'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  const counts = useMemo(() => {
    const result: Partial<Record<AnalysisCategory, number>> = {}
    for (const q of questions) {
      result[q.category] = (result[q.category] ?? 0) + 1
    }
    return result
  }, [questions])

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((category) => (counts[category] ?? 0) > 0),
    [counts],
  )

  const filteredQuestions = useMemo(
    () =>
      questions.filter(
        (q) => (selectedCategory === 'All' || q.category === selectedCategory) && matchesSearch(q, searchQuery),
      ),
    [questions, selectedCategory, searchQuery],
  )

  if (questions.length === 0) {
    return (
      <div className="explore-data">
        <h2>
          <LayoutGrid size={18} strokeWidth={2} />
          Explore your data
        </h2>
        <p className="explore-data-subtitle">
          We couldn't generate suggested analyses for this file. Try again in a moment.
        </p>
      </div>
    )
  }

  return (
    <div className="explore-data">
      <h2>
        <LayoutGrid size={18} strokeWidth={2} />
        Explore your data
      </h2>
      <p className="explore-data-subtitle">Discover trends, comparisons and patterns.</p>
      <AnalysisCategories
        categories={availableCategories}
        counts={counts}
        totalCount={questions.length}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />
      <AnalysisSearch value={searchQuery} onChange={setSearchQuery} />
      <AnalysisGrid datasetId={datasetId} questions={filteredQuestions} />
    </div>
  )
}

export default ExploreData
