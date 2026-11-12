import { computed, ref, watch } from 'vue'
import type {
  AirportStop,
  Currency,
  LinkKind,
  MealKey,
  Meals,
  OriginStop,
  RouteLink,
  StayStop,
  Stop,
  Trip,
} from '@/types'
import { cities, findCity } from '@/data/cities'
import { findResort } from '@/data/resorts'
import { defaultMeals, mealOptions } from '@/data/meals'
import { computeCosts } from '@/lib/costs'
import { buildPreset } from '@/data/presets'
import { convertAmount } from '@/lib/currency'

const STORAGE_KEY = 'atd.trip.v1'
const WRITE_DELAY_MS = 400
const GEOCODE_MIN_INTERVAL_MS = 1100
const GEOCODE_TIMEOUT_MS = 8000
const MAX_NIGHTS = 365
const MAX_ROOMS = 20
const MAX_PRICE = 10_000_000

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  integer = false,
): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const bounded = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(bounded) : bounded
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`
}

function heat(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function mealKey(value: unknown, fallback: MealKey): MealKey {
  return mealOptions.some((option) => option.key === value) ? (value as MealKey) : fallback
}

/** Оставляет только валидное время HH:MM. */
function normalizeTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return undefined
  return value
}

/** Оставляет только валидные даты YYYY-MM-DD. */
function normalizeDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? undefined : value
}

function defaultOrigin(): OriginStop {
  const city =
    findCity('moscow-svo') ??
    cities[0] ?? {
      id: 'moscow-svo',
      city: 'Москва',
      code: 'SVO',
      airport: 'Шереметьево',
      country: 'Россия',
      lat: 55.9726,
      lng: 37.4146,
    }
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
    placeKind: 'resort',
    resortId: '',
    resort: '',
    hotel: '',
    lat: 0,
    lng: 0,
    nights,
    rooms: 1,
    hotelPerNight: 0,
    hotelStars: 0,
    skipassDays: Math.max(0, nights - 1),
    skipassPerDay: 0,
    meals: { ...defaultMeals },
  }
}

function normalizeMeals(meals: Partial<Meals> | undefined): Meals {
  return {
    breakfast: mealKey(meals?.breakfast, defaultMeals.breakfast),
    lunch: mealKey(meals?.lunch, defaultMeals.lunch),
    dinner: mealKey(meals?.dinner, defaultMeals.dinner),
  }
}

/**
 * Единая нормализация поездки: вызывается при загрузке из localStorage
 * и из библиотеки сохранённых поездок, чтобы старые данные не роняли UI.
 */
export function normalizeTrip(input: Trip): Trip {
  const trip = input

  if (!Array.isArray(trip.stops)) trip.stops = []
  if (!Array.isArray(trip.links)) trip.links = []

  trip.pax = Math.min(20, Math.max(1, Math.round(heat(trip.pax, 1))))
  trip.returnFlight = Math.max(0, heat(trip.returnFlight, 0))
  trip.returnHours = Math.max(0, heat(trip.returnHours, 0))
  trip.budget = trip.budget === null || trip.budget === undefined ? null : Math.max(0, heat(trip.budget, 0))
  if (!['RUB', 'EUR', 'USD', 'GEL', 'KZT'].includes(trip.currency)) trip.currency = 'RUB'
  if (!trip.name) trip.name = 'Поездка в горы'
  if (!trip.createdAt) trip.createdAt = new Date().toISOString()

  for (const stop of trip.stops) {
    if (!stop.id) stop.id = uid()
    if (stop.kind === 'stay') {
      stop.nights = clampNumber(stop.nights, 0, MAX_NIGHTS, 0, true)
      stop.rooms = clampNumber(stop.rooms, 1, MAX_ROOMS, 1, true)
      stop.hotelPerNight = clampNumber(stop.hotelPerNight, 0, MAX_PRICE, 0)
      stop.hotelStars = Math.min(5, Math.max(0, Math.round(heat(stop.hotelStars, 0))))
      stop.checkIn = normalizeDate(stop.checkIn)
      stop.skipassDays = clampNumber(stop.skipassDays, 0, MAX_NIGHTS, 0, true)
      stop.skipassPerDay = clampNumber(stop.skipassPerDay, 0, MAX_PRICE, 0)
      stop.lat = heat(stop.lat, 0)
      stop.lng = heat(stop.lng, 0)
      stop.placeKind = stop.placeKind === 'city' ? 'city' : 'resort'
      stop.cityId = stop.cityId ?? ''
      stop.city = stop.city ?? ''
      stop.country = stop.country ?? undefined
      stop.meals = normalizeMeals(stop.meals)
      stop.hotel = stop.hotel ?? ''
      stop.resort = stop.resort ?? ''
      stop.resortId = stop.resortId ?? ''
    } else {
      stop.city = stop.city ?? ''
      stop.code = stop.code ?? ''
      stop.cityId = stop.cityId ?? ''
      stop.lat = heat(stop.lat, 0)
      stop.lng = heat(stop.lng, 0)
    }
  }

  const neededLinks = Math.max(0, trip.stops.length - 1)
  trip.links = trip.links.slice(0, neededLinks).map((link) => ({
    kind: link.kind ?? 'flight',
    price: Math.max(0, heat(link.price, 0)),
    hours: Math.max(0, heat(link.hours, 0)),
    date: normalizeDate(link.date),
    time: normalizeTime(link.time),
    note: link.note,
  }))
  while (trip.links.length < neededLinks) {
    trip.links.push({ kind: 'flight', price: 0, hours: 0 })
  }

  normalizeLinks(trip)
  return trip
}

function kindFor(source: Stop | undefined, target: Stop | undefined, fallback: LinkKind): LinkKind {
  if (!source || !target) return fallback
  if (target.kind === 'airport') return 'flight'
  if (source.kind === 'airport') return 'transfer'
  if (source.kind === 'origin' && target.kind === 'stay') return 'transfer'
  if (source.kind === 'stay' && target.kind === 'stay') return 'move'
  return fallback
}

function normalizeLinks(current: Trip): void {
  current.links = current.links.map((link, index) => ({
    ...link,
    kind: kindFor(current.stops[index], current.stops[index + 1], link.kind),
  }))
}

function emptyTrip(): Trip {
  return {
    id: uid(),
    name: 'Поездка в горы',
    pax: 1,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [defaultOrigin()],
    links: [],
    createdAt: new Date().toISOString(),
  }
}

function isoFromToday(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  return date.toISOString().slice(0, 10)
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
    placeKind: 'resort',
    country: 'Австрия',
    resort: 'Ишгль',
    hotel: 'Hotel Elisabeth',
    checkIn: isoFromToday(14),
    lat: 47.015,
    lng: 10.288,
    nights: 7,
    rooms: 1,
    hotelStars: 4,
    hotelPerNight: 16000,
    skipassDays: 6,
    skipassPerDay: 4200,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'hotel' },
  }
  const stAnton: StayStop = {
    id: uid(),
    kind: 'stay',
    resortId: 'st-anton',
    placeKind: 'resort',
    country: 'Австрия',
    resort: 'Санкт-Антон',
    hotel: 'Hotel Alte Post',
    checkIn: isoFromToday(21),
    lat: 47.129,
    lng: 10.266,
    nights: 3,
    rooms: 1,
    hotelStars: 3,
    hotelPerNight: 9000,
    skipassDays: 3,
    skipassPerDay: 4500,
    meals: { breakfast: 'hotel', lunch: 'slope', dinner: 'cafe' },
  }

  return normalizeTrip({
    id: uid(),
    name: 'Ишгль + Санкт-Антон',
    pax: 2,
    currency: 'RUB',
    budget: 320000,
    returnFlight: 30000,
    returnHours: 4.5,
    stops: [origin, airport, ischgl, stAnton],
    links: [
      { kind: 'flight', price: 28000, hours: 4.5, note: 'SVO → INN' },
      { kind: 'transfer', price: 11000, hours: 1.2, note: 'трансфер из аэропорта' },
      { kind: 'move', price: 4500, hours: 0.8, note: 'переезд между курортами' },
    ],
    createdAt: new Date().toISOString(),
  })
}

function loadTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Trip
      if (parsed && Array.isArray(parsed.stops) && parsed.stops.length > 0) {
        return normalizeTrip(parsed)
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

let writeTimer: number | null = null

function persistTrip(): void {
  if (writeTimer !== null) {
    window.clearTimeout(writeTimer)
    writeTimer = null
  }
  try {
    if (trip.value) localStorage.setItem(STORAGE_KEY, JSON.stringify(trip.value))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage может быть недоступен — MVP работает и без сохранения
  }
}

watch(
  trip,
  () => {
    if (writeTimer !== null) window.clearTimeout(writeTimer)
    writeTimer = window.setTimeout(persistTrip, WRITE_DELAY_MS)
  },
  { deep: true },
)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', persistTrip)
  window.addEventListener('pagehide', persistTrip)
}

export const costs = computed(() => (trip.value ? computeCosts(trip.value) : null))

export function createTrip(): void {
  trip.value = emptyTrip()
  editingLinkIndex.value = null
  persistTrip()
}

/** Загружает готовый маршрут из data/presets.ts. */
export function loadPreset(id: string): boolean {
  const preset = buildPreset(id)
  if (!preset) return false
  trip.value = normalizeTrip(preset)
  editingLinkIndex.value = null
  persistTrip()
  return true
}

export function loadExample(): void {
  trip.value = exampleTrip()
  editingLinkIndex.value = null
  persistTrip()
}

export function resetTrip(): void {
  trip.value = null
  editingLinkIndex.value = null
  persistTrip()
}

export function patchMeta(
  patch: Partial<Pick<Trip, 'name' | 'pax' | 'currency' | 'budget' | 'returnFlight' | 'returnHours'>>,
): void {
  if (!trip.value) return
  Object.assign(trip.value, patch)
  if (typeof patch.pax === 'number') {
    trip.value.pax = Math.min(20, Math.max(1, Math.round(patch.pax)))
  }
  if (typeof patch.returnFlight === 'number') {
    trip.value.returnFlight = Math.max(0, patch.returnFlight)
  }
  if (typeof patch.returnHours === 'number') {
    trip.value.returnHours = Math.max(0, patch.returnHours)
  }
}

/** Пересчёт всех денежных сумм поездки при смене валюты. */
export function changeCurrency(next: Currency): void {
  const current = trip.value
  if (!current || current.currency === next) return
  const from = current.currency

  current.returnFlight = convertAmount(current.returnFlight, from, next)
  if (current.budget !== null) current.budget = convertAmount(current.budget, from, next)

  for (const link of current.links) {
    link.price = convertAmount(link.price, from, next)
  }

  for (const stop of current.stops) {
    if (stop.kind !== 'stay') continue
    stop.hotelPerNight = convertAmount(stop.hotelPerNight, from, next)
    stop.skipassPerDay = convertAmount(stop.skipassPerDay, from, next)
  }

  current.currency = next
}

function findStop<K extends Stop['kind']>(
  id: string,
  kind: K,
): Extract<Stop, { kind: K }> | undefined {
  const stop = trip.value?.stops.find((item) => item.id === id)
  if (!stop || stop.kind !== kind) return undefined
  return stop as Extract<Stop, { kind: K }>
}

export function patchOrigin(id: string, patch: Partial<Omit<OriginStop, 'id' | 'kind'>>): void {
  const stop = findStop(id, 'origin')
  if (stop) Object.assign(stop, patch)
}

export function patchAirport(id: string, patch: Partial<Omit<AirportStop, 'id' | 'kind'>>): void {
  const stop = findStop(id, 'airport')
  if (stop) Object.assign(stop, patch)
}

export function patchStay(id: string, patch: Partial<Omit<StayStop, 'id' | 'kind'>>): void {
  const stop = findStop(id, 'stay')
  if (!stop) return
  Object.assign(stop, patch)
  if (typeof patch.nights === 'number') {
    stop.nights = clampNumber(patch.nights, 0, MAX_NIGHTS, stop.nights, true)
  }
  if (typeof patch.rooms === 'number') {
    stop.rooms = clampNumber(patch.rooms, 1, MAX_ROOMS, stop.rooms, true)
  }
  if (typeof patch.hotelPerNight === 'number') {
    stop.hotelPerNight = clampNumber(patch.hotelPerNight, 0, MAX_PRICE, 0)
  }
  if (typeof patch.skipassDays === 'number') {
    stop.skipassDays = clampNumber(patch.skipassDays, 0, MAX_NIGHTS, 0, true)
  }
  if (typeof patch.skipassPerDay === 'number') {
    stop.skipassPerDay = clampNumber(patch.skipassPerDay, 0, MAX_PRICE, 0)
  }
  if (typeof patch.hotelStars === 'number') {
    stop.hotelStars = clampNumber(patch.hotelStars, 0, 5, 0, true)
  }
}

export function patchLink(index: number, patch: Partial<RouteLink>): void {
  const link = trip.value?.links[index]
  if (!link) return
  Object.assign(link, patch)
}

/** Добавляет перелёт: сначала из города вылета, дальше — из отеля. */
export function addFlight(hours = 4): void {
  if (!trip.value) return
  trip.value.stops.push(emptyAirport())
  trip.value.links.push({ kind: 'flight', price: 0, hours })
  normalizeLinks(trip.value)
}

export function addTransfer(): void {
  if (!trip.value) return
  const stay = emptyStay(7)
  stay.checkIn = nextCheckIn()
  trip.value.stops.push(stay)
  trip.value.links.push({ kind: 'transfer', price: 0, hours: 1.5 })
  normalizeLinks(trip.value)
}

export function addMove(): void {
  if (!trip.value) return
  const stay = emptyStay(3)
  stay.checkIn = nextCheckIn()
  trip.value.stops.push(stay)
  trip.value.links.push({ kind: 'move', price: 0, hours: 1 })
  normalizeLinks(trip.value)
}

/** Дата заезда для новой точки: выезд предыдущего отеля, иначе undefined. */
function nextCheckIn(): string | undefined {
  const stays = (trip.value?.stops ?? []).filter(
    (stop): stop is StayStop => stop.kind === 'stay' && Boolean(stop.checkIn),
  )
  const last = stays[stays.length - 1]
  if (!last?.checkIn) return undefined
  const date = new Date(`${last.checkIn}T00:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  date.setDate(date.getDate() + Math.max(0, Math.round(last.nights)))
  return date.toISOString().slice(0, 10)
}

