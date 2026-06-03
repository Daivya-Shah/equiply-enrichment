import { classifyDevice, decodeSerialWithLlm } from './llm'
import { inferDeviceTypeFromModel } from './deviceRules'
import { applyDateGuardrails, resolveDateBounds } from './dateGuardrails'
import {
  getModelAnchor,
  getModelReferenceConfidence,
  getModelReleaseYear,
} from './modelAnchors'
import { parseManufactureDateFromSerial } from './serialParse'
import { mapToTaxonomy } from './taxonomy'
import {
  fda510kToBounds,
  search510k,
  searchUdiExact,
  searchUdiFuzzy,
} from './fda'
import type { EnrichedRow, RawRow } from '../types'

const UDI_DATE_PROXY_NOTE =
  'Date: FDA UDI database publish date used as proxy (actual build date may be slightly later). Type: translated from FDA device label.'
const K510_DATE_PROXY_NOTE =
  'Date: FDA 510(k) clearance date used as floor — device cannot exist before regulatory approval. Type: from FDA 510(k) submission.'

function serialNote(method: string): string {
  const isWeb = method.startsWith('llm') || method.includes('web') || method.includes('tavily')
  return isWeb
    ? `Date: serial number decoded using format found via Tavily web search + GPT-4o (${method}). Type: see below.`
    : `Date: decoded directly from serial number using ${method} OEM encoding format. Type: identified by manufacturer/model keyword rules.`
}

const enrichCache = new Map<string, Promise<EnrichedRow>>()

function cacheKey(row: RawRow): string {
  return `${row.manufacturer}|${row.model}|${row.serial_number}`
}

function resolveDeviceType(
  manufacturer: string,
  model: string,
  fdaLabel: string | null | undefined,
): string {
  const fromRules = inferDeviceTypeFromModel(manufacturer, model)
  if (fromRules) return fromRules
  if (fdaLabel) return mapToTaxonomy(fdaLabel, manufacturer, model)
  return 'Unknown'
}

function fdaConflictsWithModelRules(
  manufacturer: string,
  model: string,
  fdaLabel: string,
): boolean {
  const ruleType = inferDeviceTypeFromModel(manufacturer, model)
  if (!ruleType) return false
  const mapped = mapToTaxonomy(fdaLabel, manufacturer, model)
  return mapped !== ruleType
}

function rowFromSerialAndType(
  base: RawRow,
  serialParsed: NonNullable<ReturnType<typeof parseManufactureDateFromSerial>>,
  device_type: string,
  ruleType: string | null,
): EnrichedRow {
  let confidence = serialParsed.confidence
  if (ruleType) confidence = Math.max(confidence, 0.92)

  return {
    manufacturer: base.manufacturer,
    model: base.model,
    serial_number: base.serial_number,
    manufactured_date: serialParsed.manufactured_date,
    device_type,
    confidence,
    source: 'serial_parse',
    notes: serialNote(serialParsed.method),
  }
}

async function maybeCorrect510kDeviceType(row: EnrichedRow): Promise<EnrichedRow> {
  if (row.source !== 'fda_510k' || !row.device_type) return row

  const ruleType = inferDeviceTypeFromModel(row.manufacturer, row.model)
  if (ruleType) {
    return {
      ...row,
      device_type: ruleType,
      confidence: Math.max(row.confidence, 0.78),
      notes: `${row.notes} Device type from model/manufacturer rules.`,
    }
  }

  const llm = await classifyDevice(row.manufacturer, row.model, row.device_type)
  if (llm.confidence > 0.7 && llm.device_type !== 'Unknown') {
    return {
      ...row,
      device_type: llm.device_type,
      confidence: Math.max(row.confidence, 0.7),
      notes: `${row.notes} Type re-classified by GPT-4o: ${llm.reasoning}`,
    }
  }

  return row
}

