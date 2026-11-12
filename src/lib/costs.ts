import type { Trip } from '@/types'
import { foodPerDay } from '@/data/meals'

export interface TripCosts {
  flights: number
  transfers: number
  stays: number
  skipass: number
  food: number
  returnFlight: number
  total: number
  perPerson: number
  perRideDay: number
  rideDays: number
  nights: number
  rooms: number
  travelHours: number
  stayCount: number
  flightCount: number
  transferCount: number
}

function safe(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function computeCosts(trip: Trip): TripCosts {
  let flights = 0
  let transfers = 0
  let stayTotal = 0
  let skipass = 0
  let food = 0
  let nights = 0
  let rooms = 0
  let rideDays = 0
  let travelHours = 0
  let stayCount = 0
  let flightCount = 0
  let transferCount = 0

  const pax = Math.max(1, Math.round(safe(trip.pax)))

  for (const link of trip.links) {
    const price = Math.max(0, safe(link.price))
    travelHours += Math.max(0, safe(link.hours))
    if (link.kind === 'flight') {
      flights += price
      flightCount += 1
    } else {
      transfers += price
      transferCount += 1
    }
  }

  for (const stop of trip.stops) {
    if (stop.kind !== 'stay') continue
    stayCount += 1
    const stayNights = Math.max(0, safe(stop.nights))
    const stayRooms = Math.max(1, Math.round(safe(stop.rooms) || 1))
    const days = Math.max(0, safe(stop.skipassDays))
    nights += stayNights
    rooms += stayRooms
    rideDays += days
    stayTotal += stayNights * stayRooms * safe(stop.hotelPerNight)
    skipass += days * safe(stop.skipassPerDay) * pax
    food += stayNights * foodPerDay(stop.resortId, stop.meals, trip.currency) * pax
  }

  const returnFlight = Math.max(0, safe(trip.returnFlight))
  const returnHours = Math.max(0, safe(trip.returnHours))
  travelHours += returnHours
  const total = flights + transfers + stayTotal + skipass + food + returnFlight

  return {
    flights,
    transfers,
    stays: stayTotal,
    skipass,
    food,
    returnFlight,
    total,
    perPerson: total / pax,
    perRideDay: rideDays > 0 ? total / rideDays : 0,
    rideDays,
    nights,
    rooms,
    travelHours,
    stayCount,
    flightCount,
    transferCount,
  }
}