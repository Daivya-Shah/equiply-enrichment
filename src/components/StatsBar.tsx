import { useMemo } from 'react'
import type { EnrichedRow } from '../types'

type StatsBarProps = {
  rows: EnrichedRow[]
}

function yearFromDate(date: string | null): number | null {
  if (!date) return null
  const year = Number.parseInt(date.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

export function StatsBar({ rows }: StatsBarProps) {
  const stats = useMemo(() => {
    const total = rows.length
    const highConf = rows.filter((r) => r.confidence >= 0.8).length
    const medConf = rows.filter((r) => r.confidence >= 0.65 && r.confidence < 0.8).length
    const lowConf = rows.filter((r) => r.confidence > 0 && r.confidence < 0.65).length
    const enriched = highConf + medConf + lowConf

    const years = rows
      .map((r) => yearFromDate(r.manufactured_date))
      .filter((y): y is number => y !== null)

    const oldest = years.length > 0 ? Math.min(...years) : null
    const newest = years.length > 0 ? Math.max(...years) : null

    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

    return {
      total,
      enriched,
      enrichedPct: pct(enriched),
      highConf,
      highPct: pct(highConf),
      medConf,
      medPct: pct(medConf),
      lowConf,
      lowPct: pct(lowConf),
      oldest,
      newest,
    }
  }, [rows])

  const fleetSpan =
    stats.oldest !== null && stats.newest !== null
      ? `${stats.oldest} – ${stats.newest}`
      : '—'

  return (
    <div className="grid grid-cols-4 gap-3">
      {/* Total */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Total Devices</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{stats.total}</p>
      </div>

      {/* Enrichment quality — spans 2 cols */}
      <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-5 py-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Enrichment Quality</p>
          <span className="text-xs font-semibold text-slate-600">{stats.enrichedPct}% enriched</span>
        </div>

        {/* Segmented bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {stats.highPct > 0 && (
            <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${stats.highPct}%` }} />
          )}
          {stats.medPct > 0 && (
            <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${stats.medPct}%` }} />
          )}
          {stats.lowPct > 0 && (
            <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${stats.lowPct}%` }} />
          )}
        </div>

        {/* Legend */}
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-green-600" />
            High ≥80%
            <span className="font-semibold text-slate-800">{stats.highPct}%</span>
            <span className="text-slate-400">({stats.highConf})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-400" />
            Med 65–80%
            <span className="font-semibold text-slate-800">{stats.medPct}%</span>
            <span className="text-slate-400">({stats.medConf})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            Low &lt;65%
            <span className="font-semibold text-slate-800">{stats.lowPct}%</span>
            <span className="text-slate-400">({stats.lowConf})</span>
          </span>
        </div>
      </div>

      {/* Fleet span */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Fleet Span</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">{fleetSpan}</p>
        <p className="mt-1 text-xs text-slate-500">oldest to newest</p>
      </div>
    </div>
  )
}
