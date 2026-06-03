import { useCallback } from 'react'
import type { Dispatch } from 'react'
import pLimit from 'p-limit'
import { clearEnrichmentCache, enrichRow } from '../lib/enrichRow'
import type { EnrichedRow, EnrichmentState, RawRow } from '../types'

export type EnrichmentAction =
  | { type: 'SET_ROWS'; payload: RawRow[] }
  | { type: 'START_ENRICHMENT' }
  | { type: 'UPDATE_ROW'; payload: { index: number; row: EnrichedRow } }
  | { type: 'SET_PROGRESS'; payload: number }
  | { type: 'FINISH_ENRICHMENT' }
  | { type: 'SET_ERROR'; payload: string }

function toRawRow(row: EnrichedRow): RawRow {
  return {
    manufacturer: row.manufacturer,
    model: row.model,
    serial_number: row.serial_number,
  }
}

export function useEnrichmentRunner(
  state: EnrichmentState,
  dispatch: Dispatch<EnrichmentAction>,
) {
  const runEnrichment = useCallback(async () => {
    if (state.rows.length === 0) return

    clearEnrichmentCache()
    dispatch({ type: 'START_ENRICHMENT' })
    const total = state.rows.length
    const rawRows = state.rows.map(toRawRow)
    const limit = pLimit(10)
    let completed = 0

    try {
      await Promise.all(
        rawRows.map((row, index) =>
          limit(async () => {
            const enriched = await enrichRow(row)
            dispatch({ type: 'UPDATE_ROW', payload: { index, row: enriched } })
            completed += 1
            dispatch({
              type: 'SET_PROGRESS',
              payload: Math.round((completed / total) * 100),
            })
          }),
        ),
      )
      dispatch({ type: 'FINISH_ENRICHMENT' })
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Enrichment failed' })
    }
  }, [state.rows, dispatch])

  return { runEnrichment }
}
