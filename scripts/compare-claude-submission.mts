import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'

function loadCsv(path: string) {
  const csv = readFileSync(path, 'utf8')
  const { data } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  })
  return data.map((r) => ({
    manufacturer: (r.manufacturer ?? '').trim(),
    model: (r.model ?? '').trim(),
    serial: (r['serial number'] ?? r.serial_number ?? '').trim(),
    date: (r.manufactured_date ?? '').trim(),
  }))
}

const challenge = loadCsv('public/hackathon-data/challenge_data-v1.csv')
const claude = loadCsv('c:/Users/Daivy/Downloads/submission_final.csv')

const key = (r: { manufacturer: string; model: string; serial: string }) =>
  `${r.manufacturer}|${r.model}|${r.serial}`

const claudeByKey = new Map(claude.map((r) => [key(r), r.date]))

let oursParsed = 0
let claudeHasDate = 0
let bothHave = 0
let sameYear = 0
let diffYear = 0
const diffs: string[] = []

for (const row of challenge) {
  const k = key(row)
  const claudeDate = claudeByKey.get(k)
  const ours = parseManufactureDateFromSerial(
    row.manufacturer,
    row.model,
    row.serial,
  )

  if (claudeDate) claudeHasDate++
  if (ours) oursParsed++
  if (claudeDate && ours) {
    bothHave++
    const cy = claudeDate.slice(0, 4)
    const oy = ours.manufactured_date.slice(0, 4)
    if (cy === oy) sameYear++
    else {
      diffYear++
      if (diffs.length < 15) {
        diffs.push(
          `${row.manufacturer} | ${row.serial}\n  Claude: ${claudeDate}  Ours: ${ours.manufactured_date}`,
        )
      }
    }
  } else if (claudeDate && !ours && diffs.length < 20) {
    diffs.push(
      `[Claude only] ${row.manufacturer} | ${row.serial}\n  Claude: ${claudeDate}`,
    )
  } else if (claudeDate && ours && claudeDate.slice(0, 4) !== ours.manufactured_date.slice(0, 4) && diffs.length < 25) {
    diffs.push(
      `[Year mismatch] ${row.manufacturer} | ${row.serial}\n  Claude: ${claudeDate}  Ours: ${ours.manufactured_date}`,
    )
  }
}

console.log(`Rows: ${challenge.length}`)
console.log(`Claude dates filled: ${claudeHasDate}`)
console.log(`Our serial parser dates: ${oursParsed}`)
console.log(`Both have date: ${bothHave}, same year: ${sameYear}, diff year: ${diffYear}`)
console.log('\nSample diffs (Claude vs ours):')
console.log(diffs.join('\n\n'))
