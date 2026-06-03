import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { inferDeviceTypeFromModel } from '../src/lib/deviceRules.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
const m = new Map<string, number>()
for (const row of data) {
  const mfr = (row.manufacturer ?? '').trim()
  const md = (row.model ?? '').trim()
  if (!inferDeviceTypeFromModel(mfr, md)) {
    const k = `${mfr}|${md}`
    m.set(k, (m.get(k) ?? 0) + 1)
  }
}
console.log([...m.entries()].sort((a, b) => b[1] - a[1]).join('\n'))
