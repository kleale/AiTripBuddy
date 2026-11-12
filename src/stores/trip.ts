import { computed, ref, watch } from 'vue'
import type {
  AirportStop,
  Meals,
  OriginStop,
  RouteLink,
  StayStop,
  Stop,
  Trip,
} from '@/types'
import { cities, findCity } from '@/data/cities'
import { findResort } from '@/data/resorts'
import { defaultMeals } from '@/data/meals'
import { computeCosts } from '@/lib/costs'

const STORAGE_KEY = 'atd.trip.v1'

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`
}

function defaultOrigin(): OriginStop {
  const city = findCity('moscow-svo') ?? cities[0]!
  return {
    id: uid(),
    kind: 'origin',
    cityId: city.id,
    city: city.city,
    code: city.code,
    lat: city.lat,
    lng: city.lng,
  }
}

function emptyAirport(): AirportStop {
  return {
    id: uid(),
    kind: 'airport',
    cityId: '',
    city: '',
    code: '',
    lat: 0,
    lng: 0,
  }
}

function emptyStay(nights: number): StayStop {
  return {
    id: uid(),
    kind: 'stay',
    resortId: '',
    resort: '',
    hotel: '',
    lat: 0,
    lng: 0,
    nights,
    hotelPerNight: 0,
    skipassDays: Math.max(0, nights - 1),
    skipassPerDay: 0,
    foodPerDay: 0,
    meals: { ...defaultMeals },
  }
}

/** Миграция старых сохранений: добавляем питание и координаты отеля. */
function migrateTrip(trip: Trip): Trip {
  for (const stop of trip.stops) {
    if (stop.kind !== 'stay') continue
    if (!stop.meals) {
      stop.meals = stop.foodPerDay > 0 ? { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' } : { ...defaultMeals }
    }
  }
  return trip
}

function emptyTrip(): Trip {
  return {
    id: uid(),
    name: 'Поездка в горы',
    pax: 1,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    stops: [defaultOrigin()],
    links: [],
    createdAt: new Date().toISOString(),
  }
}

function exampleTrip(): Trip {
  const origin = defaultOrigin()
  const airport: AirportStop = {
    id: uid(),
    kind: 'airport',
    cityId: 'innsbruck-inn',
    city: 'Инсбрук',
    code: 'INN',
    lat: 47.2602,
    lng: 11.344,
  }
  const ischgl: StayStop = {
    id: uid(),
    kind: 'stay',
    resortId: 'ischgl',
    resort: 'Ишгль',
    hotel: 'Hotel Elisabeth',
    lat: 47.015,
    lng: 10.288,
    nights: 7,
    hotelPerNight: 8000,
    skipassDays: 6,
    skipassPerDay: 4200,
    foodPerDay: 2500,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'hotel' },
  }
  const stAnton: StayStop = {
    id: uid(),
    kind: 'stay',
    resortId: 'st-anton',
    resort: 'Санкт-Антон',
    hotel: 'Hotel Alte Post',
    lat: 47.129,
    lng: 10.266,
    nights: 3,
    hotelPerNight: 9000,
    skipassDays: 3,
    skipassPerDay: 4500,
    foodPerDay: 2800,
    meals: { breakfast: 'hotel', lunch: 'slope', dinner: 'cafe' },
  }

  return {
    id: uid(),
    name: 'Ишгль + Санкт-Антон',
    pax: 2,
    currency: 'RUB',
    budget: 320000,
    returnFlight: 30000,
    stops: [origin, airport, ischgl, stAnton],
    links: [
      { kind: 'flight', price: 28000, hours: 4.5, note: 'SVO → INN' },
      { kind: 'transfer', price: 11000, hours: 1.2, note: 'трансфер из аэропорта' },
      { kind: 'move', price: 4500, hours: 0.8, note: 'переезд между курортами' },
    ],
    createdAt: new Date().toISOString(),
  }
}

function loadTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Trip
      if (parsed && Array.isArray(parsed.stops) && parsed.stops.length > 0) {
        return migrateTrip(parsed)
      }
    }
  } catch {
    // ignore broken storage
  }

  if (typeof location !== 'undefined' && location.search.includes('demo')) {
    return exampleTrip()
  }

  return null
}

export const trip = ref<Trip | null>(loadTrip())
export const editingLinkIndex = ref<number | null>(null)

watch(
  trip,
  (value) => {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      // storage может быть недоступен — MVP работает и без сохранения
    }
  },
  { deep: true },
)

export const costs = computed(() => (trip.value ? computeCosts(trip.value) : null))

function normalizeLinks(): void {
  const current = trip.value
  if (!current) return
  current.links = current.links.map((link, index) => {
    const source = current.stops[index]
    const target = current.stops[index + 1]
    let kind = link.kind
    if (source && target) {
      if (target.kind === 'airport' && (source.kind === 'origin' || source.kind === 'stay')) kind = 'flight'
      else if (source.kind === 'airport') kind = 'transfer'
      else if (source.kind === 'stay' && target.kind === 'stay') kind = 'move'
    }
    return { ...link, kind }
  })
}

export function createTrip(): void {
  trip.value = emptyTrip()
  editingLinkIndex.value = null
}

export function loadExample(): void {
  trip.value = exampleTrip()
  editingLinkIndex.value = null
}

export function resetTrip(): void {
  trip.value = null
  editingLinkIndex.value = null
}

export function patchMeta(patch: Partial<Pick<Trip, 'name' | 'pax' | 'currency' | 'budget' | 'returnFlight'>>): void {
  if (!trip.value) return
  Object.assign(trip.value, patch)
  if (typeof patch.pax === 'number') {
    trip.value.pax = Math.min(20, Math.max(1, Math.round(patch.pax)))
  }
}

export function patchStop(
  id: string,
  patch: Partial<OriginStop> | Partial<AirportStop> | Partial<StayStop>,
): void {
  const stop = trip.value?.stops.find((item) => item.id === id)
  if (!stop) return
  Object.assign(stop, patch)
}

export function patchLink(index: number, patch: Partial<RouteLink>): void {
  const link = trip.value?.links[index]
  if (!link) return
  Object.assign(link, patch)
}

export function addFlight(): void {
  if (!trip.value) return
  trip.value.stops.push(emptyAirport())
  trip.value.links.push({ kind: 'flight', price: 0, hours: 4 })
  normalizeLinks()
}

export function addFlightLeg(): void {
  if (!trip.value) return
  trip.value.stops.push(emptyAirport())
  trip.value.links.push({ kind: 'flight', price: 0, hours: 3 })
  normalizeLinks()
}

export function addTransfer(): void {
  if (!trip.value) return
  trip.value.stops.push(emptyStay(7))
  trip.value.links.push({ kind: 'transfer', price: 0, hours: 1.5 })
  normalizeLinks()
}

export function addMove(): void {
  if (!trip.value) return
  trip.value.stops.push(emptyStay(3))
  trip.value.links.push({ kind: 'move', price: 0, hours: 1 })
  normalizeLinks()
}

export function removeStop(id: string): void {
  const current = trip.value
  if (!current) return
  const index = current.stops.findIndex((stop) => stop.id === id)
  if (index <= 0) return
  current.stops.splice(index, 1)
  current.links.splice(index - 1, 1)
  normalizeLinks()
}

export function selectCity(stopId: string, cityId: string): void {
  const city = findCity(cityId)
  if (!city) return
  patchStop(stopId, {
    cityId: city.id,
    city: city.city,
    code: city.code,
    lat: city.lat,
    lng: city.lng,
  })
}

export function selectResort(stopId: string, resortId: string): void {
  const resort = findResort(resortId)
  if (!resort) return
  const stop = trip.value?.stops.find((item) => item.id === stopId)
  if (stop && stop.kind === 'stay') {
    stop.hotelLat = undefined
    stop.hotelLng = undefined
  }
  patchStop(stopId, {
    resortId: resort.id,
    resort: resort.name,
    lat: resort.lat,
    lng: resort.lng,
  })
}

export function openLinkEditor(index: number): void {
  editingLinkIndex.value = index
}

export function closeLinkEditor(): void {
  editingLinkIndex.value = null
}

export function removeSection(index: number): void {
  const current = trip.value
  if (!current) return
  const target = current.stops[index + 1]
  if (target) removeStop(target.id)
  editingLinkIndex.value = null
}

export function stopById(id: string): Stop | undefined {
  return trip.value?.stops.find((stop) => stop.id === id)
}

/** Ближайший отель после указанной точки — нужен для подсказки аэропортов прилёта. */
export function nextStayAfter(stopId: string): StayStop | undefined {
  const stops = trip.value?.stops ?? []
  const index = stops.findIndex((stop) => stop.id === stopId)
  if (index < 0) return undefined
  for (let i = index + 1; i < stops.length; i += 1) {
    const stop = stops[i]
    if (!stop) continue
    if (stop.kind === 'stay' && stop.resortId) return stop
  }
  return undefined
}

/** Предыдущий отель перед указанной точкой — нужен для подсказки аэропорта вылета. */
export function previousStayBefore(stopId: string): StayStop | undefined {
  const stops = trip.value?.stops ?? []
  const index = stops.findIndex((stop) => stop.id === stopId)
  if (index < 0) return undefined
  for (let i = index - 1; i >= 0; i -= 1) {
    const stop = stops[i]
    if (!stop) continue
    if (stop.kind === 'stay' && stop.resortId) return stop
  }
  return undefined
}

/** Аэропорт, через который турист попал в этот отель (ближайший аэропорт выше по маршруту). */
export function arrivalAirportFor(stopId: string): AirportStop | undefined {
  const stops = trip.value?.stops ?? []
  const index = stops.findIndex((stop) => stop.id === stopId)
  if (index < 0) return undefined
  for (let i = index - 1; i >= 0; i -= 1) {
    const stop = stops[i]
    if (!stop) continue
    if (stop.kind === 'airport') return stop
  }
  return undefined
}

export function patchMeals(stopId: string, meal: keyof Meals, value: Meals[keyof Meals]): void {
  const stop = trip.value?.stops.find((item) => item.id === stopId)
  if (!stop || stop.kind !== 'stay') return
  stop.meals = { ...stop.meals, [meal]: value }
}

/** Поиск координат отеля через Nominatim; при ошибке возвращает false. */
export async function geocodeHotel(stopId: string): Promise<boolean> {
  const stop = trip.value?.stops.find((item) => item.id === stopId)
  if (!stop || stop.kind !== 'stay' || !stop.hotel.trim() || !stop.resort.trim()) return false

  const resort = findResort(stop.resortId)
  const query = [stop.hotel, stop.resort, resort?.country].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!response.ok) return false
    const data = (await response.json()) as Array<{ lat: string; lon: string }>
    const first = data[0]
    if (!first) return false
    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
    stop.hotelLat = lat
    stop.hotelLng = lng
    return true
  } catch {
    return false
  }
}
