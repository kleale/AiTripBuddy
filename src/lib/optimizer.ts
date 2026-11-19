import type { Currency, LinkKind, RouteLink, StayStop, TransportMode, Trip } from '@/types'
import { findResort, type Resort } from '@/data/resorts'
import { guideFor, guidePassPerDay } from '@/data/resort-guides'
import { hotelsFor, hotelOfferCoords } from '@/data/hotels'
import { defaultMeals } from '@/data/meals'
import { convertGuideAmount } from '@/lib/currency'
import { distanceKm } from '@/lib/geo'
import { computeCosts } from '@/lib/costs'
import { addDays } from '@/lib/schedule'
import { hotelNightly } from '@/lib/hotel-search'
import { linkPriceHint, hotelPriceHint, skipassPriceHint } from '@/lib/price-hints'
import { seasonRange } from '@/lib/season'

export type OptimizerProfile = 'cheapest' | 'balanced' | 'premium' | 'freeride' | 'family'

export interface OptimizerInput {
  resortIds: string[]
  startDate: string
  nights: number
  pax: number
  rooms: number
  budget: number | null
  currency: Currency
  profile: OptimizerProfile
  minNights: number
  maxTransferHours: number
}

export interface OptimizerTransfer {
  fromId: string
  toId: string
  fromName: string
  toName: string
  mode: TransportMode
  kind: LinkKind
  km: number
  hours: number
  price: number
  confidence: 'estimate' | 'manual'
}

export interface OptimizerStay {
  resortId: string
  name: string
  nights: number
  checkIn: string
  hotel: string
  stars: number
  hotelNightly: number
  skipassPerDay: number
}

export interface OptimizerVariant {
  id: string
  order: string[]
  stays: OptimizerStay[]
  transfers: OptimizerTransfer[]
  total: number
  perPerson: number
  perRideDay: number
  rideDays: number
  travelHours: number
  comfort: number
  seasonFactor: number
  score: number
  warnings: string[]
  trip: Trip
}

export const profileLabels: Record<OptimizerProfile, string> = {
  cheapest: 'Дешевле',
  balanced: 'Баланс',
  premium: 'Комфорт',
  freeride: 'Фрирайд',
  family: 'С семьёй',
}

const weights: Record<OptimizerProfile, { cost: number; time: number; ride: number; comfort: number; season: number }> = {
  cheapest: { cost: 0.6, time: 0.15, ride: 0.1, comfort: 0.05, season: 0.1 },
  balanced: { cost: 0.35, time: 0.2, ride: 0.2, comfort: 0.15, season: 0.1 },
  premium: { cost: 0.15, time: 0.1, ride: 0.2, comfort: 0.4, season: 0.15 },
  freeride: { cost: 0.2, time: 0.1, ride: 0.3, comfort: 0.15, season: 0.25 },
  family: { cost: 0.25, time: 0.3, ride: 0.15, comfort: 0.3, season: 0.1 },
}

const MAX_VARIANTS = 10_000

function round(value: number): number {
  return Math.max(0, Math.round(value))
}

export function transferBetween(
  from: Resort,
  to: Resort,
  pax: number,
  currency: Currency,
): OptimizerTransfer {
  const km = distanceKm(from, to)
  const mode: TransportMode = km > 420 ? 'plane' : km > 140 ? 'train' : 'car'
  const kind: LinkKind = mode === 'plane' ? 'flight' : 'move'
  const hint = linkPriceHint(
    { kind, transport: mode, price: 0, hours: 0 } as RouteLink,
    from,
    to,
    pax,
    currency,
  )
  const hours =
    mode === 'plane' ? 4 + km / 750 : mode === 'train' ? 0.5 + km / 70 : 0.3 + km / 55
  return {
    fromId: from.id,
    toId: to.id,
    fromName: from.name,
    toName: to.name,
    mode,
    kind,
    km: Math.round(km),
    hours: Math.round(hours * 10) / 10,
    price: round(hint?.typical ?? 0),
    confidence: 'estimate',
  }
}

