import { Search } from 'lucide-react'
import './AnalysisSearch.css'

interface AnalysisSearchProps {
  value: string
  onChange: (value: string) => void
}

function AnalysisSearch({ value, onChange }: AnalysisSearchProps) {
  return (
    <div className="analysis-search">
      <Search size={16} strokeWidth={2} className="analysis-search-icon" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search analyses…"
      />
    </div>
  )
}

export default AnalysisSearch
