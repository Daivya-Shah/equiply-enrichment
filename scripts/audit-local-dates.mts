/**
 * Local date audit (serial + model reference + guardrails, no FDA/LLM).
 * npx tsx scripts/audit-local-dates.mts
 */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { applyDateGuardrails, resolveDateBounds } from '../src/lib/dateGuardrails.ts'
import { inferDeviceTypeFromModel } from '../src/lib/deviceRules.ts'
import {
  getModelReferenceConfidence,
  getModelReleaseYear,
} from '../src/lib/modelAnchors.ts'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'
import type { EnrichedRow, RawRow } from '../src/types.ts'

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

function localEnrich(row: RawRow): EnrichedRow {
  const ruleType = inferDeviceTypeFromModel(row.manufacturer, row.model)
  const serialParsed = parseManufactureDateFromSerial(
    row.manufacturer,
    row.model,
    row.serial_number,
  )
  const releaseYear = getModelReleaseYear(row.manufacturer, row.model)

  let manufactured_date: string | null = serialParsed?.manufactured_date ?? null
  let source: EnrichedRow['source'] = serialParsed ? 'serial_parse' : 'none'
  let confidence = serialParsed?.confidence ?? 0.5
  let notes = serialParsed
    ? `manufactured_date decoded from OEM serial (${serialParsed.method})`
    : ''

  if (!manufactured_date && releaseYear) {
    manufactured_date = `${releaseYear}-06-15`
    source = 'model_reference'
    confidence = getModelReferenceConfidence(row.manufacturer, row.model)
    notes = 'Product-line estimate (local audit)'
  }

  const bounds = resolveDateBounds(row.manufacturer, row.model, null)
  return applyDateGuardrails(
    {
      ...row,
      manufactured_date,
      device_type: ruleType ?? 'Unknown',
      confidence,
      source,
      notes,
    },
    bounds,
  )
}

const results = rows.map(localEnrich)
const withDate = results.filter((r) => r.manufactured_date).length
const high = results.filter((r) => r.confidence >= 0.8).length
const review = results.filter(
  (r) =>
    r.confidence < 0.8 ||
    r.source === 'model_reference' ||
    r.source === 'none',
).length

const confBuckets = { '≥0.9': 0, '0.8-0.89': 0, '0.7-0.79': 0, '0.5-0.69': 0, '<0.5': 0 }
for (const r of results) {
  const c = r.confidence
  if (c >= 0.9) confBuckets['≥0.9']++
  else if (c >= 0.8) confBuckets['0.8-0.89']++
  else if (c >= 0.7) confBuckets['0.7-0.79']++
  else if (c >= 0.5) confBuckets['0.5-0.69']++
  else confBuckets['<0.5']++
}

const years = results
  .map((r) => r.manufactured_date?.slice(0, 4))
  .filter(Boolean) as string[]
years.sort()
console.log('=== Local audit (serial + model ref + guardrails) ===')
console.log(`rows: ${rows.length}`)
console.log(`with manufactured_date: ${withDate} (${((withDate / rows.length) * 100).toFixed(1)}%)`)
console.log(`high confidence (>=0.8): ${high} (${((high / rows.length) * 100).toFixed(1)}%)`)
console.log(`needs review (heuristic): ${review}`)
console.log('confidence buckets:', confBuckets)
console.log(`oldest: ${years[0]}, newest: ${years[years.length - 1]}`)

const bySource = new Map<string, number>()
for (const r of results) {
  bySource.set(r.source, (bySource.get(r.source) ?? 0) + 1)
}
console.log('by source:', Object.fromEntries(bySource))
