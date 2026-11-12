import { computed, ref, watch } from 'vue'
import type {
  AirportStop,
  OriginStop,
  RouteLink,
  StayStop,
  Stop,
  Trip,
} from '@/types'
import { cities, findCity } from '@/data/cities'
import { findResort } from '@/data/resorts'
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
  }
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
      if (parsed && Array.isArray(parsed.stops) && parsed.stops.length > 0) return parsed
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
      if (source.kind === 'origin' && target.kind === 'airport') kind = 'flight'
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
