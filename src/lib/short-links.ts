import type { Trip } from '@/types'
import { decodeTrips, encodeTrips } from '@/lib/share'
import { renderSharePreview, sharePreviewData } from '@/lib/share-preview'

const SHARE_API = 'https://atb-share.atb-share--triopsklre.workers.dev'

export function shareApiUrl(): string {
  return SHARE_API
}

/** Загружает сжатый код и PNG-превью в воркер, возвращает короткий URL. */
export async function createShortLink(trips: Trip[]): Promise<string> {
  if (!trips.length) throw new Error('no trips')
  const code = await encodeTrips(trips)
  const summary = sharePreviewData(trips[0] as Trip)
  const png = renderSharePreview(trips[0] as Trip)
  if (!png) throw new Error('preview is not available')

  const response = await fetch(`${SHARE_API}/api/trips`, {
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
  if (!id) return null
  try {
    const response = await fetch(`${SHARE_API}/api/trips/${id}`)
    if (!response.ok) return null
    const data = (await response.json()) as { code?: string }
    if (!data.code) return null
    return await decodeTrips(data.code)
  } catch {
    return null
  }
}

export function shortTripIdFromLocation(): string | null {
  if (typeof location === 'undefined') return null
  const query = new URLSearchParams(location.search).get('trip')
  if (query && /^[A-Za-z0-9_-]{4,32}$/.test(query)) return query
  const hash = /(?:^#|&)trip=([A-Za-z0-9_-]{4,32})/.exec(location.hash)
  return hash?.[1] ?? null
}
