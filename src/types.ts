export type RawRow = {
  manufacturer: string
  model: string
  serial_number: string
}

export type EnrichmentSource =
  | 'fda_udi_exact'
  | 'fda_udi_fuzzy'
  | 'fda_510k'
  | 'llm'
  | 'serial_parse'
  | 'model_reference'
  | 'none'

export type EnrichedRow = RawRow & {
  manufactured_date: string | null
  device_type: string | null
  confidence: number
  source: EnrichmentSource
  notes: string
  /** Inclusive regulatory / market window used for guardrails */
  year_floor?: number | null
  year_ceiling?: number | null
}

export type EnrichmentState = {
  status: 'idle' | 'loading' | 'done' | 'error'
  rows: EnrichedRow[]
  progress: number
}