/**
 * Удаляет точку маршрута. Если у неё есть соседи с обеих сторон,
 * участки объединяются: суммы и часы сохраняются, чтобы смета не «теряла» деньги.
 */
export function removeStop(id: string): void {
  const current = trip.value
  if (!current) return
  const index = current.stops.findIndex((stop) => stop.id === id)
  if (index <= 0) return

  const incoming = index - 1 < current.links.length ? current.links[index - 1] : undefined
  const outgoing = index < current.links.length ? current.links[index] : undefined

  current.stops.splice(index, 1)

  if (incoming && outgoing) {
    const notes = [incoming.note, outgoing.note].filter(Boolean).join(' + ')
    current.links.splice(index - 1, 2, {
      kind: incoming.kind,
      price: incoming.price + outgoing.price,
      hours: incoming.hours + outgoing.hours,
      note: notes || undefined,
    })
  } else if (incoming) {
    current.links.splice(index - 1, 1)
  } else if (outgoing) {
    current.links.splice(index, 1)
  }

  normalizeLinks(current)
}

export function selectCity(stopId: string, cityId: string): void {
  const city = findCity(cityId)
  if (!city) return
  const stop = trip.value?.stops.find((item) => item.id === stopId)
  if (!stop) return
  if (stop.kind === 'origin' || stop.kind === 'airport') {
    patchOriginOrAirport(stop.id, {
      cityId: city.id,
      city: city.city,
      code: city.code,
      lat: city.lat,
      lng: city.lng,
    })
  }
}