function buildVariant(input: OptimizerInput, order: string[], nights: number[]): OptimizerVariant | null {
  const resorts = order.map((id) => findResort(id)).filter((item): item is Resort => Boolean(item))
  if (resorts.length !== order.length) return null
  const pax = Math.max(1, input.pax)
  const rooms = Math.max(1, input.rooms)
  const stays: OptimizerStay[] = []
  const tripStays: StayStop[] = []
  const links: RouteLink[] = []
  const transfers: OptimizerTransfer[] = []
  const warnings: string[] = []
  let cursor = input.startDate
  let comfort = 0
  let seasonFactor = 0

  for (let index = 0; index < resorts.length; index += 1) {
    const resort = resorts[index] as Resort
    const stayNights = Math.max(1, nights[index] ?? 1)
    const guide = guideFor(resort.id)
    const season = seasonRange(cursor, stayNights, resort)
    const factor = season?.factor || 1
    seasonFactor += factor

    const offers = hotelsFor(resort.id)
      .map((offer) => ({ offer, nightly: hotelNightly(offer, input.currency, factor) }))
      .sort((a, b) => a.nightly - b.nightly)
    const selected = offers[0]
    const fallback = hotelPriceHint(
      {
        id: `optimizer-${resort.id}`,
        kind: 'stay',
        placeKind: 'resort',
        resortId: resort.id,
        resort: resort.name,
        country: resort.country,
        hotel: '',
        lat: resort.lat,
        lng: resort.lng,
        nights: stayNights,
        rooms,
        hotelPerNight: 0,
        hotelSource: null,
        hotelStars: 3,
        skipassDays: stayNights,
        skipassPerDay: 0,
        meals: defaultMeals,
        foodPerDayOverride: null,
        checkIn: cursor,
      },
      input.currency,
      { pax, rooms },
    )
    const hotel = selected
      ? {
          name: selected.offer.name,
          stars: selected.offer.stars,
          nightly: selected.nightly,
          coords: hotelOfferCoords(selected.offer),
        }
      : {
          name: `Отель в ${resort.name}`,
          stars: 3,
          nightly: fallback.typical,
          coords: { lat: resort.lat, lng: resort.lng },
        }
    if (!selected) warnings.push(`В ${resort.name} нет курируемого отеля — цена отеля оценена.`)
    comfort += hotel.stars

    const pass = guide ? guidePassPerDay(guide) : null
    const passFallback = skipassPriceHint(
      {
        id: `optimizer-pass-${resort.id}`,
        kind: 'stay',
        placeKind: 'resort',
        resortId: resort.id,
        resort: resort.name,
        country: resort.country,
        hotel: '',
        lat: resort.lat,
        lng: resort.lng,
        nights: stayNights,
        rooms,
        hotelPerNight: 0,
        hotelSource: null,
        hotelStars: 3,
        skipassDays: stayNights,
        skipassPerDay: 0,
        meals: defaultMeals,
        foodPerDayOverride: null,
        checkIn: cursor,
      },
      input.currency,
    )
    const passPerDay = pass
      ? convertGuideAmount(pass.amount, pass.currency, input.currency)
      : passFallback?.typical ?? 0

    stays.push({
      resortId: resort.id,
      name: resort.name,
      nights: stayNights,
      checkIn: cursor,
      hotel: hotel.name,
      stars: hotel.stars,
      hotelNightly: hotel.nightly,
      skipassPerDay: passPerDay,
    })

    tripStays.push({
      id: `optimizer-stay-${index}`,
      kind: 'stay',
      placeKind: 'resort',
      resortId: resort.id,
      resort: resort.name,
      country: resort.country,
      cityId: undefined,
      city: undefined,
      hotel: hotel.name,
      lat: resort.lat,
      lng: resort.lng,
      hotelLat: hotel.coords?.lat,
      hotelLng: hotel.coords?.lng,
      nights: stayNights,
      rooms,
      maxGuests: 2,
      checkIn: cursor,
      hotelPerNight: hotel.nightly,
      hotelSource: null,
      hotelStars: hotel.stars,
      skipassDays: stayNights,
      skipassPerDay: passPerDay,
      meals: defaultMeals,
      foodPerDayOverride: null,
    })

    cursor = addDays(cursor, stayNights)

    const next = resorts[index + 1]
    if (next) {
      const transfer = transferBetween(resort, next, pax, input.currency)
      if (transfer.hours > input.maxTransferHours) {
        warnings.push(`Переезд ${resort.name} → ${next.name} длиннее лимита: ${transfer.hours} ч.`)
      }
      transfers.push(transfer)
      links.push({
        kind: transfer.kind,
        transport: transfer.mode,
        price: transfer.price,
        hours: transfer.hours,
        date: cursor,
        time: '09:00',
        note: `Оптимизатор: ${transfer.fromName} → ${transfer.toName}`,
      })
    }
  }

  const trip: Trip = {
    id: `optimizer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Оптимизатор: ${resorts.map((resort) => resort.name).join(' → ')}`,
    pax,
    currency: input.currency,
    budget: input.budget,
    returnFlight: 0,
    returnHours: 0,
    stops: tripStays,
    links,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const costs = computeCosts(trip)
  if (input.budget && costs.total > input.budget) {
    warnings.push(`Бюджет превышен на ${formatDelta(costs.total - input.budget, input.currency)}.`)
  }
  if (costs.nights !== input.nights) warnings.push('Сумма ночей не совпала с запросом.')

  return {
    id: `${order.join('-')}-${nights.join('-')}`,
    order,
    stays,
    transfers,
    total: costs.total,
    perPerson: Math.round(costs.perPerson),
    perRideDay: Math.round(costs.perRideDay),
    rideDays: costs.rideDays,
    travelHours: Math.round(costs.travelHours * 10) / 10,
    comfort: Math.round((comfort / resorts.length) * 10) / 10,
    seasonFactor: Math.round((seasonFactor / resorts.length) * 100) / 100,
    score: 0,
    warnings,
    trip,
  }
}

function formatDelta(value: number, currency: Currency): string {
  return `${round(value)} ${currency}`
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const result: T[][] = []
  for (let index = 0; index < items.length; index += 1) {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const tail of permutations(rest)) result.push([items[index] as T, ...tail])
  }
  return result
}

