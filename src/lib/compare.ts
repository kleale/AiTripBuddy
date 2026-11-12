import type { Trip } from '@/types'
import { computeCosts } from './costs'
import { convertAmount } from './currency'

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
}

/** Сводные метрики поездки; денежные значения дополнительно приводятся к ₽ для сравнения. */
export function tripMetrics(trip: Trip): TripMetrics {
  const costs = computeCosts(trip)
  const stays = trip.stops.filter((stop) => stop.kind === 'stay')

  const starStays = stays.filter((stop) => stop.kind === 'stay' && stop.hotelStars > 0)
  const avgStars = starStays.length
    ? starStays.reduce((sum, stop) => sum + (stop.kind === 'stay' ? stop.hotelStars : 0), 0) / starStays.length
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
  }
}
