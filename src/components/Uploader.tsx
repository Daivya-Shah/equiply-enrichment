import { useCallback, useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import Papa from 'papaparse'
import type { RawRow } from '../types'

type UploaderProps = {
  onParsed: (rows: RawRow[]) => void
  disabled?: boolean
}

function normalizeHeader(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_')
}

function rowToRawRow(record: Record<string, string>): RawRow | null {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeHeader(key)] = String(value ?? '').trim()
  }

  const manufacturer = normalized.manufacturer ?? ''
  const model = normalized.model ?? ''
  const serial_number =
    normalized.serial_number ?? normalized.serial ?? normalized.serial_no ?? ''

  if (!manufacturer && !model && !serial_number) return null

  return { manufacturer, model, serial_number }
}

export function Uploader({ onParsed, disabled }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const parseFile = useCallback(
    (file: File) => {
      setError(null)
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please upload a .csv file')
        return
      }

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(results.errors[0]?.message ?? 'Failed to parse CSV')
            return
          }

          const rows = results.data
            .map(rowToRawRow)
            .filter((row): row is RawRow => row !== null)

          if (rows.length === 0) {
            setError('No valid equipment rows found in CSV')
            return
          }

          setFileName(file.name)
          onParsed(rows)
        },
        error: (err) => {
          setError(err.message)
        },
      })
    },
    [onParsed],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (disabled) return
      const file = e.dataTransfer.files[0]
      if (file) parseFile(file)
    },
    [disabled, parseFile],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) parseFile(file)
      e.target.value = ''
    },
    [parseFile],
  )

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
          dragOver
            ? 'border-green-600 bg-green-50'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
          disabled ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
      >
        <Upload className="mb-3 h-10 w-10 text-slate-400" />
        <p className="text-sm font-medium text-slate-700">
          Drag and drop your equipment CSV here
        </p>
        <p className="mt-1 text-xs text-slate-500">or click to browse (.csv)</p>
        {fileName && (
          <p className="mt-3 text-xs font-medium text-green-600">{fileName}</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFileChange}
        disabled={disabled}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