function patchOriginOrAirport(
  id: string,
  patch: Partial<Omit<OriginStop, 'id' | 'kind'>>,
): void {
  const stop = trip.value?.stops.find((item) => item.id === id)
  if (!stop) return
  if (stop.kind === 'origin') patchOrigin(id, patch)
  else if (stop.kind === 'airport') patchAirport(id, patch)
}

export function selectResort(stopId: string, resortId: string): void {
  const resort = findResort(resortId)
  if (!resort) return
  patchStay(stopId, {
    placeKind: 'resort',
    resortId: resort.id,
    resort: resort.name,
    cityId: '',
    city: '',
    country: resort.country,
    lat: resort.lat,
    lng: resort.lng,
    hotelLat: undefined,
    hotelLng: undefined,
  })
}

/**
 * Выбор города вместо курорта: используется, чтобы вернуться с курорта в город
 * (ночёвка в городе перед вылетом домой).
 */
export function selectStayCity(stopId: string, cityId: string): void {
  const city = findCity(cityId)
  if (!city) return
  patchStay(stopId, {
    placeKind: 'city',
    cityId: city.id,
    city: city.city,
    country: city.country,
    resortId: '',
    resort: '',
    lat: city.lat,
    lng: city.lng,
    hotelLat: undefined,
    hotelLng: undefined,
  })
}

