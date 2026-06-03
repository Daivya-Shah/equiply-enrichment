import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EnrichedRow } from '../types'

const COLORS = [
  '#16a34a',
  '#0891b2',
  '#f59e0b',
  '#7c3aed',
  '#dc2626',
  '#0284c7',
  '#db2777',
  '#059669',
  '#d97706',
  '#4f46e5',
  '#2563eb',
  '#6b7280',
]

type DeviceTypePieProps = {
  rows: EnrichedRow[]
}


export function DeviceTypePie({ rows }: DeviceTypePieProps) {
  const pieData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const key = row.device_type?.trim() || 'Unknown'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .map((entry, index) => ({ ...entry, fill: COLORS[index % COLORS.length] }))
  }, [rows])

  const total = rows.length

  const fleetAgeData = useMemo(() => {
    const counts = new Map<number, number>()
    for (const row of rows) {
      if (!row.manufactured_date) continue
      const year = Number.parseInt(row.manufactured_date.slice(0, 4), 10)
      if (!Number.isFinite(year)) continue
      counts.set(year, (counts.get(year) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([year, count]) => ({ year: String(year), count }))
      .sort((a, b) => Number(a.year) - Number(b.year))
  }, [rows])

  const avgPerYear = fleetAgeData.length
    ? Math.round(fleetAgeData.reduce((s, d) => s + d.count, 0) / fleetAgeData.length)
    : 0

  if (total === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
        Upload and enrich data to see charts.
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Donut: device type distribution ─────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Device Type Distribution</p>
            <p className="mt-0.5 text-xs text-slate-400">{total} devices across {pieData.length} categories</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          {/* Donut */}
          <div className="shrink-0">
            <PieChart width={220} height={220}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx={110}
                cy={110}
                innerRadius={68}
                outerRadius={100}
                strokeWidth={2}
                stroke="#fff"
                paddingAngle={2}
              >
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !('cx' in viewBox)) return null
                    const { cx, cy } = viewBox as { cx: number; cy: number }
                    return (
                      <g>
                        <text x={cx} y={cy - 8} textAnchor="middle" fill="#0f172a" fontSize={30} fontWeight={700} fontFamily="Inter, sans-serif">
                          {total}
                        </text>
                        <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={12} fontFamily="Inter, sans-serif">
                          total
                        </text>
                      </g>
                    )
                  }}
                  position="center"
                />
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const n = typeof value === 'number' ? value : Number(value ?? 0)
                  return [`${n} (${total > 0 ? ((n / total) * 100).toFixed(1) : 0}%)`, String(name ?? '')]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
            </PieChart>
          </div>

          {/* Legend with mini bars */}
          <div className="flex-1 min-w-0 divide-y divide-slate-50">
            {pieData.map((entry, index) => {
              const pct = total > 0 ? (entry.value / total) * 100 : 0
              const color = COLORS[index % COLORS.length]
              return (
                <div key={entry.name} className="flex items-center gap-3 py-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="flex-1 truncate text-sm text-slate-700">{entry.name}</span>
                  <div className="w-20 shrink-0">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-800">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-400">
                    {entry.value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Bar: fleet age distribution ──────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-5">
          <p className="text-sm font-semibold text-slate-800">Fleet Age Distribution</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Devices by manufacture year · avg {avgPerYear}/yr
          </p>
        </div>

        {fleetAgeData.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No dated devices to chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fleetAgeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
                      <p className="text-xs font-semibold text-slate-500">{label}</p>
                      <p className="text-sm font-bold text-slate-900">
                        {payload[0]?.value}{' '}
                        <span className="text-xs font-normal text-slate-400">devices</span>
                      </p>
                    </div>
                  )
                }}
                cursor={{ fill: '#f8fafc', radius: 4 }}
              />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  )
}
