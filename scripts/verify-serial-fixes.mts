import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'

const cases = [
  ['Mindray', 'BENEVISION N15', 'FS-28042613', '2018'],
  ['HILL ROM', 'P3200', 'J303AD1205', '2010'],
  ['HILL ROM', 'P3200', 'I288AD1837', '2009'],
  ['Hillrom', 'P3200', 'J309AD1600', '2010'],
  ['ARJO INC.', 'FLOWTRON', '2100053978', '2021'],
  ['ZOLL Medical', 'M SERIES', '3T13D131852', '2013'],
  ['ZOLL Medical', 'M SERIES', 'D16B136583', '2016'],
  ['ZOLL Medical', 'M SERIES', 'T0787302', '2007'],
  ['ZOLL Medical', 'R Series ALS', 'AV17D064978', '2017'],
  ['Welch Allyn', 'SURETEMPPLUS', '24519376', '2024'],
]

let ok = 0
for (const [mfr, model, serial, expectYear] of cases) {
  const hit = parseManufactureDateFromSerial(mfr, model, serial)
  const year = hit?.manufactured_date.slice(0, 4) ?? '—'
  const pass =
    expectYear === '—' ? hit === null : year === expectYear
  if (pass) ok++
  console.log(
    `${pass ? '✓' : '✗'} ${serial} → ${year} (expected ${expectYear}) [${hit?.method ?? 'none'}]`,
  )
}
console.log(`\n${ok}/${cases.length} passed`)
