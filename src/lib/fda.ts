// Free openFDA API key — register at https://open.fda.gov/apis/authentication/
const FDA_API_KEY = import.meta.env.VITE_FDA_API_KEY ?? 'oize5Vd1ec14XwlGhBWkXdQO6MXMo1BcXgdReOcZ'

const UDI_BASE = 'https://api.fda.gov/device/udi.json'
const K510_BASE = 'https://api.fda.gov/device/510k.json'

type FdaUdiResult = {
  device_type: string
  manufactured_date: string
  source: 'fda_udi_exact' | 'fda_udi_fuzzy'
  raw_publish_date: string
}

type Fda510kResult = {
  device_type: string
  manufactured_date: string
  source: 'fda_510k'
  raw_decision_date: string
  k_number: string
  floorYear: number
}

export type Fda510kBounds = {
  k_number: string | null
  decision_date: string | null
  floorYear: number | null
}

type UdiRecord = {
  brand_name?: string
  company_name?: string
  version_or_model_number?: string
  publish_date?: string
  public_version_date?: string
  product_codes?: Array<{
    name?: string
    openfda?: { device_name?: string }
  }>
  gmdn_terms?: Array<{ name?: string }>
}

type K510Record = {
  applicant?: string
  device_name?: string
  decision_date?: string
  k_number?: string
}

type OpenFdaResponse<T> = {
  results?: T[]
}

const AND = ' AND '
const fetchCache = new Map<string, Promise<unknown>>()

function cachedFetch<T>(key: string, fn: () => Promise<T | null>): Promise<T | null> {
  const existing = fetchCache.get(key)
  if (existing) return existing as Promise<T | null>
  const promise = fn()
  fetchCache.set(key, promise)
  return promise
}

/** Lucene quoted phrase; spaces allowed inside quotes. */
function quoteTerm(value: string): string {
  const escaped = value.trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function fuzzyTerm(value: string): string {
  return `${value.trim()}*`
}

/** Applicant field: use first token to avoid Lucene errors on spaces. */
function applicantFuzzyTerm(manufacturer: string): string {
  const firstToken = manufacturer.trim().split(/\s+/)[0]
  return fuzzyTerm(firstToken || manufacturer)
}

function manufacturerTokens(manufacturer: string): string[] {
  return manufacturer
    .toLowerCase()
    .split(/[\s,.]+/)
    .filter((t) => t.length > 2 && t !== 'inc' && t !== 'corp')
}

function buildUrl(base: string, search: string, limit = 5): string {
  return `${base}?search=${encodeURIComponent(search)}&limit=${limit}&api_key=${FDA_API_KEY}`
}

async function fetchOpenFda<T>(url: string): Promise<T[] | null> {
  return cachedFetch(url, async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const response = await fetch(url, { signal: controller.signal })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        console.error(
          `[openFDA] HTTP ${response.status} for ${url}`,
          body.slice(0, 200),
        )
        return null
      }

      const data = (await response.json()) as OpenFdaResponse<T>
      if (!data.results || data.results.length === 0) {
        return null
      }

      return data.results
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[openFDA] fetch failed:', error)
      }
      return null
    } finally {
      clearTimeout(timer)
    }
  })
}

function extractDeviceType(record: UdiRecord): string | null {
  const fromProductCode = record.product_codes?.[0]?.openfda?.device_name
  if (fromProductCode) return fromProductCode

  const fromGmdn = record.gmdn_terms?.[0]?.name
  if (fromGmdn) return fromGmdn

  const fromProductName = record.product_codes?.[0]?.name
  if (fromProductName) return fromProductName

  const fromBrand = record.brand_name
  if (fromBrand) return fromBrand

  return null
}

function extractUdiManufacturedDate(record: UdiRecord): string | null {
  if (record.publish_date) return record.publish_date
  if (record.public_version_date) return record.public_version_date
  return null
}

function mapUdiResult(
  record: UdiRecord,
  source: 'fda_udi_exact' | 'fda_udi_fuzzy',
): FdaUdiResult | null {
  const device_type = extractDeviceType(record)
  if (!device_type) return null

  const manufactured_date = extractUdiManufacturedDate(record)
  if (!manufactured_date) return null

  return {
    device_type,
    manufactured_date,
    source,
    raw_publish_date: record.publish_date ?? record.public_version_date ?? '',
  }
}

