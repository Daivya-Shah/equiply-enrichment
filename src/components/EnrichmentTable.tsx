import { useMemo, useState } from 'react'
import type { EnrichedRow } from '../types'
import { sortRowsByManufacturedDate } from '../lib/enrichRow'
import { NotesTooltip } from './NotesTooltip'

type ConfFilter = 'all' | 'high' | 'med' | 'low'

type EnrichmentTableProps = {
  rows: EnrichedRow[]
  isLoading?: boolean
}

function isPendingRow(row: EnrichedRow, isLoading: boolean): boolean {
  return isLoading && row.source === 'none' && row.confidence === 0
}

function ConfBadge({ confidence }: { confidence: number }) {
  if (confidence === 0) return <span className="text-slate-300">—</span>
  const pct = Math.round(confidence * 100)
  const cls =
    confidence >= 0.8
      ? 'bg-green-100 text-green-700'
      : confidence >= 0.65
        ? 'bg-blue-100 text-blue-700'
        : 'bg-amber-100 text-amber-800'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {pct}%
    </span>
  )
}

const cell = 'px-3 py-2 align-middle border-r border-slate-100 last:border-r-0'
const headerCell =
  'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-100 last:border-r-0 bg-slate-50 whitespace-nowrap'

export function EnrichmentTable({ rows, isLoading = false }: EnrichmentTableProps) {
  const [confFilter, setConfFilter] = useState<ConfFilter>('all')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  const sortedRows = useMemo(() => sortRowsByManufacturedDate(rows), [rows])

  const deviceTypes = useMemo(() => {
    const types = new Set<string>()
    for (const row of sortedRows) {
      if (row.device_type) types.add(row.device_type)
    }
    return Array.from(types).sort()
  }, [sortedRows])

  const filteredRows = useMemo(() => {
    let result = sortedRows

    if (confFilter === 'high') result = result.filter((r) => r.confidence >= 0.8)
    else if (confFilter === 'med') result = result.filter((r) => r.confidence >= 0.65 && r.confidence < 0.8)
    else if (confFilter === 'low') result = result.filter((r) => r.confidence > 0 && r.confidence < 0.65)

    if (deviceTypeFilter !== 'all') {
      result = result.filter((r) => r.device_type === deviceTypeFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.manufacturer.toLowerCase().includes(q) ||
          r.model.toLowerCase().includes(q) ||
          r.serial_number.toLowerCase().includes(q),
      )
    }

    return result
  }, [sortedRows, confFilter, deviceTypeFilter, search])

  const confButtons: { id: ConfFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'high', label: '≥80%' },
    { id: 'med', label: '65–80%' },
    { id: 'low', label: '<65%' },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
        <input
          type="text"
          placeholder="Search manufacturer, model or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[200px] flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-green-400 focus:ring-2 focus:ring-green-500/20"
        />

        <select
          value={deviceTypeFilter}
          onChange={(e) => setDeviceTypeFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-green-400"
        >
          <option value="all">All types</option>
          {deviceTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {confButtons.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setConfFilter(id)}
              className={[
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                confFilter === id
                  ? 'border border-green-600 bg-green-600 text-white'
                  : 'border border-green-600 text-green-600 hover:bg-green-600 hover:text-white',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="ml-auto shrink-0 text-xs text-slate-400">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-auto" style={{ maxHeight: '480px' }}>
        <table className="w-full border-collapse text-left text-sm" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '21%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '9%' }} />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200">
              <th className={headerCell}>Manufacturer</th>
              <th className={headerCell}>Model</th>
              <th className={headerCell}>Serial</th>
              <th className={headerCell}>Device Type</th>
              <th className={headerCell}>Mfg. Date</th>
              <th className={headerCell}>Conf.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                  No devices match these filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, index) => {
                const pending = isPendingRow(row, isLoading)
                return (
                  <tr
                    key={`${row.serial_number}-${index}`}
                    className={pending ? 'animate-pulse bg-slate-50' : 'hover:bg-slate-50/70'}
                  >
                    <td className={`${cell} overflow-hidden`}>
                      <span className="block truncate font-medium text-slate-900">
                        {pending ? '…' : row.manufacturer}
                      </span>
                    </td>
                    <td className={`${cell} overflow-hidden`}>
                      <span className="block truncate text-slate-600">
                        {pending ? '…' : row.model}
                      </span>
                    </td>
                    <td className={`${cell} overflow-hidden`}>
                      <span className="block truncate font-mono text-xs text-slate-500">
                        {pending ? '…' : row.serial_number}
                      </span>
                    </td>
                    <td className={`${cell} overflow-hidden`}>
                      <span className="block truncate text-slate-700">
                        {pending ? '…' : (row.device_type ?? '—')}
                      </span>
                    </td>
                    <td className={`${cell} whitespace-nowrap font-mono text-xs text-slate-600`}>
                      {pending ? '…' : (row.manufactured_date ?? '—')}
                    </td>
                    <td className={cell}>
                      {pending ? '…' : (
                        <div className="flex items-center gap-1.5">
                          <ConfBadge confidence={row.confidence} />
                          <NotesTooltip notes={row.notes} />
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