function allocations(total: number, parts: number, min: number): number[][] {
  const result: number[][] = []
  const walk = (left: number, slot: number, current: number[]): void => {
    if (slot === parts - 1) {
      if (left >= min) result.push([...current, left])
      return
    }
    for (let value = min; value <= left - min * (parts - slot - 1); value += 1) {
      walk(left - value, slot + 1, [...current, value])
    }
  }
  walk(total, 0, [])
  return result
}

function dominates(a: OptimizerVariant, b: OptimizerVariant): boolean {
  const aValues = [a.total, a.travelHours, -a.rideDays, -a.comfort, a.seasonFactor]
  const bValues = [b.total, b.travelHours, -b.rideDays, -b.comfort, b.seasonFactor]
  let better = false
  for (let index = 0; index < aValues.length; index += 1) {
    if ((aValues[index] as number) > (bValues[index] as number)) return false
    if ((aValues[index] as number) < (bValues[index] as number)) better = true
  }
  return better
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 1
  return (value - min) / (max - min)
}

function scoreAll(variants: OptimizerVariant[], profile: OptimizerProfile): void {
  if (!variants.length) return
  const totalMin = Math.min(...variants.map((item) => item.total))
  const totalMax = Math.max(...variants.map((item) => item.total))
  const timeMin = Math.min(...variants.map((item) => item.travelHours))
  const timeMax = Math.max(...variants.map((item) => item.travelHours))
  const rideMin = Math.min(...variants.map((item) => item.rideDays))
  const rideMax = Math.max(...variants.map((item) => item.rideDays))
  const comfortMin = Math.min(...variants.map((item) => item.comfort))
  const comfortMax = Math.max(...variants.map((item) => item.comfort))
  const seasonMin = Math.min(...variants.map((item) => item.seasonFactor))
  const seasonMax = Math.max(...variants.map((item) => item.seasonFactor))
  const w = weights[profile]
  for (const variant of variants) {
    variant.score =
      w.cost * (1 - normalize(variant.total, totalMin, totalMax)) +
      w.time * (1 - normalize(variant.travelHours, timeMin, timeMax)) +
      w.ride * normalize(variant.rideDays, rideMin, rideMax) +
      w.comfort * normalize(variant.comfort, comfortMin, comfortMax) +
      w.season * (1 - normalize(variant.seasonFactor, seasonMin, seasonMax))
  }
}

function pickDistinct(
  variants: OptimizerVariant[],
  chooser: (item: OptimizerVariant) => number,
): OptimizerVariant | null {
  return [...variants].sort((a, b) => chooser(a) - chooser(b) || b.score - a.score)[0] ?? null
}

export function optimizeTrip(input: OptimizerInput): OptimizerVariant[] {
  const ids = [...new Set(input.resortIds)].slice(0, 4)
  if (ids.length < 2 || input.nights < ids.length * Math.max(1, input.minNights)) return []
  const min = Math.max(1, Math.min(input.minNights, Math.floor(input.nights / ids.length)))
  const allocationsList = allocations(input.nights, ids.length, min)
  const variants: OptimizerVariant[] = []
  const seen = new Set<string>()

  for (const order of permutations(ids)) {
    for (const nights of allocationsList) {
      if (variants.length >= MAX_VARIANTS) break
      const key = `${order.join('|')}-${nights.join('|')}`
      if (seen.has(key)) continue
      seen.add(key)
      const variant = buildVariant(input, order, nights)
      if (variant) variants.push(variant)
    }
    if (variants.length >= MAX_VARIANTS) break
  }

  scoreAll(variants, input.profile)
  const frontier = variants.filter((a) => !variants.some((b) => b !== a && dominates(b, a)))

  const selected: OptimizerVariant[] = []
  const push = (item: OptimizerVariant | null): void => {
    if (item && !selected.some((existing) => existing.id === item.id)) selected.push(item)
  }
  const pool = frontier.length ? frontier : variants
  push(pickDistinct(pool, (item) => item.total))
  push(pickDistinct(pool, (item) => -item.score))
  push(pickDistinct(pool, (item) => -item.comfort || item.total))
  push(pickDistinct(pool, (item) => item.seasonFactor - item.rideDays * 0.01 || item.total))
  if (selected.length < 3) {
    for (const item of [...variants].sort((a, b) => b.score - a.score)) {
      push(item)
      if (selected.length >= 3) break
    }
  }
  return selected.slice(0, 4)
}

export function defaultOptimizerInput(currency: Currency = 'RUB'): OptimizerInput {
  const start = new Date()
  start.setDate(start.getDate() + 45)
  return {
    resortIds: [],
    startDate: start.toISOString().slice(0, 10),
    nights: 8,
    pax: 2,
    rooms: 1,
    budget: null,
    currency,
    profile: 'balanced',
    minNights: 2,
    maxTransferHours: 12,
  }
}
