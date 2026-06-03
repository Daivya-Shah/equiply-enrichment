/**
 * Proves enrichment never alters manufacturer / model / serial from the challenge CSV.
 * Run: npx tsx scripts/verify-input-passthrough.mts
 */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { clearEnrichmentCache, enrichRow } from '../src/lib/enrichRow.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const inputs = data.map((row) => ({
  manufacturer: (row.manufacturer ?? '').trim(),
  model: (row.model ?? '').trim(),
  serial_number: (row['serial number'] ?? row.serial_number ?? '').trim(),
}))

console.log(`Input rows: ${inputs.length}`)

clearEnrichmentCache()
let mismatches = 0
for (let i = 0; i < inputs.length; i++) {
  const inp = inputs[i]
  const out = await enrichRow(inp)
  if (
    out.manufacturer !== inp.manufacturer ||
    out.model !== inp.model ||
    out.serial_number !== inp.serial_number
  ) {
    mismatches++
    if (mismatches <= 3) {
      console.log('MISMATCH', i, inp, out)
    }
  }
}

console.log(
  mismatches === 0
    ? '✓ All 801 rows: manufacturer, model, serial_number unchanged after enrichment'
    : `✗ ${mismatches} identity mismatches`,
)