function modelReferenceRow(
  row: RawRow,
  device_type: string,
  year: number,
): EnrichedRow {
  const anchor = getModelAnchor(row.manufacturer, row.model)
  const confidence = getModelReferenceConfidence(row.manufacturer, row.model)
  const isMidpoint =
    /pluma|plum a|flowtron|174|sequential|midpoint|model_release/i.test(
      `${row.model} ${anchor?.note ?? ''}`,
    )
  const notePrefix = isMidpoint ? 'model_release_estimate: ' : 'Product-line estimate: '
  return {
    manufacturer: row.manufacturer,
    model: row.model,
    serial_number: row.serial_number,
    manufactured_date: `${year}-06-15`,
    device_type,
    confidence,
    source: 'model_reference',
    notes: anchor?.note
      ? `Date: estimated from curated product-line release window (${notePrefix}${anchor.note}). Type: from manufacturer/model rules.`
      : 'Date: estimated from known product-line market window — serial number contained no date code. Type: from manufacturer/model rules.',
  }
}

async function finalizeRow(
  row: EnrichedRow,
  manufacturer: string,
  model: string,
  prefetched510k: Awaited<ReturnType<typeof search510k>>,
): Promise<EnrichedRow> {
  const bounds = resolveDateBounds(
    manufacturer,
    model,
    fda510kToBounds(prefetched510k),
  )
  let out = applyDateGuardrails(row, bounds)
  if (prefetched510k?.k_number && !out.notes.includes(prefetched510k.k_number)) {
    out = {
      ...out,
      notes: `${out.notes}. FDA 510(k) ${prefetched510k.k_number} (decision ${prefetched510k.raw_decision_date})`,
    }
  }
  return out
}

async function enrichWithLlm(row: RawRow): Promise<EnrichedRow> {
  const manufacturer = row.manufacturer.trim()
  const model = row.model.trim()
  const serial_number = row.serial_number.trim()

  const ruleType = inferDeviceTypeFromModel(manufacturer, model)
  const serialParsed = parseManufactureDateFromSerial(
    manufacturer,
    model,
    serial_number,
  )
  const releaseYear = getModelReleaseYear(manufacturer, model)

  if (ruleType && (serialParsed || releaseYear)) {
    return {
      manufacturer,
      model,
      serial_number,
      manufactured_date:
        serialParsed?.manufactured_date ??
        (releaseYear ? `${releaseYear}-06-15` : null),
      device_type: ruleType,
      confidence: serialParsed ? 0.85 : 0.7,
      source: serialParsed ? 'serial_parse' : 'model_reference',
      notes: serialParsed
        ? serialNote(serialParsed.method)
        : 'Device type + approximate year without LLM',
    }
  }

  const llm = await classifyDevice(manufacturer, model, null, releaseYear)
  const device_type =
    ruleType ?? (llm.device_type !== 'Unknown' ? llm.device_type : null)

  let manufactured_date = serialParsed?.manufactured_date ?? null
  if (!manufactured_date && releaseYear) {
    manufactured_date = `${releaseYear}-06-15`
  } else if (!manufactured_date && llm.estimated_year !== null) {
    const anchor = getModelAnchor(manufacturer, model)
    let y = llm.estimated_year
    if (anchor) {
      y = Math.min(anchor.ceilingYear, Math.max(anchor.floorYear, y))
    }
    manufactured_date = `${y}-06-15`
  }

  let confidence = 0.42
  let source: EnrichedRow['source'] = 'llm'
  if (releaseYear && device_type) {
    confidence = 0.65
    source = 'model_reference'
  } else if (ruleType && manufactured_date) {
    confidence = 0.72
  } else if (ruleType) {
    confidence = 0.55
  } else if (serialParsed) {
    confidence = 0.62
    source = 'serial_parse'
  }

  return {
    manufacturer,
    model,
    serial_number,
    device_type,
    manufactured_date,
    confidence,
    source,
    notes:
      source === 'model_reference'
        ? `Date: estimated from product-line release window. Type: classified by GPT-4o — ${llm.reasoning}`
        : `Date: estimated by GPT-4o within the known market window for this model. Type: AI-classified from 13 fixed categories — ${llm.reasoning}`,
  }
}

function failureRow(row: RawRow): EnrichedRow {
  return {
    ...row,
    manufactured_date: null,
    device_type: null,
    confidence: 0,
    source: 'none',
    notes: 'No enrichment source matched — serial had no date code, no FDA record found, and AI could not confidently classify this device.',
  }
}

