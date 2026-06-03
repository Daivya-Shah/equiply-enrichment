import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'
import { getModelReleaseYear } from '../src/lib/modelAnchors.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const byMfr = new Map<
  string,
  { total: number; serial: number; anchorOnly: number; none: number; low: number }
>()

for (const row of data) {
  const m = (row.manufacturer ?? '').trim()
  const md = (row.model ?? '').trim()
  const s = (row['serial number'] ?? row.serial_number ?? '').trim()
  const hit = parseManufactureDateFromSerial(m, md, s)
  const anchor = getModelReleaseYear(m, md)

  const cur = byMfr.get(m) ?? {
    total: 0,
    serial: 0,
    anchorOnly: 0,
    none: 0,
    low: 0,
  }
  cur.total++
  if (hit) {
    cur.serial++
    if (hit.confidence < 0.8 || hit.tier === 'low') cur.low++
  } else if (anchor) cur.anchorOnly++
  else cur.none++
  byMfr.set(m, cur)
}

console.log('=== Date source by manufacturer ===')
for (const [mfr, s] of [...byMfr.entries()].sort((a, b) => b[1].total - a[1].total)) {
  console.log(
    `${mfr}: ${s.serial} serial, ${s.anchorOnly} anchor-only, ${s.none} none, ${s.low} low-conf serial (${s.total})`,
  )
}

// Rows with no serial decode but have serial-looking patterns
const missed: string[] = []
for (const row of data) {
  const m = (row.manufacturer ?? '').trim()
  const md = (row.model ?? '').trim()
  const s = (row['serial number'] ?? row.serial_number ?? '').trim()
  if (parseManufactureDateFromSerial(m, md, s)) continue
  if (/^M\d{2}|DE\d|SA\d|RTS|RT9|3T\d|^[A-Z]\d{3}AD/i.test(s)) {
    missed.push(`${m}|${md}|${s}`)
  }
}
console.log('\n=== Possible missed serial patterns (sample) ===')
console.log(missed.slice(0, 25).join('\n') || '(none)')
