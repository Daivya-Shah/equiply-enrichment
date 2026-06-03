/**
 * Estimate rows whose dates changed vs pre-audit UI placeholders.
 * npx tsx scripts/audit-date-delta.mts
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

/** Placeholder dates reported in UI before audit fixes. */
function legacyPlaceholder(row: RawRow): string | null {
  const m = row.manufacturer.toLowerCase()
  const md = row.model.toLowerCase()
  if (/hospira/.test(m) && /pluma/.test(md)) return '2010-06-15'
  if (/welch/.test(m) && /suretemp/.test(md)) return '2010-06-15'
  if (/welch/.test(m) && /spot vital/.test(md)) return '2020-06-15'
  if (/ge/.test(m) && /apex/.test(md)) return '2019-06-15'
  if (/hill/.test(m) && /century/.test(md)) return '2008-06-15'
  if (/lab corp/.test(m)) return '2024-06-15'
  return null
}

function localEnrich(row: RawRow): EnrichedRow {
  const serialParsed = parseManufactureDateFromSerial(
    row.manufacturer,
    row.model,
    row.serial_number,
  )
  const releaseYear = getModelReleaseYear(row.manufacturer, row.model)
  let manufactured_date: string | null = serialParsed?.manufactured_date ?? null
  let source: EnrichedRow['source'] = serialParsed ? 'serial_parse' : 'none'
  let confidence = serialParsed?.confidence ?? 0.5
  let notes = ''
  if (!manufactured_date && releaseYear) {
    manufactured_date = `${releaseYear}-06-15`
    source = 'model_reference'
    confidence = getModelReferenceConfidence(row.manufacturer, row.model)
  }
  const bounds = resolveDateBounds(row.manufacturer, row.model, null)
  return applyDateGuardrails(
    {
      ...row,
      manufactured_date,
      device_type: inferDeviceTypeFromModel(row.manufacturer, row.model) ?? 'Unknown',
      confidence,
      source,
      notes,
    },
    bounds,
  )
}

let changed = 0
const samples: string[] = []
for (const row of rows) {
  const legacy = legacyPlaceholder(row)
  if (!legacy) continue
  const next = localEnrich(row).manufactured_date
  if (next && next !== legacy) {
    changed++
    if (samples.length < 12) {
      samples.push(
        `${row.manufacturer} | ${row.model} | ${row.serial_number}: ${legacy} → ${next}`,
      )
    }
  }
}

console.log(`Rows with legacy placeholder that now differ: ${changed}`)
console.log('Samples:')
for (const s of samples) console.log(' ', s)
