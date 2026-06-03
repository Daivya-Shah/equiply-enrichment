import { getModelAnchor, kNumberUrl } from './modelAnchors'
import type { Fda510kBounds } from './fda'
import type { EnrichedRow } from '../types'

const MAX_YEAR = 2026

/** Serial decode methods without public OEM documentation — cap confidence. */
const UNVERIFIED_SERIAL_METHODS = [
  'SureTemp leading YY',
  'Welch A+YY',
  'Welch leading YY',
  'BIOSONIC leading YY',
  'Thermo leading YY',
]

export type DateBounds = {
  floorYear: number
  ceilingYear: number
  kNumber: string | null
  decisionDate: string | null
  anchorNote: string | null
}

export function yearFromDate(iso: string | null | undefined): number | null {
  if (!iso) return null
  const y = Number.parseInt(iso.slice(0, 4), 10)
  return Number.isFinite(y) ? y : null
}

export function resolveDateBounds(
  manufacturer: string,
  model: string,
  fda510k: Fda510kBounds | null,
): DateBounds {
  const anchor = getModelAnchor(manufacturer, model)
  const fdaFloor = fda510k?.floorYear ?? null
  const floorYear = Math.max(
    anchor?.floorYear ?? 1985,
    fdaFloor ?? 1985,
  )
  const ceilingYear = Math.min(
    MAX_YEAR,
    anchor?.ceilingYear ?? MAX_YEAR,
  )
  const kNumber = fda510k?.k_number ?? anchor?.kNumber ?? null
  const decisionDate =
    fda510k?.decision_date ?? anchor?.decisionDate ?? null
  const anchorNote = anchor?.note ?? null

  return {
    floorYear: Math.min(floorYear, ceilingYear),
    ceilingYear,
    kNumber,
    decisionDate,
    anchorNote,
  }
}

/** GE OEM prefix decodes (RTS/RT9/SA3/SPX+YY) must not be raised to a wrong FDA 510(k) floor. */
function isGeOemSerialDecode(source: string, notes: string): boolean {
  return (
    source === 'serial_parse' &&
    /GE (RTS|RT9|SA3|SPX)\+YY/.test(notes)
  )
}

function clampYear(
  year: number,
  bounds: DateBounds,
  source: string,
  notes: string,
): number {
  if (isGeOemSerialDecode(source, notes)) {
    return Math.min(bounds.ceilingYear, year)
  }
  return Math.min(bounds.ceilingYear, Math.max(bounds.floorYear, year))
}

function dateFromYear(year: number, prior: string | null): string {
  const monthDay = prior && prior.length >= 10 ? prior.slice(5) : '06-15'
  return `${year}-${monthDay}`
}

function appendNote(notes: string, addition: string): string {
  const trimmed = notes.trim()
  if (!trimmed) return addition
  if (trimmed.includes(addition)) return trimmed
  return `${trimmed}. ${addition}`
}

function fdaCitation(bounds: DateBounds): string | null {
  if (!bounds.kNumber && !bounds.decisionDate) return null
  const kn = bounds.kNumber ?? ''
  const url = kn ? kNumberUrl(kn) : ''
  const datePart = bounds.decisionDate
    ? `decision_date ${bounds.decisionDate}`
    : ''
  if (kn && datePart) return `FDA ${kn} (${datePart}) ${url}`
  if (kn) return `FDA ${kn} ${url}`
  if (datePart) return `FDA floor ${datePart}`
  return null
}

function capForUnverifiedSerial(notes: string, confidence: number): number {
  const unverified = UNVERIFIED_SERIAL_METHODS.some((m) => notes.includes(m))
  if (!unverified) return confidence
  return Math.min(confidence, 0.74)
}

/** Clamp date to FDA/model window; adjust confidence when adjusted or unverified. */
export function applyDateGuardrails(
  row: EnrichedRow,
  bounds: DateBounds,
): EnrichedRow {
  let { manufactured_date, confidence, notes, source } = row
  const citation = fdaCitation(bounds)
  const boundNote = `Bounds ${bounds.floorYear}–${bounds.ceilingYear}`

  if (citation) {
    notes = appendNote(notes, citation)
  }
  if (bounds.anchorNote && !notes.includes(bounds.anchorNote.slice(0, 40))) {
    notes = appendNote(notes, bounds.anchorNote)
  }

  if (manufactured_date) {
    const year = yearFromDate(manufactured_date)
    if (year !== null) {
      const clamped = clampYear(year, bounds, source, notes)
      if (clamped !== year) {
        manufactured_date = dateFromYear(clamped, manufactured_date)
        confidence = Math.min(confidence, source === 'serial_parse' ? 0.82 : 0.7)
        notes = appendNote(
          notes,
          `Year adjusted from ${year} to ${clamped} (${boundNote})`,
        )
      }
    }
  }

  confidence = capForUnverifiedSerial(notes, confidence)

  if (
    source === 'serial_parse' &&
    UNVERIFIED_SERIAL_METHODS.some((m) => notes.includes(m))
  ) {
    notes = appendNote(notes, 'Serial year decode unverified — hypothesis only')
  }

  return {
    ...row,
    manufactured_date,
    confidence,
    notes: appendNote(notes, boundNote),
    year_floor: bounds.floorYear,
    year_ceiling: bounds.ceilingYear,
  }
}
