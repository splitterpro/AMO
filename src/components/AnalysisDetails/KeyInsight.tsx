import { Sparkles } from 'lucide-react'
import './KeyInsight.css'

interface KeyInsightProps {
  text: string
}

function KeyInsight({ text }: KeyInsightProps) {
  return (
    <div className="key-insight">
      <span className="key-insight-icon">
        <Sparkles size={16} strokeWidth={2} />
      </span>
      <div className="key-insight-body">
        <span className="key-insight-label">Key insight</span>
        <p className="key-insight-text">{text}</p>
      </div>
    </div>
  )
}

export default KeyInsight
