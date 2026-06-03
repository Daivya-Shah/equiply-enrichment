import { enrichRow } from '../src/lib/enrichRow.ts'

const rows = [
  {
    manufacturer: 'Medtronic',
    model: 'InSync III',
    serial_number: 'SN-001',
  },
  {
    manufacturer: 'GE Healthcare',
    model: 'Dash 4000',
    serial_number: 'SN-002',
  },
  {
    manufacturer: 'Philips',
    model: 'PageWriter TC30',
    serial_number: 'SN-003',
  },
]

console.log('Testing enrichment against openFDA...\n')

for (const row of rows) {
  const start = Date.now()
  const enriched = await enrichRow(row)
  const ms = Date.now() - start
  console.log('---')
  console.log(`Input: ${row.manufacturer} | ${row.model} | ${row.serial_number}`)
  console.log(JSON.stringify(enriched, null, 2))
  console.log(`(${ms}ms)\n`)
}

const hits = await Promise.all(rows.map((r) => enrichRow(r)))
const enrichedCount = hits.filter(
  (r) => r.device_type && r.manufactured_date,
).length
console.log(`Summary: ${enrichedCount}/3 rows with device_type AND manufactured_date`)
