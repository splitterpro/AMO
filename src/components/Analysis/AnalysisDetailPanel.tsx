import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDispatch, useSelector } from 'react-redux'
import { X } from 'lucide-react'
import type { AppDispatch, RootState } from '../../store'
import type { AnalysisQuestion } from '../../types/analysis'
import { askQuestion } from '../../features/questions/questionsSlice'
import AnalysisChart from '../AnalysisDetails/AnalysisChart'
import AnalysisSummaryStats from '../AnalysisDetails/AnalysisSummaryStats'
import KeyInsight from '../AnalysisDetails/KeyInsight'
import SupportingData from '../AnalysisDetails/SupportingData'
import CalculationDetailsPanel from '../AnalysisDetails/CalculationDetailsPanel'
import { CATEGORY_STYLE, CATEGORY_STYLE_FALLBACK } from './categoryStyle'
import './AnalysisDetailPanel.css'

interface AnalysisDetailPanelProps {
  question: AnalysisQuestion | null
  datasetId: string
  onClose: () => void
}

function AnalysisDetailPanel({ question, datasetId, onClose }: AnalysisDetailPanelProps) {
  const dispatch = useDispatch<AppDispatch>()
  const isOpen = question != null

  // Keep showing the last-selected question's content while the panel slides
  // closed, instead of clearing it as soon as `question` becomes null.
  const [displayedQuestion, setDisplayedQuestion] = useState<AnalysisQuestion | null>(null)
  useEffect(() => {
    if (question) setDisplayedQuestion(question)
  }, [question])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  const state = useSelector((s: RootState) => (displayedQuestion ? s.questions[displayedQuestion.id] : undefined))

  useEffect(() => {
    if (displayedQuestion && !state) {
      dispatch(askQuestion({ datasetId, questionId: displayedQuestion.id }))
    }
  }, [displayedQuestion, state, dispatch, datasetId])

  const style = displayedQuestion ? (CATEGORY_STYLE[displayedQuestion.category] ?? CATEGORY_STYLE_FALLBACK) : null
  const Icon = style?.icon

  return createPortal(
    <>
      <div className={`analysis-panel-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`analysis-panel ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true">
        {displayedQuestion && (
          <>
            <div className="analysis-panel-header">
              <div className="analysis-panel-heading">
                {Icon && (
                  <span className="analysis-panel-icon" style={{ color: style!.color, background: style!.background }}>
                    <Icon size={22} strokeWidth={2} />
                  </span>
                )}
                <div>
                  <span className="analysis-panel-category">{displayedQuestion.category}</span>
                  <h3 className="analysis-panel-title">{displayedQuestion.label}</h3>
                  <p className="analysis-panel-description">{displayedQuestion.description}</p>
                </div>
              </div>
              <button type="button" className="analysis-panel-close" onClick={onClose} aria-label="Close panel">
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="analysis-panel-body">
              {state?.status === 'loading' && <p>Thinking…</p>}
              {state?.status === 'error' && <p className="error">{state.error}</p>}
              {state?.status === 'success' && (
                <>
                  {state.visualization && (
                    <AnalysisChart visualization={state.visualization} calculation={state.calculation} />
                  )}
                  {state.visualization && (
                    <AnalysisSummaryStats visualization={state.visualization} calculation={state.calculation} />
                  )}
                  <KeyInsight text={state.answer ?? ''} />
                  {state.table != null && <SupportingData table={state.table} questionLabel={displayedQuestion.label} />}
                  {state.calculation && <CalculationDetailsPanel calculation={state.calculation} />}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}

export default AnalysisDetailPanel
