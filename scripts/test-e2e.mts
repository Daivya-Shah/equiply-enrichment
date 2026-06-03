import Papa from 'papaparse'
import { readFileSync } from 'node:fs'
import { enrichRow, sortRowsByManufacturedDate } from '../src/lib/enrichRow.ts'

const csvPath = new URL('../public/sample-equipment.csv', import.meta.url)
const csv = readFileSync(csvPath, 'utf-8')
const parsed = Papa.parse<{ manufacturer: string; model: string; serial_number: string }>(
  csv,
  { header: true, skipEmptyLines: true },
)

const rows = parsed.data
console.log('=== E2E enrichment flow (3-row sample CSV) ===\n')

const enriched = []
for (const row of rows) {
  enriched.push(await enrichRow(row))
}

const sorted = sortRowsByManufacturedDate(enriched)

console.log('1) Enriched rows (table data)')
console.table(
  sorted.map((r) => ({
    manufacturer: r.manufacturer,
    model: r.model,
    device_type: r.device_type,
    manufactured_date: r.manufactured_date,
    confidence: `${(r.confidence * 100).toFixed(0)}%`,
    source: r.source,
  })),
)

const deviceTypes = new Set(sorted.map((r) => r.device_type).filter(Boolean))
console.log(`\n2) Pie chart: ${deviceTypes.size} unique device type(s)`)
for (const [name, count] of Object.entries(
  sorted.reduce<Record<string, number>>((acc, r) => {
    const k = r.device_type ?? 'Unknown'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {}),
)) {
  const pct = ((count / sorted.length) * 100).toFixed(1)
  console.log(`   - ${name}: ${count} (${pct}%)`)
}

const yearCounts = sorted.reduce<Record<string, number>>((acc, r) => {
  if (!r.manufactured_date) return acc
  const y = r.manufactured_date.slice(0, 4)
  acc[y] = (acc[y] ?? 0) + 1
  return acc
}, {})
console.log('\n3) Fleet age bar chart years:')
for (const [year, count] of Object.entries(yearCounts).sort()) {
  console.log(`   - ${year}: ${count} device(s)`)
}

const exportCsv = Papa.unparse(
  sorted.map((row) => ({
    manufacturer: row.manufacturer,
    model: row.model,
    serial_number: row.serial_number,
    manufactured_date: row.manufactured_date ?? '',
    device_type: row.device_type ?? '',
    confidence: row.confidence,
    source: row.source,
    notes: row.notes,
  })),
)
console.log('\n4) Export CSV preview (first 400 chars):')
console.log(exportCsv.slice(0, 400))

const withData = sorted.filter((r) => r.device_type && r.manufactured_date).length
console.log(`\n✓ ${withData}/3 rows enriched with device_type + manufactured_date`)
console.log(`✓ Sorted asc dates: ${sorted.map((r) => r.manufactured_date).join(' → ')}`)
