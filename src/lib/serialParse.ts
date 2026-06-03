export type SerialParseTier = 'high' | 'medium' | 'low'

export type SerialParseResult = {
  manufactured_date: string
  source: 'serial_parse'
  confidence: number
  tier: SerialParseTier
  method: string
}

/** ZOLL month letters A–L (I included) → Jan–Dec per OEM spec. */
const ZOLL_MONTH_CODE: Record<string, string> = {
  A: '01',
  B: '02',
  C: '03',
  D: '04',
  E: '05',
  F: '06',
  G: '07',
  H: '08',
  I: '09',
  J: '10',
  K: '11',
  L: '12',
}

const MONTH_CODE: Record<string, string> = {
  ...ZOLL_MONTH_CODE,
  M: '12',
}

function zollMonthFromLetter(letter: string | undefined): string | null {
  if (!letter) return null
  return ZOLL_MONTH_CODE[letter.toUpperCase()] ?? null
}

function tierConfidence(tier: SerialParseTier, hasMonth: boolean): number {
  if (tier === 'high') return hasMonth ? 0.94 : 0.92
  if (tier === 'medium') return hasMonth ? 0.86 : 0.84
  return 0.72
}

function isoDate(year: number, month = '06', day = '15'): string | null {
  if (year < 1985 || year > 2030) return null
  const mm = month.padStart(2, '0')
  const dd = day.padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function isoFromYyMonth(
  yy: number,
  monthCode?: string,
  monthLookup: Record<string, string> = MONTH_CODE,
): { date: string; hasMonth: boolean } | null {
  if (yy < 0 || yy > 99) return null
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  const mm = monthCode ? (monthLookup[monthCode.toUpperCase()] ?? null) : null
  const date = isoDate(year, mm ?? '06')
  if (!date) return null
  return { date, hasMonth: Boolean(mm) }
}

function result(
  date: string,
  tier: SerialParseTier,
  method: string,
  hasMonth = false,
  confidenceOverride?: number,
): SerialParseResult {
  return {
    manufactured_date: date,
    source: 'serial_parse',
    tier,
    method,
    confidence: confidenceOverride ?? tierConfidence(tier, hasMonth),
  }
}

function letterToYear(letter: string): number | null {
  const code = letter.toUpperCase().charCodeAt(0)
  if (code < 65 || code > 90) return null
  return 2001 + (code - 65)
}

function dateFromJulianDay(year: number, julianDay: number): string | null {
  if (julianDay < 1 || julianDay > 366) return null
  const d = new Date(year, 0, julianDay)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return isoDate(year, mm, dd)
}

function stripGs21Prefix(serial: string): string {
  return serial.trim().replace(/^\(\d+\)\s*/i, '').trim()
}

/** GS1 (11) YYMMDD */
function parseGs1(serial: string): SerialParseResult | null {
  const parenMatch = serial.match(/\(11\)(\d{6})/)
  if (!parenMatch) return null
  const yy = parenMatch[1].slice(0, 2)
  const mm = parenMatch[1].slice(2, 4)
  const dd = parenMatch[1].slice(4, 6)
  const month = Number.parseInt(mm, 10)
  const day = Number.parseInt(dd, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = isoDate(2000 + Number.parseInt(yy, 10), mm, dd)
  if (!date) return null
  return result(date, 'high', 'GS1 AI (11) production date', true)
}

/** ZOLL: [prefix] + YY + month letter (A–M) + sequence */
function parseZollSerial(serial: string): SerialParseResult | null {
  let s = stripGs21Prefix(serial).replace(/\s/g, '').toUpperCase()

  if (/^T1K/i.test(s)) {
    const date = isoDate(2001)
    if (date) return result(date, 'low', 'ZOLL T1K (weak year parse)', false, 0.45)
  }

  const generic = s.match(/^(?:\d)?([A-Z]{1,2})(\d{2})([A-L])/i)
  if (generic) {
    const mm = zollMonthFromLetter(generic[3])
    const year = Number.parseInt(generic[2], 10)
    const fullYear = year >= 70 ? 1900 + year : 2000 + year
    const date = isoDate(fullYear, mm ?? '06')
    if (date) {
      return result(date, 'high', 'ZOLL prefix+YY+month', Boolean(mm))
    }
  }

  const genericLegacy = s.match(/^(?:\d)?([A-Z]{1,2})(\d{2})([A-M])/i)
  if (genericLegacy && !generic) {
    const parsed = isoFromYyMonth(
      Number.parseInt(genericLegacy[2], 10),
      genericLegacy[3],
      ZOLL_MONTH_CODE,
    )
    if (parsed) {
      return result(parsed.date, 'high', 'ZOLL prefix+YY+month', parsed.hasMonth)
    }
  }

  const withMonth: Array<RegExp> = [
    /^(?:\d)?T(\d{2})([A-L])(\d*)/i,
    /^D(\d{2})([A-L])/i,
  ]

  for (const re of withMonth) {
    const m = s.match(re)
    if (!m) continue
    const parsed = isoFromYyMonth(
      Number.parseInt(m[1], 10),
      m[2],
      ZOLL_MONTH_CODE,
    )
    if (parsed) {
      return result(parsed.date, 'high', 'ZOLL YY+month letter', parsed.hasMonth)
    }
  }

  const tLoose = s.match(/^(?:\d)?T(\d{2})/)
  if (tLoose) {
    const yy = Number.parseInt(tLoose[1], 10)
    if (yy >= 4 && yy <= 30) {
      const parsed = isoFromYyMonth(yy)
      if (parsed) return result(parsed.date, 'high', 'ZOLL T+YY')
    }
  }

  const dLoose = s.match(/^D(\d{2})/)
  if (dLoose) {
    const yy = Number.parseInt(dLoose[1], 10)
    if (yy >= 4 && yy <= 30) {
      const parsed = isoFromYyMonth(yy)
      if (parsed) return result(parsed.date, 'high', 'ZOLL D+YY')
    }
  }

  return null
}

/** Edan: [product-]M+YY or K+YY (K24 = 2024); month unreliable → 06-15 */
function parseEdanSerial(serial: string): SerialParseResult | null {
  let s = stripGs21Prefix(serial).toUpperCase().replace(/\s/g, '')
  s = s.replace(/^\d{6}-/, '')

  const patterns: Array<[RegExp, string]> = [
    [/-M(\d{2})/, 'Edan M+YY'],
    [/^M(\d{2})\d{3,}/, 'Edan M+YY'],
    [/^M(\d{2})[A-Z0-9]{2,}/, 'Edan M+YY'],
    [/[^A-Z0-9]M(\d{2})/, 'Edan M+YY'],
    // K+YY format (e.g. K24700210010 → 2024)
    [/^K(\d{2})\d{3,}/, 'Edan K+YY'],
    [/-K(\d{2})\d{3,}/, 'Edan K+YY'],
  ]

  for (const [re, method] of patterns) {
    const m = s.match(re)
    if (!m) continue
    const yy = Number.parseInt(m[1], 10)
    if (yy < 5 || yy > 30) continue
    const parsed = isoFromYyMonth(yy)
    if (parsed) return result(parsed.date, 'high', method)
  }
  return null
}

/** Masimo RAD8: M+YY at start */
function parseMasimoSerial(serial: string): SerialParseResult | null {
  const m = serial.toUpperCase().trim().match(/^M(\d{2})/)
  if (!m) return null
  const parsed = isoFromYyMonth(Number.parseInt(m[1], 10))
  if (parsed) return result(parsed.date, 'high', 'Masimo M+YY')
  return null
}

/** Philips (mixed case mfr): DE + digit → 2000+digit; MX40 numeric → no serial */
function parsePhilipsSerial(
  serial: string,
  model: string,
  manufacturer: string,
): SerialParseResult | null {
  const s = serial.toUpperCase().trim()
  const mfr = manufacturer.trim()
  const mdl = model.toLowerCase()

  if (/mx\s*40/i.test(mdl) && /^\d{6,8}$/.test(s)) {
    return null
  }

  const isUpperPhilips = mfr === 'PHILIPS'

  const de = s.match(/^DE(\d)/)
  if (de) {
    const d = Number.parseInt(de[1], 10)
    let year: number | null = null
    if (isUpperPhilips || /mx\s*500/i.test(mdl)) {
      year = 2010 + d
    } else {
      year = 2000 + d
    }
    const date = year ? isoDate(year) : null
    if (date) {
      return result(date, 'high', isUpperPhilips ? 'PHILIPS MX DE decade' : 'Philips DE decade digit')
    }
  }

  return null
}

/**
 * GE telemetry serials: prefix (RTS|RT9|SA3|SPX) + 2-digit year YY → 2000 + YY.
 * Regex captures prefix and the two digits immediately following it.
 */
const GE_SERIAL_PREFIX_RE = /^(RTS|RT9|SA3|SPX)(\d{2})/

function parseGeSerial(serial: string): SerialParseResult | null {
  const s = serial.trim().toUpperCase().replace(/(?:GA|GR|SA)$/i, '')
  const m = s.match(GE_SERIAL_PREFIX_RE)
  if (!m) return null

  const yy = Number.parseInt(m[2], 10)
  if (Number.isNaN(yy) || yy < 0 || yy > 99) return null

  const year = 2000 + yy
  const date = isoDate(year)
  if (!date) return null

  return result(date, 'high', `GE ${m[1]}+YY`)
}

/** Hill-Rom / Hillrom */
function parseHillromSerial(
  serial: string,
  model: string,
  manufacturer: string,
): SerialParseResult | null {
  const s = serial.trim().toUpperCase()
  const mdl = model.toUpperCase()
  const mfr = manufacturer.toLowerCase()

  const trailing = s.match(/(19\d{2}|20\d{2})$/)
  if (trailing) {
    const year = Number.parseInt(trailing[1], 10)
    const date = isoDate(year)
    if (date) {
      return result(date, 'medium', 'Hill-Rom trailing YYYY')
    }
  }

  if (
    mdl.includes('P3200') ||
    mdl.includes('CENTURY') ||
    mdl.includes('P1400') ||
    /^[A-Z]\d{3}(AD|HE|AG|AT)/.test(s)
  ) {
    const julian = s.match(/^([A-Z])(\d{3})(AD|HE|AG|AT)/)
    if (julian) {
      const year = letterToYear(julian[1])
      const jd = Number.parseInt(julian[2], 10)
      if (year) {
        const date = dateFromJulianDay(year, jd)
        if (date) {
          return result(
            date,
            'high',
            'Hill-Rom letter+Julian (P3200/Century)',
            true,
          )
        }
      }
    }
    const letterOnly = s.match(/^([A-Z])\d{3}(AD|HE|AG|AT)/)
    if (letterOnly) {
      const year = letterToYear(letterOnly[1])
      const date = year ? isoDate(year) : null
      if (date) return result(date, 'high', 'Hill-Rom letter=year (P3200)')
    }
  }

  if (mdl.includes('CENTURY') || mdl.includes('P1400')) {
    const leadYy = s.match(/^(\d{2,3})[A-Z]/)
    if (leadYy) {
      const raw = leadYy[1]
      const yy =
        raw.length === 3
          ? Number.parseInt(raw.slice(0, 2), 10)
          : Number.parseInt(raw, 10)
      if (yy >= 8 && yy <= 30) {
        const parsed = isoFromYyMonth(yy)
        if (parsed) return result(parsed.date, 'medium', 'Hill-Rom leading YY (Century)')
      }
    }
  }

  if (mdl.includes('P1440') || /^[PQMN]\d{2}/.test(s)) {
    const pq = s.match(/^([PQMN])(\d{2})/)
    if (pq) {
      const parsed = isoFromYyMonth(Number.parseInt(pq[2], 10))
      if (parsed) return result(parsed.date, 'high', 'Hill-Rom P1440 letter+YY')
    }
    if (mdl.includes('P1440')) {
      const zeroLead = s.match(/^0?(\d{2})/)
      if (zeroLead) {
        const yy = Number.parseInt(zeroLead[1], 10)
        if (yy >= 8 && yy <= 30) {
          const parsed = isoFromYyMonth(yy)
          if (parsed) return result(parsed.date, 'medium', 'Hill-Rom P1440 0YY')
        }
      }
    }
  }

  if (mfr.includes('hillrom') && /^10[A-Z0-9]/.test(s) && !trailing) {
    const date = isoDate(2010)
    if (date) return result(date, 'medium', 'Hill-Rom 10xx asset tag')
  }

  return null
}

function parseBaxterSerial(serial: string): SerialParseResult | null {
  const raw = serial.trim()
  if (!/^3\d{6,7}$/.test(raw)) return null
  const d = Number.parseInt(raw[1] ?? '', 10)
  if (Number.isNaN(d)) return null
  const date = isoDate(2010 + d)
  if (!date) return null
  return result(date, 'high', 'Baxter 3+X→2010+X')
}

function parseFilacSerial(serial: string, model: string): SerialParseResult | null {
  if (!/filac/i.test(model)) return null
  const s = serial.toUpperCase().trim()
  const aYy = s.match(/^A(\d{2})/)
  if (aYy) {
    const parsed = isoFromYyMonth(Number.parseInt(aYy[1], 10))
    if (parsed) return result(parsed.date, 'medium', 'Welch FILAC A+YY')
  }
  const lead = s.match(/^(\d{2})\d{5,}/)
  if (lead) {
    const parsed = isoFromYyMonth(Number.parseInt(lead[1], 10))
    if (parsed) return result(parsed.date, 'medium', 'Welch FILAC leading YY')
  }
  return null
}

function parseSpotVitalSerial(serial: string): SerialParseResult | null {
  const digits = serial.replace(/\D/g, '')
  if (digits.length >= 8 && /^20\d{2}/.test(digits)) {
    const year = Number.parseInt(digits.slice(0, 4), 10)
    const date = isoDate(year)
    if (date) return result(date, 'high', 'SPOT leading YYYY')
  }
  return null
}

function parseSuretempSerial(serial: string): SerialParseResult | null {
  const s = stripGs21Prefix(serial)
  const digits = s.replace(/\D/g, '')

  if (digits.length >= 8 && digits.startsWith('23')) {
    const parsed = isoFromYyMonth(23)
    if (parsed) return result(parsed.date, 'low', 'SureTemp (21)+YY', false, 0.45)
  }

  if (digits.length >= 6) {
    const yy = Number.parseInt(digits.slice(0, 2), 10)
    if (yy >= 10 && yy <= 26) {
      const parsed = isoFromYyMonth(yy)
      if (parsed) {
        const conf = yy >= 22 ? 0.55 : 0.45
        return result(parsed.date, 'low', 'SureTemp leading YY', false, conf)
      }
    }
    if (digits.startsWith('07') || /074321/i.test(s)) {
      const parsed = isoFromYyMonth(7)
      if (parsed) return result(parsed.date, 'low', 'SureTemp 07-prefix', false, 0.45)
    }
    if (/^7\d{4,8}$/.test(digits) && !digits.startsWith('07')) {
      const weak = isoDate(2004)
      if (weak) return result(weak, 'low', 'SureTemp unclear serial', false, 0.45)
    }
  }

  return null
}

function parseExergenSerial(serial: string, model: string): SerialParseResult | null {
  if (!/exergen|tat/i.test(model)) return null
  const s = serial.toUpperCase().trim()
  const a15 = s.match(/^A(\d{2})/)
  if (a15) {
    const yy = Number.parseInt(a15[1], 10)
    if (yy >= 10 && yy <= 25) {
      const parsed = isoFromYyMonth(yy)
      if (parsed) return result(parsed.date, 'medium', 'Exergen A+YY', false, 0.6)
    }
  }
  return null
}

/**
 * Arjo Flowtron: leading 2 digits = YY → 2000 + YY (FDA recall range 14–16; dataset uses 21).
 */
function parseArjoSerial(serial: string, model: string): SerialParseResult | null {
  if (!/flowtron|acs900/i.test(model)) return null
  const digits = serial.replace(/\D/g, '')
  if (digits.length < 8) return null
  const yy = Number.parseInt(digits.slice(0, 2), 10)
  if (Number.isNaN(yy) || yy < 10 || yy > 30) return null
  const date = isoDate(2000 + yy)
  if (!date) return null
  return result(date, 'high', 'Arjo Flowtron leading YY', false, 0.85)
}

function parseJiangmenSerial(serial: string): SerialParseResult | null {
  const s = serial.toUpperCase()
  // Full date: WU + YYYYMMDD (e.g. WU20240630EN)
  const full = s.match(/WU(20\d{2})(\d{2})(\d{2})/)
  if (full) {
    const year = Number.parseInt(full[1], 10)
    const mm = full[2]
    const dd = full[3]
    const mmNum = Number.parseInt(mm, 10)
    const ddNum = Number.parseInt(dd, 10)
    if (mmNum >= 1 && mmNum <= 12 && ddNum >= 1 && ddNum <= 31) {
      const date = isoDate(year, mm, dd)
      if (date) return result(date, 'high', 'Jiangmen WU+YYYYMMDD', true)
    }
  }
  // Year-only fallback: WU + YYYY
  const m = s.match(/WU(\d{4})/)
  if (!m) return null
  const date = isoDate(Number.parseInt(m[1], 10))
  if (!date) return null
  return result(date, 'high', 'Jiangmen WU+YYYY')
}

function parseCogentixSerial(serial: string): SerialParseResult | null {
  const m = serial.toUpperCase().trim().match(/^CS(\d{2})(\d{2})/)
  if (!m) return null
  const yy = Number.parseInt(m[1], 10)
  const mmNum = Number.parseInt(m[2], 10)
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  const mm =
    mmNum >= 1 && mmNum <= 12 ? String(mmNum).padStart(2, '0') : '06'
  const date = isoDate(year, mm)
  if (!date) return null
  return result(date, 'high', 'Cogentix CS+YY+MM', mmNum >= 1 && mmNum <= 12)
}

function parseBiosonicSerial(serial: string): SerialParseResult | null {
  const digits = serial.replace(/\D/g, '')
  if (digits.length < 6) return null
  const parsed = isoFromYyMonth(Number.parseInt(digits.slice(0, 2), 10))
  if (parsed) return result(parsed.date, 'medium', 'BIOSONIC leading YY')
  return null
}

function parseAmericanDiagnosticSerial(serial: string): SerialParseResult | null {
  const s = serial.toUpperCase().trim()
  const c = s.match(/^C(\d{2})/)
  if (c) {
    const parsed = isoFromYyMonth(Number.parseInt(c[1], 10))
    if (parsed) return result(parsed.date, 'high', 'ADC C+YY')
  }
  if (/^\d{8,}$/.test(s)) {
    const parsed = isoFromYyMonth(Number.parseInt(s.slice(0, 2), 10))
    if (parsed) return result(parsed.date, 'high', 'ADC leading YY')
  }
  return null
}

function parseLabCorpSerial(serial: string, model: string): SerialParseResult | null {
  if (!/642/i.test(model)) return null
  const digits = serial.replace(/\D/g, '')
  if (digits.length < 6) return null
  const yy = Number.parseInt(digits.slice(0, 2), 10)
  const mm = digits.slice(2, 4)
  const dd = digits.slice(4, 6)
  const year = yy >= 70 ? 1900 + yy : 2000 + yy
  const date = isoDate(year, mm, dd)
  if (!date) return null
  return result(date, 'high', 'LabCorp YYMMDD', true)
}

function parseThermoSerial(serial: string): SerialParseResult | null {
  const digits = serial.replace(/\D/g, '')
  if (digits.length < 2) return null
  const parsed = isoFromYyMonth(Number.parseInt(digits.slice(0, 2), 10))
  if (parsed) return result(parsed.date, 'medium', 'Thermo leading YY')
  return null
}

function parseYearPrefixSerial(
  serial: string,
  minYear = 1995,
): SerialParseResult | null {
  const digits = serial.replace(/\D/g, '')
  if (digits.length < 4) return null
  const year = Number.parseInt(digits.slice(0, 4), 10)
  if (year < minYear || year > 2030) return null
  const date = isoDate(year)
  if (!date) return null
  return result(date, 'high', 'Leading YYYY')
}

function parseEmbeddedYyyymmdd(serial: string): SerialParseResult | null {
  const m = serial.match(/(20\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const year = Number.parseInt(m[1], 10)
  const month = m[2]
  const day = m[3]
  const monthNum = Number.parseInt(month, 10)
  const dayNum = Number.parseInt(day, 10)
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null
  const date = isoDate(year, month, day)
  if (!date) return null
  return result(date, 'high', 'Embedded YYYYMMDD', true)
}

function parseUnicoSerial(serial: string): SerialParseResult | null {
  const m = serial.match(/(20\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const date = isoDate(
    Number.parseInt(m[1], 10),
    m[2],
    m[3],
  )
  if (!date) return null
  return result(date, 'high', 'Unico embedded date', true)
}

type ParserFn = (
  manufacturer: string,
  model: string,
  serial: string,
) => SerialParseResult | null

const PARSERS: Array<{ match: (m: string, md: string) => boolean; parse: ParserFn }> = [
  { match: () => true, parse: (_, __, serial) => parseGs1(serial) },
  { match: (m) => m.includes('zoll'), parse: (_, __, s) => parseZollSerial(s) },
  { match: (m) => m.includes('edan'), parse: (_, __, s) => parseEdanSerial(s) },
  { match: (m) => m.includes('masimo'), parse: (_, __, s) => parseMasimoSerial(s) },
  {
    match: (m) => m.includes('philips'),
    parse: (mfr, md, s) => parsePhilipsSerial(s, md, mfr),
  },
  { match: (m) => m.includes('ge'), parse: (_, __, s) => parseGeSerial(s) },
  {
    match: (m) => m.includes('hill'),
    parse: (mfr, md, s) => parseHillromSerial(s, md, mfr),
  },
  { match: (m) => m.includes('baxter'), parse: (_, __, s) => parseBaxterSerial(s) },
  {
    match: (m, md) => m.includes('welch') && /spot vital/i.test(md),
    parse: (_, __, s) => parseSpotVitalSerial(s),
  },
  {
    match: (m, md) => m.includes('welch') && /suretemp/i.test(md),
    parse: (_, __, s) => parseSuretempSerial(s),
  },
  {
    match: (m, md) => m.includes('welch') && /filac/i.test(md),
    parse: (_, md, s) => parseFilacSerial(s, md),
  },
  { match: (m) => m.includes('exergen'), parse: (_, md, s) => parseExergenSerial(s, md) },
  {
    match: (m, md) => m.includes('arjo') && /flowtron|acs900/i.test(md),
    parse: (_, md, s) => parseArjoSerial(s, md),
  },
  { match: (m) => m.includes('jiangmen'), parse: (_, __, s) => parseJiangmenSerial(s) },
  { match: (m) => m.includes('cogentix'), parse: (_, __, s) => parseCogentixSerial(s) },
  { match: (m) => m.includes('biosonic'), parse: (_, __, s) => parseBiosonicSerial(s) },
  {
    match: (m) => m.includes('american diagnostic'),
    parse: (_, __, s) => parseAmericanDiagnosticSerial(s),
  },
  { match: (m) => m.includes('lab corp'), parse: (_, md, s) => parseLabCorpSerial(s, md) },
  { match: (m) => m.includes('thermo'), parse: (_, __, s) => parseThermoSerial(s) },
  { match: (m) => m.includes('unico'), parse: (_, __, s) => parseUnicoSerial(s) },
  {
    match: (m) => m.includes('stryk') || m.includes('linet'),
    parse: (_, __, s) => parseYearPrefixSerial(s, 1998),
  },
  { match: () => true, parse: (_, __, s) => parseEmbeddedYyyymmdd(s) },
]

export function parseManufactureDateFromSerial(
  manufacturer: string,
  model: string,
  serialNumber: string,
): SerialParseResult | null {
  const mfr = manufacturer.toLowerCase()
  const mdl = model.trim()
  const serial = serialNumber.trim()
  if (!serial) return null

  for (const { match, parse } of PARSERS) {
    if (!match(mfr, mdl)) continue
    const hit = parse(manufacturer, mdl, serial)
    if (hit) return hit
  }

  return null
}
