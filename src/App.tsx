import { useReducer, useState } from 'react'
import { DeviceTypePie } from './components/DeviceTypePie'
import { EnrichmentTable } from './components/EnrichmentTable'
import { ExportButton } from './components/ExportButton'
import { StatsBar } from './components/StatsBar'
import { Uploader } from './components/Uploader'
import type { EnrichmentAction } from './hooks/useEnrichment'
import { useEnrichmentRunner } from './hooks/useEnrichment'
import { rawToEnrichedStub } from './lib/enrichRow'
import type { EnrichmentState, RawRow } from './types'

const initialState: EnrichmentState = {
  status: 'idle',
  rows: [],
  progress: 0,
}

function enrichmentReducer(
  state: EnrichmentState,
  action: EnrichmentAction,
): EnrichmentState {
  switch (action.type) {
    case 'SET_ROWS':
      return { ...state, status: 'idle', progress: 0, rows: action.payload.map(rawToEnrichedStub) }
    case 'START_ENRICHMENT':
      return { ...state, status: 'loading', progress: 0 }
    case 'UPDATE_ROW': {
      const rows = [...state.rows]
      rows[action.payload.index] = action.payload.row
      return { ...state, rows }
    }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload }
    case 'FINISH_ENRICHMENT':
      return { ...state, status: 'done', progress: 100 }
    case 'SET_ERROR':
      return { ...state, status: 'error', progress: 0 }
    default:
      return state
  }
}

function Divider() {
  return <hr className="border-slate-100" />
}

function App() {
  const [state, dispatch] = useReducer(enrichmentReducer, initialState)
  const [hasUploadedCsv, setHasUploadedCsv] = useState(false)
  const { runEnrichment } = useEnrichmentRunner(state, dispatch)

  const handleParsed = (rows: RawRow[]) => {
    dispatch({ type: 'SET_ROWS', payload: rows })
    setHasUploadedCsv(true)
  }

  const isLoading = state.status === 'loading'

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto max-w-5xl px-6 py-14 space-y-8">

        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Equipment Enrichment
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Upload a hospital equipment CSV to enrich manufactured dates and device types.
          </p>
        </header>

        <Divider />

        {/* Upload */}
        <section className="space-y-4">
          <Uploader onParsed={handleParsed} disabled={isLoading} />

          {hasUploadedCsv && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => { void runEnrichment() }}
                disabled={isLoading || state.rows.length === 0}
                className="shrink-0 rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? `Enriching… ${state.progress}%` : 'Enrich Data'}
              </button>
              {isLoading && (
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-green-600 transition-all duration-300"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              )}
              {state.status === 'error' && (
                <p className="text-sm text-red-500">Enrichment failed. Try again.</p>
              )}
            </div>
          )}
        </section>

        {/* Results */}
        {state.rows.length > 0 && (
          <>
            <Divider />

            {/* Stats */}
            <section>
              <StatsBar rows={state.rows} />
            </section>

            <Divider />

            {/* Table */}
            <section>
              <EnrichmentTable rows={state.rows} isLoading={isLoading} />
            </section>

            <Divider />

            {/* Charts */}
            <section>
              <DeviceTypePie rows={state.rows} />
            </section>

            <Divider />

            {/* Export */}
            <section className="flex justify-end">
              <ExportButton rows={state.rows} status={state.status} />
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
