import Papa from 'papaparse'
import { Download } from 'lucide-react'
import type { EnrichedRow } from '../types'
import { sortRowsByManufacturedDate } from '../lib/enrichRow'

type ExportButtonProps = {
  rows: EnrichedRow[]
  status: 'idle' | 'loading' | 'done' | 'error'
}

export function ExportButton({ rows, status }: ExportButtonProps) {
  if (status !== 'done') return null

  const handleExport = () => {
    const sorted = sortRowsByManufacturedDate(rows)
    const csv = Papa.unparse(
      sorted.map((row) => ({
        manufacturer: row.manufacturer,
        model: row.model,
        serial_number: row.serial_number,
        manufactured_date: row.manufactured_date ?? '',
        device_type: row.device_type ?? '',
      })),
    )

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `equiply_enriched_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={rows.length === 0}
      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      Export Enriched CSV
    </button>
  )
}
