const TAVILY_API_KEY = import.meta.env.VITE_TAVILY_API_KEY ?? ''
const TAVILY_URL = 'https://api.tavily.com/search'
const LS_KEY = 'equiply:tavily_serial_formats'

type TavilyResponse = {
  answer?: string
  results?: Array<{ title: string; content: string; url: string }>
}

// ── Persistent cache (localStorage) ────────────────────────────────────────
function lsRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function lsWrite(key: string, value: string): void {
  try {
    const existing = lsRead()
    existing[key] = value
    localStorage.setItem(LS_KEY, JSON.stringify(existing))
  } catch {}
}

// ── In-memory cache (avoids duplicate in-flight requests) ──────────────────
const memCache = new Map<string, Promise<string | null>>()

export function searchSerialFormat(
  manufacturer: string,
  model: string,
): Promise<string | null> {
  if (!TAVILY_API_KEY) return Promise.resolve(null)

  const key = `${manufacturer.toLowerCase()}|${model.toLowerCase()}`

  // 1. Check in-memory first (covers concurrent requests for the same device)
  const inFlight = memCache.get(key)
  if (inFlight) return inFlight

  // 2. Check localStorage (survives page reloads — no need to re-query Tavily)
  const persisted = lsRead()[key]
  if (persisted) {
    const resolved = Promise.resolve(persisted)
    memCache.set(key, resolved)
    return resolved
  }

  // 3. Hit Tavily, then save to both caches
  const promise = (async (): Promise<string | null> => {
    try {
      const query = `${manufacturer} ${model} serial number format manufacture date encoding year month`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 6000)
      let res: Response
      try {
        res = await fetch(TAVILY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: 'basic',
            max_results: 3,
            include_answer: true,
          }),
        })
      } finally {
        clearTimeout(timer)
      }

      if (!res.ok) return null

      const data = (await res.json()) as TavilyResponse
      const parts: string[] = []

      if (data.answer?.trim()) parts.push(data.answer.trim())
      for (const r of (data.results ?? []).slice(0, 2)) {
        parts.push(`[${r.title}] ${r.content.slice(0, 400)}`)
      }

      const result = parts.length > 0 ? parts.join('\n\n') : null
      if (result) lsWrite(key, result)
      return result
    } catch {
      return null
    }
  })()

  memCache.set(key, promise)
  return promise
}