function companyMatchesManufacturer(
  record: UdiRecord,
  manufacturer: string,
): boolean {
  const tokens = manufacturerTokens(manufacturer)
  if (tokens.length === 0) return true

  const company = (record.company_name ?? '').toLowerCase()
  const brand = (record.brand_name ?? '').toLowerCase()
  return tokens.some((t) => company.includes(t) || brand.includes(t))
}

function scoreUdiRecord(
  record: UdiRecord,
  manufacturer: string,
  model: string,
): number {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.toLowerCase()
  const company = (record.company_name ?? '').toLowerCase()
  const version = (record.version_or_model_number ?? '').toLowerCase()
  const brand = (record.brand_name ?? '').toLowerCase()

  let score = 0
  for (const token of manufacturerTokens(manufacturer)) {
    if (company.includes(token)) score += 3
    if (brand.includes(token)) score += 2
  }
  if (mfr && company.includes(mfr)) score += 2
  if (mdl && version.includes(mdl)) score += 4
  if (mdl && brand.includes(mdl)) score += 2

  for (const token of mdl.split(/\s+/).filter((t) => t.length > 2)) {
    if (version.includes(token) || brand.includes(token)) score += 2
  }

  return score
}

function pickBestUdiResult(
  results: UdiRecord[],
  source: 'fda_udi_exact' | 'fda_udi_fuzzy',
  manufacturer: string,
  model: string,
): FdaUdiResult | null {
  const ranked = [...results].sort(
    (a, b) =>
      scoreUdiRecord(b, manufacturer, model) -
      scoreUdiRecord(a, manufacturer, model),
  )

  const minScore = source === 'fda_udi_fuzzy' ? 5 : 2

  for (const record of ranked) {
    const score = scoreUdiRecord(record, manufacturer, model)
    if (score < minScore) continue
    if (
      source === 'fda_udi_fuzzy' &&
      manufacturer.trim() &&
      !companyMatchesManufacturer(record, manufacturer)
    ) {
      continue
    }
    const mapped = mapUdiResult(record, source)
    if (mapped) return mapped
  }
  return null
}

async function searchUdi(
  search: string,
  source: 'fda_udi_exact' | 'fda_udi_fuzzy',
  manufacturer: string,
  model: string,
): Promise<FdaUdiResult | null> {
  const url = buildUrl(UDI_BASE, search)
  const results = await fetchOpenFda<UdiRecord>(url)
  if (!results) return null
  return pickBestUdiResult(results, source, manufacturer, model)
}

export async function searchUdiExact(
  manufacturer: string,
  model: string,
): Promise<FdaUdiResult | null> {
  const mfr = manufacturer.trim()
  const mdl = model.trim()
  if (!mfr || !mdl) return null

  const cacheKey = `udi-exact:${mfr}:${mdl}`
  return cachedFetch(cacheKey, async () => {
    const search = `company_name:${quoteTerm(mfr)}${AND}version_or_model_number:${quoteTerm(mdl)}`
    return searchUdi(search, 'fda_udi_exact', mfr, mdl)
  })
}

export async function searchUdiFuzzy(
  manufacturer: string,
  model: string,
): Promise<FdaUdiResult | null> {
  const mfr = manufacturer.trim()
  const mdl = model.trim()
  if (!mdl) return null

  const cacheKey = `udi-fuzzy:${mfr}:${mdl}`
  return cachedFetch(cacheKey, async () => {
    if (mfr) {
      const searchWithMfr = `company_name:${fuzzyTerm(mfr)}${AND}version_or_model_number:${fuzzyTerm(mdl)}`
      const withMfr = await searchUdi(searchWithMfr, 'fda_udi_fuzzy', mfr, mdl)
      if (withMfr) return withMfr

      const brandSearch = `company_name:${fuzzyTerm(mfr)}${AND}brand_name:${fuzzyTerm(mdl)}`
      const brandHit = await searchUdi(brandSearch, 'fda_udi_fuzzy', mfr, mdl)
      if (brandHit) return brandHit
    }

    return null
  })
}

