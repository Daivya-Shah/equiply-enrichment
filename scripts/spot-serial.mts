import { parseManufactureDateFromSerial } from '../src/lib/serialParse.ts'

const cases: [string, string, string][] = [
  ['Welch Allyn', 'FILAC3000', 'A2053244X'],
  ['Welch Allyn', 'SURETEMPPLUS', '24519376'],
  ['American Diagnostic', 'CE 1434', '22192114'],
  ['American Diagnostic', 'CE 1434', 'C241870143'],
  ['Philips', 'INTELLIVUE MP30', 'DE728A5916'],
  ['Philips', 'INTELLIVUE MP50', '82061692'],
  ['HILL ROM', 'P1440', 'P09AME5255'],
  ['HILL ROM', 'P1440', '0139ME8098'],
  ['GE HEALTHCARE', 'PATIENT DATA MODULE (PDM)', 'SA315208552GA'],
]

for (const [m, md, s] of cases) {
  const r = parseManufactureDateFromSerial(m, md, s)
  console.log(
    `${s} → ${r?.manufactured_date?.slice(0, 4) ?? '—'} [${r?.method ?? 'none'}] conf=${r?.confidence ?? 0}`,
  )
}
