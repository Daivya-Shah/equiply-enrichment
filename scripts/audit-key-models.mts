/**
 * Spot-check enriched dates for audit-flagged models (serial parse only, no FDA).
 * npx tsx scripts/audit-key-models.mts
 */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'
import { getModelReleaseYear } from '../src/lib/modelAnchors.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const filters: Array<{ label: string; match: (m: string, md: string) => boolean }> = [
  { label: 'GE APEX PRO CH', match: (m, md) => /ge/i.test(m) && /apex/i.test(md) },
  { label: 'Hillrom CENTURY', match: (m, md) => /hill/i.test(m) && /century/i.test(md) },
  { label: 'Hospira PLUMA+', match: (m, md) => /hospira/i.test(m) && /pluma/i.test(md) },
  { label: 'Welch SURETEMP', match: (m, md) => /welch/i.test(m) && /suretemp/i.test(md) },
  { label: 'Welch SPOT VITAL', match: (m, md) => /welch/i.test(m) && /spot vital/i.test(md) },
  { label: 'LAB CORP 642E', match: (m, md) => /lab corp/i.test(m) },
  { label: 'ARJO FLOWTRON', match: (m, md) => /arjo/i.test(m) },
  { label: 'Mindray N15', match: (m, md) => /mindray/i.test(m) && /n15/i.test(md) },
]

for (const { label, match } of filters) {
  console.log(`\n=== ${label} ===`)
  const rows = data.filter((r) =>
    match((r.manufacturer ?? '').trim(), (r.model ?? '').trim()),
  )
  const dates = new Map<string, number>()
  for (const r of rows.slice(0, 8)) {
    const mfr = (r.manufacturer ?? '').trim()
    const model = (r.model ?? '').trim()
    const serial = (r['serial number'] ?? '').trim()
    const hit = parseManufactureDateFromSerial(mfr, model, serial)
    const date =
      hit?.manufactured_date ??
      (getModelReleaseYear(mfr, model)
        ? `${getModelReleaseYear(mfr, model)}-06-15 (model)`
        : '—')
    dates.set(date, (dates.get(date) ?? 0) + 1)
    console.log(`  ${serial} → ${date}`)
  }
  if (rows.length > 8) {
    for (const r of rows.slice(8)) {
      const mfr = (r.manufacturer ?? '').trim()
      const model = (r.model ?? '').trim()
      const serial = (r['serial number'] ?? '').trim()
      const hit = parseManufactureDateFromSerial(mfr, model, serial)
      const date =
        hit?.manufactured_date ??
        (getModelReleaseYear(mfr, model)
          ? `${getModelReleaseYear(mfr, model)}-06-15 (model)`
          : '—')
      dates.set(date, (dates.get(date) ?? 0) + 1)
    }
  }
  console.log(`  (${rows.length} rows) date distribution:`, Object.fromEntries(dates))
}
