import { formatAnchorForLlm, getModelAnchor } from './modelAnchors'
import { searchSerialFormat } from './tavily'

export const DEVICE_TYPE_TAXONOMY = [
  'Imaging/Radiology',
  'Patient Monitoring',
  'Infusion/Pump',
  'Ventilator/Respiratory',
  'Surgical',
  'Diagnostic/Lab',
  'Dialysis',
  'Defibrillator/Cardiac',
  'Endoscopy',
  'Sterilization',
  'Ultrasound',
  'Other',
  'Unknown',
] as const

export type DeviceTypeTaxonomy = (typeof DEVICE_TYPE_TAXONOMY)[number]

export type LlmResult = {
  device_type: string
  estimated_year: number | null
  confidence: number
  reasoning: string
}

// Add your OpenAI API key here to enable LLM fallback
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ''

const SYSTEM_PROMPT = `Medical equipment classifier. Given manufacturer, model, optional FDA label: pick one taxonomy category. High confidence (>0.8) only for well-known lines; use Other/Unknown otherwise. Year must stay within FDA/market window; clearance date is a floor, not build date. Never exceed 2026.`

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    device_type: {
      type: 'string',
      enum: [...DEVICE_TYPE_TAXONOMY],
    },
    estimated_year: {
      type: ['integer', 'null'],
    },
    confidence: {
      type: 'number',
    },
    reasoning: {
      type: 'string',
    },
  },
  required: ['device_type', 'estimated_year', 'confidence', 'reasoning'],
  additionalProperties: false,
} as const

function fallbackResult(reason: string): LlmResult {
  return {
    device_type: 'Unknown',
    estimated_year: null,
    confidence: 0.2,
    reasoning: reason,
  }
}

function normalizeTaxonomy(value: string): string {
  const trimmed = value.trim()
  if ((DEVICE_TYPE_TAXONOMY as readonly string[]).includes(trimmed)) {
    return trimmed
  }
  return 'Unknown'
}

function parseLlmPayload(raw: unknown): LlmResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  const device_type = normalizeTaxonomy(String(obj.device_type ?? 'Unknown'))
  const estimated_year =
    obj.estimated_year === null || obj.estimated_year === undefined
      ? null
      : Number(obj.estimated_year)
  const confidence = Number(obj.confidence)
  const reasoning = String(obj.reasoning ?? '').trim()

  if (!Number.isFinite(confidence)) return null

  return {
    device_type,
    estimated_year:
      estimated_year !== null && Number.isFinite(estimated_year)
        ? Math.round(estimated_year)
        : null,
    confidence: Math.min(1, Math.max(0, confidence)),
    reasoning: reasoning || 'No reasoning provided',
  }
}

export type SerialDecodeResult = {
  manufactured_date: string
  confidence: number
  method: string
}

const SERIAL_DECODE_SYSTEM_PROMPT = `Medical device serial decoder. Extract manufacture date from serial if you recognise the OEM encoding. Return null if uncertain — a wrong date is worse than no date. Date format: YYYY-MM-DD (use -15 for unknown day, -06-15 for unknown month).`

const SERIAL_DECODE_SCHEMA = {
  type: 'object',
  properties: {
    manufactured_date: { type: ['string', 'null'] },
    confidence: { type: 'number' },
    method: { type: 'string' },
  },
  required: ['manufactured_date', 'confidence', 'method'],
  additionalProperties: false,
} as const

export async function decodeSerialWithLlm(
  manufacturer: string,
  model: string,
  serial: string,
): Promise<SerialDecodeResult | null> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.startsWith('REPLACE_')) return null

  // Search Tavily for real-time web documentation about this serial format
  const webContext = await searchSerialFormat(manufacturer, model)

  // Trim Tavily context to 150 chars per snippet — enough for pattern recognition
  const trimmedContext = webContext
    ? webContext.split('\n\n').map(s => s.slice(0, 150)).join(' | ').slice(0, 400)
    : null

  const userContent = trimmedContext
    ? `Context: ${trimmedContext}\nMfr: ${manufacturer} | Model: ${model} | Serial: ${serial}`
    : `Mfr: ${manufacturer} | Model: ${model} | Serial: ${serial}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          max_tokens: 150,
          messages: [
            { role: 'system', content: SERIAL_DECODE_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'serial_decode',
              strict: true,
              schema: SERIAL_DECODE_SCHEMA,
            },
          },
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) return null

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = JSON.parse(content) as {
      manufactured_date: string | null
      confidence: number
      method: string
    }

    if (!parsed.manufactured_date || parsed.confidence < 0.65) return null

    return {
      manufactured_date: parsed.manufactured_date,
      confidence: Math.min(parsed.confidence, 0.82),
      method: parsed.method || 'llm_serial_decode',
    }
  } catch {
    return null
  }
}

export async function classifyDevice(
  manufacturer: string,
  model: string,
  fdaDeviceType: string | null,
  releaseYearHint: number | null = null,
): Promise<LlmResult> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.startsWith('REPLACE_')) {
    return fallbackResult('OpenAI API key not configured')
  }

  const anchor = getModelAnchor(manufacturer, model)
  const yearHint = releaseYearHint ?? anchor?.typicalYear ?? 'none'
  const anchorStr = formatAnchorForLlm(manufacturer, model)
  const userPrompt = `Mfr: ${manufacturer} | Model: ${model} | FDA label: ${fdaDeviceType ?? 'none'} | Window: ${anchorStr} | Year hint: ${yearHint}`

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-5.4-mini',
          max_tokens: 100,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'device_classification',
              strict: true,
              schema: CLASSIFICATION_SCHEMA,
            },
          },
        }),
      })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error('[OpenAI]', response.status, body.slice(0, 300))
      return fallbackResult(`OpenAI request failed (${response.status})`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      return fallbackResult('Empty OpenAI response')
    }

    const parsed = parseLlmPayload(JSON.parse(content))
    if (!parsed) return fallbackResult('Invalid OpenAI JSON payload')

    if (parsed.estimated_year !== null && anchor) {
      parsed.estimated_year = Math.min(
        anchor.ceilingYear,
        Math.max(anchor.floorYear, parsed.estimated_year),
      )
    }
    return parsed
  } catch (error) {
    console.error('[OpenAI] classifyDevice failed:', error)
    return fallbackResult('OpenAI classification error')
  }
}
