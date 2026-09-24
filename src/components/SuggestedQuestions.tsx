import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  ChartNoAxesCombined,
  ChevronDown,
  LayoutGrid,
  MapPin,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { AppDispatch, RootState } from '../store'
import type { SuggestedQuestion } from '../constants/questions'
import { askQuestion } from '../features/questions/questionsSlice'
import './SuggestedQuestions.css'

const CARD_STYLES: { icon: LucideIcon; color: string; background: string }[] = [
  { icon: TrendingDown, color: 'var(--danger)', background: 'var(--danger-soft)' },
  { icon: Tag, color: 'var(--warning)', background: 'var(--warning-soft)' },
  { icon: MapPin, color: 'var(--primary)', background: 'var(--primary-soft)' },
  { icon: Star, color: 'var(--primary)', background: 'var(--primary-soft)' },
  { icon: UsersRound, color: 'var(--success)', background: 'var(--success-soft)' },
  { icon: ChartNoAxesCombined, color: 'var(--info)', background: 'var(--info-soft)' },
]
const FALLBACK_STYLE = { icon: Sparkles, color: 'var(--primary)', background: 'var(--primary-soft)' }

function SuggestedQuestions({ datasetId, questions }: { datasetId: string; questions: SuggestedQuestion[] }) {
  const dispatch = useDispatch<AppDispatch>()
  const answers = useSelector((state: RootState) => state.questions)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (questions.length === 0) {
    return (
      <div className="suggested-questions">
        <h2>
          <LayoutGrid size={18} strokeWidth={2} />
          Suggested analyses
        </h2>
        <p className="suggested-questions-subtitle">
          We couldn't generate suggested analyses for this file. Try again in a moment.
        </p>
      </div>
    )
  }

  const handleClick = (questionId: number) => {
    if (expandedId === questionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(questionId)
    if (!answers[questionId]) {
      dispatch(askQuestion({ datasetId, questionId }))
    }
  }

  return (
    <div className="suggested-questions">
      <h2>
        <LayoutGrid size={18} strokeWidth={2} />
        Suggested analyses
      </h2>
      <p className="suggested-questions-subtitle">Click on a topic to explore insights from your data.</p>
      <div className="suggested-questions-grid">
        {questions.map((q, index) => {
          const state = answers[q.id]
          const expanded = expandedId === q.id
          const style = CARD_STYLES[index % CARD_STYLES.length] ?? FALLBACK_STYLE
          const Icon = style.icon
          return (
            <div key={q.id} className={`suggested-question-card ${expanded ? 'expanded' : ''}`}>
              <button type="button" title={q.question} onClick={() => handleClick(q.id)}>
                <span className="suggested-question-icon" style={{ color: style.color, background: style.background }}>
                  <Icon size={24} strokeWidth={2} />
                </span>
                <span className="suggested-question-text">
                  <span className="suggested-question-label">{q.label}</span>
                  <span className="suggested-question-description">{q.description}</span>
                </span>
                <ChevronDown size={18} strokeWidth={2} className="suggested-question-chevron" />
              </button>
              {expanded && (
                <div className="suggested-question-answer">
                  {state?.status === 'loading' && <p>Thinking…</p>}
                  {state?.status === 'error' && <p className="error">{state.error}</p>}
                  {state?.status === 'success' && (
                    <>
                      <p>{state.answer}</p>
                      {state.table && state.table.length > 0 && (
                        <table>
                          <thead>
                            <tr>
                              {Object.keys(state.table[0]).map((k) => <th key={k}>{k}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {state.table.map((row, i) => (
                              <tr key={i}>
                                {Object.keys(row).map((k) => <td key={k}>{String(row[k])}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default SuggestedQuestions
