import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { QUESTIONS } from '../constants/questions'
import { askQuestion } from '../features/questions/questionsSlice'
import './SuggestedQuestions.css'

function SuggestedQuestions({ datasetId }: { datasetId: string }) {
  const dispatch = useDispatch<AppDispatch>()
  const answers = useSelector((state: RootState) => state.questions)
  const [expandedId, setExpandedId] = useState<number | null>(null)

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
      <h2>Suggested questions</h2>
      <div className="suggested-questions-grid">
        {QUESTIONS.map((q) => {
          const state = answers[q.id]
          const expanded = expandedId === q.id
          return (
            <div key={q.id} className="suggested-question-card">
              <button type="button" title={q.question} onClick={() => handleClick(q.id)}>
                {q.label}
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
