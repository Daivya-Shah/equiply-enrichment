import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'
import { inferDeviceTypeFromModel } from '../src/lib/deviceRules.ts'
import { getModelAnchor, getModelReleaseYear } from '../src/lib/modelAnchors.ts'

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const mfrCount = new Map<string, number>()
const modelPairs = new Map<string, number>()
let noDate = 0
let noType = 0
const gapSamples: string[] = []

for (const row of data) {
  const m = (row.manufacturer ?? '').trim()
  const md = (row.model ?? '').trim()
  const s = (row['serial number'] ?? row.serial_number ?? '').trim()
  mfrCount.set(m, (mfrCount.get(m) ?? 0) + 1)
  const key = `${m}|${md}`
  modelPairs.set(key, (modelPairs.get(key) ?? 0) + 1)
  const sd = parseManufactureDateFromSerial(m, md, s)
  const ay = getModelReleaseYear(m, md)
  const rt = inferDeviceTypeFromModel(m, md)
  if (!sd && !ay && gapSamples.length < 20) {
    gapSamples.push(`${m} | ${md} | ${s}`)
    noDate++
  } else if (!sd && !ay) noDate++
  if (!rt) noType++
}

console.log('rows', data.length)
console.log('no serial+anchor date path', noDate)
console.log('no model rule type', noType)
console.log('unique mfr+model', modelPairs.size)
console.log(
  'top mfrs',
  [...mfrCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
)
console.log(
  'top models',
  [...modelPairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
)
console.log('gap samples:\n' + gapSamples.join('\n'))

const noAnchor = [...modelPairs.keys()].filter((k) => {
  const [m, md] = k.split('|')
  return !getModelAnchor(m, md)
})
console.log('models without anchor', noAnchor.length)
console.log('sample no anchor:', noAnchor.slice(0, 15).join('\n'))
