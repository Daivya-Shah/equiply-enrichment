import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'

const cases: Array<[string, string]> = [
  ['SA308511468GR', '2008-06-15'],
  ['SA309517777GR', '2009-06-15'],
  ['RT908362478GA', '2008-06-15'],
  ['RT914166339GA', '2014-06-15'],
  ['RT916162191SA', '2016-06-15'],
  ['RTS14024388GA', '2014-06-15'],
  ['SPX18510114SA', '2018-06-15'],
]

let ok = 0
for (const [serial, want] of cases) {
  const hit = parseManufactureDateFromSerial(
    'GE HEALTHCARE',
    'APEX PRO CH',
    serial,
  )
  const got = hit?.manufactured_date ?? '—'
  const pass = got === want
  if (pass) ok++
  console.log(`${pass ? '✓' : '✗'} ${serial} → ${got} (want ${want}) [${hit?.method ?? 'none'}]`)
}
console.log(`\n${ok}/${cases.length} passed`)
process.exit(ok === cases.length ? 0 : 1)
