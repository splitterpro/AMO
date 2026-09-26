import { useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Upload } from 'lucide-react'
import type { AppDispatch, RootState } from '../store'
import { reset, uploadCsv } from '../features/csvUpload/csvUploadSlice'
import { resetQuestions } from '../features/questions/questionsSlice'
import DatasetHeader from './Dataset/DatasetHeader'
import DatasetMetrics from './Dataset/DatasetMetrics'
import ExploreData from './Analysis/ExploreData'
import './CsvUpload.css'

function CsvUpload() {
  const status = useSelector((state: RootState) => state.csvUpload)
  const dispatch = useDispatch<AppDispatch>()
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | undefined) => {
    if (file) dispatch(uploadCsv(file))
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleRemove = () => {
    dispatch(reset())
    dispatch(resetQuestions())
  }

  if (status.kind === 'success') {
    return (
      <div className="csv-result">
        <div className="csv-hero">
          <span className="csv-hero-eyebrow">Data analysis</span>
          <h1>Your data is ready!</h1>
          <p>Explore key insights from your CSV file with analyses tailored to your data.</p>
        </div>

        <DatasetHeader
          fileName={status.fileName}
          fileSize={status.fileSize}
          rows={status.result.rows}
          columns={status.result.columns}
          onRemove={handleRemove}
        />

        <DatasetMetrics metrics={status.result.metrics} rowsAnalyzed={status.result.rows} />

        <ExploreData datasetId={status.result.dataset_id} questions={status.result.questions} />
      </div>
    )
  }

  return (
    <div>
      <div
        className={`csv-dropzone ${isDragActive ? 'active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <Upload size={28} strokeWidth={1.75} className="csv-dropzone-icon" />
        <p>{status.kind === 'loading' ? 'Uploading…' : 'Drag and drop a .csv file here, or click to browse'}</p>
        <input ref={inputRef} type="file" accept=".csv" onChange={onInputChange} hidden />
      </div>
      {status.kind === 'error' && <p className="csv-error">{status.message}</p>}
    </div>
  )
}

export default CsvUpload
