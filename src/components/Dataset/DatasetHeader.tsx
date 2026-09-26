import { FileText, X } from 'lucide-react'
import { formatFileSize, formatNumber } from '../../utils/format'
import './DatasetHeader.css'

interface DatasetHeaderProps {
  fileName: string
  fileSize: number
  rows: number
  columns: number
  onRemove: () => void
}

function DatasetHeader({ fileName, fileSize, rows, columns, onRemove }: DatasetHeaderProps) {
  return (
    <div className="csv-file-card">
      <div className="csv-file-icon">
        <FileText size={24} strokeWidth={2} />
      </div>
      <div className="csv-file-info">
        <span className="csv-file-name">{fileName}</span>
        <span className="csv-file-stats">
          {formatNumber(rows)} rows &middot; {formatNumber(columns)} columns &middot; {formatFileSize(fileSize)}
        </span>
      </div>
      <button type="button" className="csv-file-remove" onClick={onRemove}>
        <X size={16} strokeWidth={2} />
        Remove file
      </button>
    </div>
  )
}

export default DatasetHeader