function score510kRecord(
  record: K510Record,
  manufacturer: string,
  model: string,
): number {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.toLowerCase()
  const app = (record.applicant ?? '').toLowerCase()
  const device = (record.device_name ?? '').toLowerCase()

  let score = 0
  for (const token of manufacturerTokens(manufacturer)) {
    if (app.includes(token)) score += 3
  }
  if (mfr && app.includes(mfr)) score += 2
  if (mdl && device.includes(mdl)) score += 4

  for (const token of mdl.split(/\s+/).filter((t) => t.length > 2)) {
    if (device.includes(token)) score += 2
  }

  if (mfr.includes('zoll') && app.includes('zoll')) score += 4
  if (mfr.includes('ge') && app.includes('ge medical')) score += 5
  if (mdl.includes('dash') && device.includes('patient monitor')) score += 5

  return score
}

function yearFromDecisionDate(decisionDate: string): number | null {
  const y = Number.parseInt(decisionDate.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

function pick510kFromRanked(
  ranked: K510Record[],
  manufacturer: string,
  model: string,
  minScore: number,
): Fda510kResult | null {
  const qualifying = ranked.filter(
    (r) => score510kRecord(r, manufacturer, model) >= minScore,
  )
  if (qualifying.length === 0) return null

  const best = qualifying[0]
  const device_type = best.device_name?.trim()
  if (!device_type) return null

  let earliest = qualifying[0]
  for (const r of qualifying) {
    const d = r.decision_date ?? ''
    const e = earliest.decision_date ?? ''
    if (d && (!e || d < e)) earliest = r
  }

  const manufactured_date = earliest.decision_date?.trim()
  if (!manufactured_date) return null

  const floorYear = yearFromDecisionDate(manufactured_date)
  if (floorYear === null) return null

  return {
    device_type,
    manufactured_date,
    source: 'fda_510k',
    raw_decision_date: manufactured_date,
    k_number: earliest.k_number?.trim() ?? '',
    floorYear,
  }
}

async function search510kQuery(
  search: string,
  manufacturer: string,
  model: string,
): Promise<Fda510kResult | null> {
  const url = buildUrl(K510_BASE, search, 25)
  const results = await fetchOpenFda<K510Record>(url)
  if (!results) return null

  const ranked = [...results].sort(
    (a, b) =>
      score510kRecord(b, manufacturer, model) -
      score510kRecord(a, manufacturer, model),
  )

  const minScore = manufacturer.trim() ? 4 : 6

  return pick510kFromRanked(ranked, manufacturer, model, minScore)
}

export function fda510kToBounds(hit: Fda510kResult | null): Fda510kBounds | null {
  if (!hit) return null
  return {
    k_number: hit.k_number || null,
    decision_date: hit.raw_decision_date,
    floorYear: hit.floorYear,
  }
}

export async function search510k(
  manufacturer: string,
  model: string,
): Promise<Fda510kResult | null> {
  const mfr = manufacturer.trim()
  const mdl = model.trim()
  if (!mdl) return null

  const cacheKey = `510k:${mfr}:${mdl}`
  return cachedFetch(cacheKey, async () => {
    const { getCached510kBounds } = await import('./fdaCache')
    const staticHit = await getCached510kBounds(mfr, mdl)
    if (
      staticHit?.floorYear &&
      staticHit.decision_date &&
      staticHit.k_number
    ) {
      return {
        device_type: staticHit.device_type ?? mdl,
        manufactured_date: staticHit.manufactured_date ?? staticHit.decision_date,
        source: 'fda_510k',
        raw_decision_date: staticHit.decision_date,
        k_number: staticHit.k_number,
        floorYear: staticHit.floorYear,
      }
    }
    if (mfr) {
      const searchWithApplicant = `applicant:${applicantFuzzyTerm(mfr)}${AND}device_name:${fuzzyTerm(mdl)}`
      const withApplicant = await search510kQuery(searchWithApplicant, mfr, mdl)
      if (withApplicant) return withApplicant
    }

    return null
  })
}
