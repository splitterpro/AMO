import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'
import './CsvUpload.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; result: { rows: number; columns: number } }

function CsvUpload() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [isDragActive, setIsDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setStatus({ kind: 'error', message: 'Please select a .csv file.' })
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields?.length ?? 0
        const rows = results.data.length
        if (columns === 0 || rows === 0) {
          setStatus({ kind: 'error', message: 'The CSV file appears to be empty.' })
          return
        }
        if (results.errors.length > 0) {
          setStatus({ kind: 'error', message: results.errors[0].message })
          return
        }
        setStatus({ kind: 'success', result: { rows, columns } })
      },
      error: (err) => {
        setStatus({ kind: 'error', message: err.message })
      },
    })
  }, [])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0])
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const reset = () => setStatus({ kind: 'idle' })

  if (status.kind === 'success') {
    return (
      <div className="csv-result">
        <p>Rows: {status.result.rows}</p>
        <p>Columns: {status.result.columns}</p>
        <button onClick={reset}>Upload another file</button>
      </div>
    )
  }

  return (
    <div>
      <div
        className={`csv-dropzone ${isDragActive ? 'active' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragActive(true)
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <p>Drag and drop a .csv file here, or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onInputChange}
          hidden
        />
      </div>
      {status.kind === 'error' && <p className="csv-error">{status.message}</p>}
    </div>
  )
}

export default CsvUpload
