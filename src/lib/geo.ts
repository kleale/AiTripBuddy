export interface Coords {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

/** Расстояние по большому кругу, км. */
export function distanceKm(a: Coords, b: Coords): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return '—'
  if (km < 1) return `${Math.round(km * 1000)} м`
  if (km < 10) return `${km.toFixed(1)} км`
  return `${Math.round(km)} км`
}

function hashSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/**
 * Детерминированное смещение внутри курортной зоны.
 * Нужно, чтобы отель без точных координат не совпадал с центром курорта.
 */
export function hotelOffset(resort: Coords, hotelName: string): Coords {
  const seed = hashSeed(hotelName || 'hotel')
  const angle = ((seed % 360) * Math.PI) / 180
  const radiusKm = 0.25 + ((seed >> 9) % 200) / 100
  const latOffset = (radiusKm / 111) * Math.cos(angle)
  const lngOffset = (radiusKm / (111 * Math.cos(toRadians(resort.lat) || 1))) * Math.sin(angle)
  return { lat: resort.lat + latOffset, lng: resort.lng + lngOffset }
}

/** Точка отеля: явные координаты, иначе смещение внутри курортной зоны. */
export function hotelCoords(
  resort: Coords,
  hotelName: string,
  explicit?: { lat?: number; lng?: number },
): Coords | null {
  if (explicit?.lat && explicit?.lng && Number.isFinite(explicit.lat) && Number.isFinite(explicit.lng)) {
    return { lat: explicit.lat, lng: explicit.lng }
  }
  if (!hotelName.trim()) return null
  return hotelOffset(resort, hotelName)
}