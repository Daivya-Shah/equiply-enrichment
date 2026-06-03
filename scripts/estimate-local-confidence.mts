import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'
import { inferDeviceTypeFromModel } from '../src/lib/deviceRules.ts'
import { getModelReleaseYear } from '../src/lib/modelReleaseFallback.ts'

const csv = readFileSync(
  'public/hackathon-data/challenge_data-v1.csv',
  'utf8',
)
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

let serialDate = 0
let modelYear = 0
let ruleType = 0
let highConfidence = 0

for (const row of data) {
  const manufacturer = (row.manufacturer ?? '').trim()
  const model = (row.model ?? '').trim()
  const serial_number = (row['serial number'] ?? row.serial_number ?? '').trim()
  const sd = parseManufactureDateFromSerial(manufacturer, model, serial_number)
  const my = getModelReleaseYear(manufacturer, model)
  const rt = inferDeviceTypeFromModel(manufacturer, model)
  if (sd) serialDate++
  if (!sd && my) modelYear++
  if (rt) ruleType++
  const hasDate = Boolean(sd || my)
  if (hasDate && rt && (sd?.confidence ?? 0) >= 0.84) highConfidence++
  else if (hasDate && rt && sd) highConfidence++
  else if (hasDate && rt && my) highConfidence += 0 // product line ~0.7
}

console.log(`Rows: ${data.length}`)
console.log(`OEM serial date: ${serialDate}`)
console.log(`+ product-line year: ${modelYear} (total dated: ${serialDate + modelYear})`)
console.log(`Model rule device type: ${ruleType}`)
console.log(`Serial+type high-conf estimate: ${highConfidence}`)
