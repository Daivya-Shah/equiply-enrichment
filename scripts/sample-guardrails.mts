import { enrichRow, clearEnrichmentCache } from '../src/lib/enrichRow.ts'

const samples = [
  {
    manufacturer: 'ARJO INC.',
    model: 'FLOWTRON',
    serial_number: '2100053978',
  },
  {
    manufacturer: 'Hospira',
    model: 'Plum A+',
    serial_number: '17401234',
  },
  {
    manufacturer: 'ZOLL Medical',
    model: 'M SERIES',
    serial_number: '3T13D131852',
  },
  {
    manufacturer: 'Mindray',
    model: 'BENEVISION N15',
    serial_number: 'FS-28042613',
  },
]

clearEnrichmentCache()
for (const row of samples) {
  const r = await enrichRow(row)
  console.log('---')
  console.log(`${row.manufacturer} | ${row.model} | ${row.serial_number}`)
  console.log(
    `  date=${r.manufactured_date} type=${r.device_type} conf=${(r.confidence * 100).toFixed(0)}% src=${r.source}`,
  )
  console.log(`  notes: ${r.notes.slice(0, 200)}…`)
}