export function setStayPlaceKind(stopId: string, placeKind: StayStop['placeKind']): void {
  const stop = findStop(stopId, 'stay')
  if (!stop || stop.placeKind === placeKind) return
  patchStay(stopId, {
    placeKind,
    resortId: '',
    resort: '',
    cityId: '',
    city: '',
    country: undefined,
    lat: 0,
    lng: 0,
    hotelLat: undefined,
    hotelLng: undefined,
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

/** Ближайший отель после указанной точки — нужен для подсказки аэропортов прилёта. */
export function nextStayAfter(stopId: string): StayStop | undefined {
  const stops = trip.value?.stops ?? []
  const index = stops.findIndex((stop) => stop.id === stopId)
  if (index < 0) return undefined
  for (let i = index + 1; i < stops.length; i += 1) {
    const stop = stops[i]
    if (stop && stop.kind === 'stay' && stop.resortId) return stop
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
    if (stop && stop.kind === 'airport') return stop
  }
  return undefined
}

export function patchMeals(stopId: string, meal: keyof Meals, value: MealKey): void {
  const stop = findStop(stopId, 'stay')
  if (!stop) return
  stop.meals = { ...stop.meals, [meal]: mealKey(value, 'none') }
}

export type GeocodeStatus = 'ok' | 'notfound' | 'error'

let lastGeocodeAt = 0

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * Поиск координат отеля через Nominatim.
 * Соблюдает лимит OSM (≤1 запрос в секунду) и таймаут на запрос.
 */
export async function geocodeHotel(stopId: string): Promise<GeocodeStatus> {
  const stop = findStop(stopId, 'stay')
  if (!stop || !stop.hotel.trim() || !stop.resort.trim()) return 'notfound'

  const wait = lastGeocodeAt + GEOCODE_MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastGeocodeAt = Date.now()

  const resort = findResort(stop.resortId)
  const query = [stop.hotel, stop.resort, resort?.country].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), GEOCODE_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return 'error'
    const data = (await response.json()) as Array<{ lat: string; lon: string }>
    const first = data[0]
    if (!first) return 'notfound'
    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'notfound'
    stop.hotelLat = lat
    stop.hotelLng = lng
    return 'ok'
  } catch {
    return 'error'
  } finally {
    window.clearTimeout(timeout)
  }
}