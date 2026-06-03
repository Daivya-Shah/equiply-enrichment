/**
 * Serial decoder spec checks + CSV serial-only coverage.
 * npx tsx scripts/audit-serial-spec.mts
 */
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'

type Case = [string, string, string, string]

const SPEC: Case[] = [
  ['ZOLL Medical', 'M SERIES', 'AF23L173769', '2023-12-15'],
  ['ZOLL Medical', 'M SERIES', 'T09B109955', '2009-02-15'],
  ['ZOLL Medical', 'M SERIES', 'X22F478419', '2022-06-15'],
  ['ZOLL Medical', 'M SERIES', 'AR25C090387', '2025-03-15'],
  ['ZOLL Medical', 'M SERIES', '(21) X19G176549', '2019-07-15'],
  ['ZOLL Medical', 'M SERIES', 'T08103497', '2008-06-15'],
  ['ZOLL Medical', 'M SERIES', '3T13D131852', '2013-04-15'],
  ['Edan Instruments', 'IM70', '560039-M11330014', '2011-06-15'],
  ['Edan Instruments', 'IM70', 'M19804740024', '2019-06-15'],
  ['Philips', 'MP30', 'DE72870252', '2007-06-15'],
  ['Philips', 'MP30', 'DE54011343', '2005-06-15'],
  ['PHILIPS', 'MX500', 'DE671R3701', '2016-06-15'],
  ['PHILIPS', 'MX500', 'DE351B7530', '2013-06-15'],
  ['GE HEALTHCARE', 'APEX PRO CH', 'RTS14024388GA', '2014-06-15'],
  ['GE HEALTHCARE', 'APEX PRO CH', 'RT908362478GA', '2008-06-15'],
  ['GE HEALTHCARE', 'APEX PRO CH', 'RT916162191SA', '2016-06-15'],
  ['GE HEALTHCARE', 'PATIENT DATA MODULE (PDM)', 'SA308511468GR', '2008-06-15'],
  ['GE HEALTHCARE', 'PATIENT DATA MODULE (PDM)', 'SA309517777GR', '2009-06-15'],
  ['GE HEALTHCARE', 'PATIENT DATA MODULE (PDM)', 'SPX18510114SA', '2018-06-15'],
  ['HILL ROM', 'P1440', 'P216ME5983', '2021-06-15'],
  ['HILL ROM', 'P1440', '0139ME8098', '2013-06-15'],
  ['HILL ROM', 'P3200', 'J303AD1205', '2010-10-30'],
  ['Hillrom', 'CENTURY', '02R2981999', '1999-06-15'],
  ['Welch Allyn', 'FILAC3000', 'A2053244X', '2020-06-15'],
  ['Welch Allyn', 'SPOT VITAL SIGNS', '201507871', '2015-06-15'],
  ['Welch Allyn', 'SPOT VITAL SIGNS', '200810466', '2008-06-15'],
  ['Welch Allyn', 'SURETEMPPLUS', '24519376', '2024-06-15'],
  ['Welch Allyn', 'SURETEMPPLUS', '(21) 23038261', '2023-06-15'],
  ['Welch Allyn', 'SURETEMPPLUS', '7432348', '2004-06-15'],
  ['Cogentix Medical', 'CST-4000', 'CS1704F', '2017-04-15'],
  ['Cogentix Medical', 'CST-4000', 'CS0715N', '2007-06-15'],
  ['LAB CORP', '642E', '241013LB348', '2024-10-13'],
  ['Unico', 'G380PL LED', 'G38L-20141208', '2014-12-08'],
  ['Baxter', 'SPECTRUM IQ', '3757686', '2017-06-15'],
  ['Masimo', 'RAD8', 'M192824', '2019-06-15'],
]

let pass = 0
console.log('=== Spec cases ===')
for (const [mfr, model, serial, expected] of SPEC) {
  const hit = parseManufactureDateFromSerial(mfr, model, serial)
  const got = hit?.manufactured_date ?? '—'
  const ok = got === expected
  if (ok) pass++
  console.log(`${ok ? '✓' : '✗'} ${serial} → ${got} (want ${expected})`)
}
console.log(`\n${pass}/${SPEC.length} spec cases passed\n`)

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

let serialHits = 0
const byMfr = new Map<string, { total: number; parsed: number }>()

for (const row of data) {
  const mfr = (row.manufacturer ?? '').trim()
  const model = (row.model ?? '').trim()
  const serial = (row['serial number'] ?? '').trim()
  const hit = parseManufactureDateFromSerial(mfr, model, serial)
  const key = mfr
  const bucket = byMfr.get(key) ?? { total: 0, parsed: 0 }
  bucket.total++
  if (hit) {
    bucket.parsed++
    serialHits++
  }
  byMfr.set(key, bucket)
}

console.log('=== CSV serial-only ===')
console.log(`parsed ${serialHits}/${data.length} (${((serialHits / data.length) * 100).toFixed(1)}%)`)
const top = [...byMfr.entries()]
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 12)
for (const [mfr, { total, parsed }] of top) {
  console.log(`  ${mfr}: ${parsed}/${total}`)
}
