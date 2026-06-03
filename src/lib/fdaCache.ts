import type { Fda510kBounds } from './fda'

export type CachedFda510k = Fda510kBounds & {
  device_type?: string
  manufactured_date?: string
}

type FdaModelCacheFile = Record<string, CachedFda510k>

let cachePromise: Promise<FdaModelCacheFile | null> | null = null

function cacheKey(manufacturer: string, model: string): string {
  return `${manufacturer.trim()}|${model.trim()}`
}

async function loadCacheFile(): Promise<FdaModelCacheFile | null> {
  try {
    const res = await fetch('/fda-model-cache.json')
    if (!res.ok) return null
    return (await res.json()) as FdaModelCacheFile
  } catch {
    return null
  }
}

function getCache(): Promise<FdaModelCacheFile | null> {
  if (!cachePromise) cachePromise = loadCacheFile()
  return cachePromise
}

export async function getCached510kBounds(
  manufacturer: string,
  model: string,
): Promise<CachedFda510k | null> {
  const file = await getCache()
  if (!file) return null
  const hit = file[cacheKey(manufacturer, model)]
  return hit ?? null
}

export function resetFdaCacheLoad(): void {
  cachePromise = null
}
