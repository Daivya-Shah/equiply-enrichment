/**
 * Pre-fetch 510(k) floors for every unique manufacturer|model in challenge CSV.
 * Run once before demo: npx tsx scripts/build-fda-cache.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import Papa from 'papaparse'

const FDA_API_KEY = process.env.FDA_API_KEY ?? 'oize5Vd1ec14XwlGhBWkXdQO6MXMo1BcXgdReOcZ'
const K510_BASE = 'https://api.fda.gov/device/510k.json'

type K510Record = {
  applicant?: string
  device_name?: string
  decision_date?: string
  k_number?: string
}

function quoteTerm(value: string): string {
  return `"${value.trim().replace(/"/g, '\\"')}"`
}

function applicantFuzzyTerm(manufacturer: string): string {
  const first = manufacturer.trim().split(/\s+/)[0]
  return `${first || manufacturer}*`
}

async function fetch510k(mfr: string, mdl: string): Promise<{
  k_number: string
  decision_date: string
  floorYear: number
  device_type: string
} | null> {
  const search = `applicant:${applicantFuzzyTerm(mfr)} AND device_name:${mdl.trim()}*`
  const url = `${K510_BASE}?search=${encodeURIComponent(search)}&limit=25&api_key=${FDA_API_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as { results?: K510Record[] }
  const results = data.results ?? []
  if (results.length === 0) return null

  let earliest = results[0]
  for (const r of results) {
    const d = r.decision_date ?? ''
    const e = earliest.decision_date ?? ''
    if (d && (!e || d < e)) earliest = r
  }
  const decision_date = earliest.decision_date?.trim()
  const k_number = earliest.k_number?.trim()
  if (!decision_date || !k_number) return null
  const floorYear = Number.parseInt(decision_date.slice(0, 4), 10)
  return {
    k_number,
    decision_date,
    floorYear,
    device_type: earliest.device_name?.trim() ?? mdl,
  }
}

const csv = readFileSync('public/hackathon-data/challenge_data-v1.csv', 'utf8')
const { data } = Papa.parse<Record<string, string>>(csv, {
  header: true,
  skipEmptyLines: true,
})

const pairs = new Map<string, { mfr: string; mdl: string }>()
for (const row of data) {
  const mfr = (row.manufacturer ?? '').trim()
  const mdl = (row.model ?? '').trim()
  if (!mdl) continue
  pairs.set(`${mfr}|${mdl}`, { mfr, mdl })
}

const out: Record<string, unknown> = {}
let i = 0
for (const { mfr, mdl } of pairs.values()) {
  i++
  const key = `${mfr}|${mdl}`
  process.stdout.write(`[${i}/${pairs.size}] ${key} … `)
  const hit = await fetch510k(mfr, mdl)
  if (hit) {
    out[key] = {
      ...hit,
      manufactured_date: hit.decision_date,
    }
    console.log(hit.k_number, hit.decision_date)
  } else {
    console.log('miss')
  }
  await new Promise((r) => setTimeout(r, 280))
}

writeFileSync(
  'public/fda-model-cache.json',
  JSON.stringify(out, null, 2),
  'utf8',
)
console.log(`\nWrote ${Object.keys(out).length}/${pairs.size} entries to public/fda-model-cache.json`)
