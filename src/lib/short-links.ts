import type { Trip } from '@/types'
import { decodeTrips, encodeTrips } from '@/lib/share'
import { renderSharePreview, sharePreviewData } from '@/lib/share-preview'

const API_KEY = 'atd.share.api'

export function shareApiUrl(): string | null {
  try {
    const saved = localStorage.getItem(API_KEY)
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, '')
  } catch {
    // ignore
  }
  const env = (import.meta as { env?: Record<string, string> }).env?.VITE_SHARE_API_URL
  return typeof env === 'string' && env.trim() ? env.trim().replace(/\/$/, '') : null
}

export function setShareApiUrl(value: string | null): void {
  try {
    if (value && value.trim()) localStorage.setItem(API_KEY, value.trim())
    else localStorage.removeItem(API_KEY)
  } catch {
    // ignore
  }
}

/** Загружает сжатый код и PNG-превью в воркер, возвращает короткий URL. */
export async function createShortLink(trips: Trip[]): Promise<string> {
  const api = shareApiUrl()
  if (!api) throw new Error('share api is not configured')
  if (!trips.length) throw new Error('no trips')
  const code = await encodeTrips(trips)
  const summary = sharePreviewData(trips[0] as Trip)
  const png = renderSharePreview(trips[0] as Trip)
  if (!png) throw new Error('preview is not available')

  const response = await fetch(`${api}/api/trips`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      code,
      summary: {
        ...summary,
        title: trips.length > 1 ? `${summary.title} + ещё ${trips.length - 1}` : summary.title,
      },
      png,
    }),
  })
  if (!response.ok) throw new Error(`share api ${response.status}`)
  const data = (await response.json()) as { url?: string }
  if (!data.url) throw new Error('share api returned no url')
  return data.url
}

/** Читает поездки по короткому id из URL воркера. */
export async function loadShortTrips(id: string): Promise<Trip[] | null> {
  const api = shareApiUrl()
  if (!api || !id) return null
  try {
    const response = await fetch(`${api}/api/trips/${id}`)
    if (!response.ok) return null
    const data = (await response.json()) as { code?: string }
    if (!data.code) return null
    return await decodeTrips(data.code)
  } catch {
    return null
  }
}

export function adoptShortLinkApi(): void {
  if (typeof location === 'undefined') return
  const api = new URLSearchParams(location.search).get('api')
  if (api && /^https:\/\//.test(api)) setShareApiUrl(api)
}

export function shortTripIdFromLocation(): string | null {
  if (typeof location === 'undefined') return null
  const query = new URLSearchParams(location.search).get('trip')
  if (query && /^[A-Za-z0-9_-]{4,32}$/.test(query)) return query
  const hash = /(?:^#|&)trip=([A-Za-z0-9_-]{4,32})/.exec(location.hash)
  return hash?.[1] ?? null
}