async function enrichRowPipeline(row: RawRow): Promise<EnrichedRow> {
  const manufacturer = row.manufacturer.trim()
  const model = row.model.trim()
  const serial_number = row.serial_number.trim()
  // Fire 510k prefetch and Tavily+LLM serial decode in parallel — they're independent
  const [k510Prefetch, llmSerial] = await Promise.all([
    search510k(manufacturer, model),
    decodeSerialWithLlm(manufacturer, model, serial_number),
  ])

  // Fall back to hardcoded OEM rules if web search + LLM couldn't decode it
  const hardcodedSerial = !llmSerial
    ? parseManufactureDateFromSerial(manufacturer, model, serial_number)
    : null

  const serialParsed = llmSerial
    ? {
        manufactured_date: llmSerial.manufactured_date,
        confidence: llmSerial.confidence,
        method: llmSerial.method,
        source: 'serial_parse' as const,
        tier: 'medium' as const,
      }
    : hardcodedSerial

  const ruleType = inferDeviceTypeFromModel(manufacturer, model)
  const releaseYear = getModelReleaseYear(manufacturer, model)

  // Step 1 — OEM serial date + device type
  if (serialParsed) {
    if (ruleType) {
      return finalizeRow(
        rowFromSerialAndType(
          { manufacturer, model, serial_number },
          serialParsed,
          ruleType,
          ruleType,
        ),
        manufacturer,
        model,
        k510Prefetch,
      )
    }

    const udiExact = await searchUdiExact(manufacturer, model)
    if (
      udiExact?.device_type &&
      !fdaConflictsWithModelRules(manufacturer, model, udiExact.device_type)
    ) {
      return finalizeRow(
        rowFromSerialAndType(
          { manufacturer, model, serial_number },
          serialParsed,
          resolveDeviceType(manufacturer, model, udiExact.device_type),
          null,
        ),
        manufacturer,
        model,
        k510Prefetch,
      )
    }

    const udiFuzzy = await searchUdiFuzzy(manufacturer, model)
    if (
      udiFuzzy?.device_type &&
      !fdaConflictsWithModelRules(manufacturer, model, udiFuzzy.device_type)
    ) {
      return finalizeRow(
        rowFromSerialAndType(
          { manufacturer, model, serial_number },
          serialParsed,
          resolveDeviceType(manufacturer, model, udiFuzzy.device_type),
          null,
        ),
        manufacturer,
        model,
        k510Prefetch,
      )
    }
  }

  // Step 6 — Product-line year + model rules (no serial date; skip UDI date proxy)
  if (!serialParsed && ruleType && releaseYear) {
    return finalizeRow(
      modelReferenceRow(
        { manufacturer, model, serial_number },
        ruleType,
        releaseYear,
      ),
      manufacturer,
      model,
      k510Prefetch,
    )
  }

  // Step 2 — FDA UDI exact
  const udiExact = await searchUdiExact(manufacturer, model)
  if (
    udiExact?.device_type &&
    !fdaConflictsWithModelRules(manufacturer, model, udiExact.device_type)
  ) {
    return finalizeRow(
      {
        manufacturer,
        model,
        serial_number,
        manufactured_date:
          serialParsed?.manufactured_date ?? udiExact.manufactured_date,
        device_type: resolveDeviceType(manufacturer, model, udiExact.device_type),
        confidence: serialParsed ? 0.9 : 0.72,
        source: 'fda_udi_exact',
        notes: serialParsed
          ? serialNote(serialParsed.method)
          : UDI_DATE_PROXY_NOTE,
      },
      manufacturer,
      model,
      k510Prefetch,
    )
  }

  // Step 3 — FDA UDI fuzzy
  const udiFuzzy = await searchUdiFuzzy(manufacturer, model)
  if (
    udiFuzzy?.device_type &&
    !fdaConflictsWithModelRules(manufacturer, model, udiFuzzy.device_type)
  ) {
    return finalizeRow(
      {
        manufacturer,
        model,
        serial_number,
        manufactured_date:
          serialParsed?.manufactured_date ?? udiFuzzy.manufactured_date,
        device_type: resolveDeviceType(manufacturer, model, udiFuzzy.device_type),
        confidence: serialParsed ? 0.88 : 0.68,
        source: 'fda_udi_fuzzy',
        notes: serialParsed
          ? serialNote(serialParsed.method)
          : UDI_DATE_PROXY_NOTE,
      },
      manufacturer,
      model,
      k510Prefetch,
    )
  }

  // Step 4 — Model rules (+ serial or product-line year)
  if (ruleType) {
    if (serialParsed) {
      return finalizeRow(
        rowFromSerialAndType(
          { manufacturer, model, serial_number },
          serialParsed,
          ruleType,
          ruleType,
        ),
        manufacturer,
        model,
        k510Prefetch,
      )
    }
    if (releaseYear) {
      return finalizeRow(
        modelReferenceRow(
          { manufacturer, model, serial_number },
          ruleType,
          releaseYear,
        ),
        manufacturer,
        model,
        k510Prefetch,
      )
    }
    return finalizeRow(
      {
        manufacturer,
        model,
        serial_number,
        manufactured_date: null,
        device_type: ruleType,
        confidence: 0.58,
        source: 'model_reference',
        notes: 'Device type from model rules; manufacture date unknown',
      },
      manufacturer,
      model,
      k510Prefetch,
    )
  }

  // Step 5 — FDA 510(k)
  if (k510Prefetch) {
    const k510Row: EnrichedRow = {
      manufacturer,
      model,
      serial_number,
      manufactured_date:
        serialParsed?.manufactured_date ?? k510Prefetch.manufactured_date,
      device_type: resolveDeviceType(manufacturer, model, k510Prefetch.device_type),
      confidence: serialParsed ? 0.82 : 0.58,
      source: 'fda_510k',
      notes: serialParsed
        ? serialNote(serialParsed.method)
        : `${K510_DATE_PROXY_NOTE} (${k510Prefetch.k_number || '510(k)'})`,
    }
    return finalizeRow(
      await maybeCorrect510kDeviceType(k510Row),
      manufacturer,
      model,
      k510Prefetch,
    )
  }

  // Step 7 — Product-line year + FDA/LLM type
  if (releaseYear) {
    const udiForType = await searchUdiExact(manufacturer, model)
    const device_type = udiForType?.device_type
      ? resolveDeviceType(manufacturer, model, udiForType.device_type)
      : null
    if (device_type && device_type !== 'Unknown') {
      return finalizeRow(
        {
          manufacturer,
          model,
          serial_number,
          manufactured_date: `${releaseYear}-06-15`,
          device_type,
          confidence: 0.7,
          source: 'model_reference',
          notes: 'Product-line year + FDA device type',
        },
        manufacturer,
        model,
        k510Prefetch,
      )
    }
  }

  // Step 8 — LLM last resort
  const llmRow = await enrichWithLlm({
    manufacturer,
    model,
    serial_number,
  })
  if (llmRow.confidence > 0) {
    return finalizeRow(llmRow, manufacturer, model, k510Prefetch)
  }

  return finalizeRow(
    failureRow({ manufacturer, model, serial_number }),
    manufacturer,
    model,
    k510Prefetch,
  )
}

async function enrichRowInner(row: RawRow): Promise<EnrichedRow> {
  return enrichRowPipeline(row)
}

/** Cascading enrichment waterfall per row (memoized). */
export function enrichRow(row: RawRow): Promise<EnrichedRow> {
  const key = cacheKey(row)
  const cached = enrichCache.get(key)
  if (cached) return cached

  const promise = enrichRowInner(row)
  enrichCache.set(key, promise)
  return promise
}

export function clearEnrichmentCache(): void {
  enrichCache.clear()
}

export function rawToEnrichedStub(row: RawRow): EnrichedRow {
  return {
    ...row,
    manufactured_date: null,
    device_type: null,
    confidence: 0,
    source: 'none',
    notes: '',
    year_floor: null,
    year_ceiling: null,
  }
}

export function sortRowsByManufacturedDate(rows: EnrichedRow[]): EnrichedRow[] {
  return [...rows].sort((a, b) => {
    if (!a.manufactured_date && !b.manufactured_date) return 0
    if (!a.manufactured_date) return 1
    if (!b.manufactured_date) return -1
    return a.manufactured_date.localeCompare(b.manufactured_date)
  })
}
