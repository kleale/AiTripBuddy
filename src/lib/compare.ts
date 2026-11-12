import type { Trip } from '@/types'
import { computeCosts } from './costs'
import { convertAmount } from './currency'
import { guideFor } from '@/data/resort-guides'
import { slopePassport, type SlopePassport } from './slope'

export interface TripMetrics {
  id: string
  name: string
  currency: Trip['currency']
  pax: number
  total: number
  totalRub: number
  perPersonRub: number
  perRideDayRub: number
  rideDays: number
  nights: number
  stays: number
  rooms: number
  avgStars: number
  avgHotelPerNightRub: number
  foodPerDayRub: number
  skipassPerDayRub: number
  travelHours: number
  budget: number | null
  budgetUsage: number | null
  resorts: string
  /** Сводный паспорт склонов по отелям, для которых есть гид. */
  slope: SlopePassport | null
}

/** Сводные метрики поездки; денежные значения дополнительно приводятся к ₽ для сравнения. */
export function tripMetrics(trip: Trip): TripMetrics {
  const costs = computeCosts(trip)
  const stays = trip.stops.filter((stop) => stop.kind === 'stay')

  const starStays = stays.filter((stop) => stop.kind === 'stay' && stop.hotelStars > 0)
  const avgStars = starStays.length
    ? starStays.reduce((sum, stop) => sum + (stop.kind === 'stay' ? stop.hotelStars : 0), 0) /
      starStays.length
    : 0

  const roomNights = stays.reduce(
    (sum, stop) => (stop.kind === 'stay' ? sum + stop.nights * stop.rooms : sum),
    0,
  )
  const avgHotelPerNight = roomNights > 0 ? costs.stays / roomNights : 0

  const foodDaily =
    costs.nights > 0 ? costs.food / costs.nights / Math.max(1, trip.pax) : 0

  const skipassDays = stays.reduce((sum, stop) => (stop.kind === 'stay' ? sum + stop.skipassDays : 0), 0)
  const avgSkipass = skipassDays > 0 ? costs.skipass / skipassDays / Math.max(1, trip.pax) : 0

  const resorts = [
    ...new Set(
      stays
        .map((stop) => {
          if (stop.kind !== 'stay') return ''
          return stop.placeKind === 'city' ? stop.city ?? '' : stop.resort
        })
        .filter((name): name is string => Boolean(name)),
    ),
  ].join(' · ')

  const guides = stayPlaces(trip)
    .map((resortId) => guideFor(resortId))
    .filter((guide): guide is NonNullable<ReturnType<typeof guideFor>> => Boolean(guide))

  const slope = guides.length
    ? mergeSlopePassports(guides.map((guide) => slopePassport(guide)))
    : null

  const budget = trip.budget && trip.budget > 0 ? trip.budget : null

  return {
    id: trip.id,
    name: trip.name,
    currency: trip.currency,
    pax: trip.pax,
    total: costs.total,
    totalRub: convertAmount(costs.total, trip.currency, 'RUB'),
    perPersonRub: convertAmount(costs.perPerson, trip.currency, 'RUB'),
    perRideDayRub: convertAmount(costs.perRideDay, trip.currency, 'RUB'),
    rideDays: costs.rideDays,
    nights: costs.nights,
    stays: costs.stayCount,
    rooms: costs.rooms,
    avgStars,
    avgHotelPerNightRub: convertAmount(avgHotelPerNight, trip.currency, 'RUB'),
    foodPerDayRub: convertAmount(foodDaily, trip.currency, 'RUB'),
    skipassPerDayRub: convertAmount(avgSkipass, trip.currency, 'RUB'),
    travelHours: costs.travelHours,
    budget,
    budgetUsage: budget ? costs.total / budget : null,
    resorts,
    slope,
  }
}

/** id курортов из остановок-курортов (города пропускаем). */
function stayPlaces(trip: Trip): string[] {
  return trip.stops
    .filter((stop) => stop.kind === 'stay' && stop.placeKind === 'resort' && stop.resortId)
    .map((stop) => (stop.kind === 'stay' ? stop.resortId : ''))
    .filter(Boolean)
}

/**
 * Объединяет паспорта нескольких курортов в один: перепад — максимум,
 * километраж и подъёмники — сумма, доли сложности пересчитываются.
 */
export function mergeSlopePassports(passports: SlopePassport[]): SlopePassport | null {
  if (passports.length === 0) return null
  if (passports.length === 1) return passports[0] ?? null

  const vertical = passports.reduce((max, item) => Math.max(max, item.vertical), 0)
  const trailsKm = Math.round(passports.reduce((sum, item) => sum + item.trailsKm, 0) * 10) / 10
  const lifts = passports.reduce((sum, item) => sum + item.lifts, 0)
  const zones = passports.flatMap((item) => item.zones)

  const totals = passports.reduce(
    (acc, item) => {
      // shares — проценты, поэтому переводим их обратно в километры и только потом суммируем
      acc.green += (item.shares.green / 100) * item.trailsKm
      acc.blue += (item.shares.blue / 100) * item.trailsKm
      acc.red += (item.shares.red / 100) * item.trailsKm
      acc.black += (item.shares.black / 100) * item.trailsKm
      return acc
    },
    { green: 0, blue: 0, red: 0, black: 0 },
  )

  const km = (value: number): number => (trailsKm > 0 ? Math.round((value / trailsKm) * 100) : 0)

  const steepest = [...zones].sort((a, b) => b.avgGradientPercent - a.avgGradientPercent)[0] ?? null
  const longest = [...zones].sort((a, b) => b.trailsKm - a.trailsKm)[0] ?? null

  return {
    resortId: passports.map((item) => item.resortId).join('+'),
    vertical,
    trailsKm,
    lifts,
    zones,
    shares: { green: km(totals.green), blue: km(totals.blue), red: km(totals.red), black: km(totals.black) },
    kmPerLift: Math.round((trailsKm / Math.max(1, lifts)) * 10) / 10,
    verticalPerLift: Math.round(vertical / Math.max(1, lifts)),
    steepest,
    longest,
  }
}
