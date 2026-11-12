import { describe, expect, it } from 'vitest'
import { computeCosts } from '@/lib/costs'
import type { Trip } from '@/types'

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 1,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [],
    links: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const origin = {
  id: 'o1',
  kind: 'origin' as const,
  cityId: 'moscow-svo',
  city: 'Москва',
  code: 'SVO',
  lat: 55.97,
  lng: 37.41,
}

const airport = {
  id: 'a1',
  kind: 'airport' as const,
  cityId: 'innsbruck-inn',
  city: 'Инсбрук',
  code: 'INN',
  lat: 47.26,
  lng: 11.34,
}

const stay = {
  id: 's1',
  kind: 'stay' as const,
  resortId: 'ischgl',
  resort: 'Ишгль',
  hotel: 'Hotel Elisabeth',
  lat: 47.015,
  lng: 10.288,
  nights: 7,
  rooms: 2,
  hotelPerNight: 8000,
  skipassDays: 6,
  skipassPerDay: 4000,
  meals: { breakfast: 'none' as const, lunch: 'none' as const, dinner: 'none' as const },
}

describe('computeCosts', () => {
  it('считает проживание за номер, а скипасс и питание на человека', () => {
    const trip = makeTrip({
      pax: 2,
      stops: [origin, airport, stay],
      links: [
        { kind: 'flight', price: 30000, hours: 4 },
        { kind: 'transfer', price: 5000, hours: 1 },
      ],
      returnFlight: 32000,
      returnHours: 4.5,
    })

    const costs = computeCosts(trip)

    expect(costs.flights).toBe(30000)
    expect(costs.transfers).toBe(5000)
    expect(costs.stays).toBe(7 * 2 * 8000)
    expect(costs.skipass).toBe(6 * 4000 * 2)
    expect(costs.food).toBe(0)
    expect(costs.total).toBe(30000 + 5000 + 112000 + 48000 + 32000)
    expect(costs.perPerson).toBe(costs.total / 2)
  })

  it('учитывает часы обратного перелёта во времени в дороге', () => {
    const trip = makeTrip({
      stops: [origin, airport],
      links: [{ kind: 'flight', price: 10000, hours: 4 }],
      returnHours: 4.5,
    })
    expect(computeCosts(trip).travelHours).toBe(8.5)
  })

  it('не делит на ноль без дней катания', () => {
    const trip = makeTrip({ stops: [origin, airport], links: [{ kind: 'flight', price: 1, hours: 1 }] })
    expect(computeCosts(trip).perRideDay).toBe(0)
  })

  it('считает питание по пресетам и валюте', () => {
    const trip = makeTrip({
      pax: 2,
      stops: [{ ...stay, meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'slope' } }],
    })
    const costs = computeCosts(trip)
    expect(costs.food).toBeGreaterThan(0)
    expect(costs.food % 2).toBe(0)
  })

  it('устойчив к отрицательным и пустым значениям', () => {
    const trip = makeTrip({
      pax: 1,
      stops: [stay],
      links: [{ kind: 'flight', price: -100, hours: -2 }],
      returnFlight: -5,
      returnHours: -1,
    })
    const costs = computeCosts(trip)
    expect(costs.flights).toBe(0)
    expect(costs.travelHours).toBe(0)
    expect(costs.returnFlight).toBe(0)
  })
})