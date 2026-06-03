/**
 * Full-dataset enrichment stats (requires network + API keys).
 * npx tsx scripts/batch-enrich-stats.mts
 */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { clearEnrichmentCache, enrichRow } from '../src/lib/enrichRow.ts'
import type { RawRow } from '../src/types.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const rows: RawRow[] = data.map((row) => ({
  manufacturer: (row.manufacturer ?? '').trim(),
  model: (row.model ?? '').trim(),
  serial_number: (row['serial number'] ?? row.serial_number ?? '').trim(),
}))

clearEnrichmentCache()
let done = 0
const results = []
for (const row of rows) {
  results.push(await enrichRow(row))
  done++
  if (done % 50 === 0) console.log(`${done}/${rows.length}…`)
}

const withDate = results.filter((r) => r.manufactured_date).length
const withType = results.filter((r) => r.device_type).length
const high = results.filter((r) => r.confidence >= 0.8).length
const review = results.filter(
  (r) =>
    r.confidence < 0.5 ||
    r.source === 'none' ||
    (r.source === 'llm' && r.confidence < 0.7),
).length
const bySource = new Map<string, number>()
for (const r of results) {
  bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
}

console.log('\n=== Enrichment summary ===')
console.log('rows', rows.length)
console.log('with manufactured_date', withDate, `(${((withDate / rows.length) * 100).toFixed(1)}%)`)
console.log('with device_type', withType)
console.log('high confidence (>=0.8)', high, `(${((high / rows.length) * 100).toFixed(1)}%)`)
console.log('needs review (heuristic)', review)
console.log('by source', Object.fromEntries(bySource))
