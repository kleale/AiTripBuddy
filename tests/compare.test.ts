import { describe, expect, it } from 'vitest'
import { tripMetrics } from '@/lib/compare'
import type { StayStop, Trip } from '@/types'

function stay(overrides: Partial<StayStop> = {}): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    resortId: 'ischgl',
    resort: 'Ишгль',
    hotel: 'Hotel Elisabeth',
    lat: 47.015,
    lng: 10.288,
    nights: 7,
    rooms: 1,
    hotelPerNight: 8000,
    hotelStars: 4,
    skipassDays: 6,
    skipassPerDay: 4000,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    ...overrides,
  }
}

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [
      {
        id: 'o1',
        kind: 'origin',
        cityId: 'moscow-svo',
        city: 'Москва',
        code: 'SVO',
        lat: 55.97,
        lng: 37.41,
      },
      stay(),
    ],
    links: [{ kind: 'flight', price: 30000, hours: 4 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('tripMetrics', () => {
  it('считает итог, дни катания и цену дня катания', () => {
    const metrics = tripMetrics(makeTrip())
    expect(metrics.rideDays).toBe(6)
    expect(metrics.nights).toBe(7)
    expect(metrics.total).toBeGreaterThan(30000)
    expect(metrics.perRideDayRub).toBeGreaterThan(0)
  })

  it('считает уровень отеля и среднюю цену номера', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', nights: 7, hotelStars: 5, hotelPerNight: 10000 }),
          stay({ id: 's2', nights: 3, hotelStars: 3, hotelPerNight: 6000 }),
        ],
      }),
    )
    expect(metrics.avgStars).toBe(4)
    expect(metrics.avgHotelPerNightRub).toBeCloseTo((7 * 10000 + 3 * 6000) / 10, 0)
    expect(metrics.stays).toBe(2)
  })

  it('игнорирует отели без указанного уровня', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', hotelStars: 5 }),
          stay({ id: 's2', hotelStars: 0 }),
        ],
      }),
    )
    expect(metrics.avgStars).toBe(5)
  })

  it('приводит сумму к рублям для сравнения валют', () => {
    const eur = tripMetrics(makeTrip({ currency: 'EUR' }))
    expect(eur.totalRub).toBeGreaterThan(0)
    expect(eur.totalRub).toBeGreaterThan(eur.total)
    expect(eur.perPersonRub).toBeGreaterThan(eur.perPersonRub / 2)
  })

  it('считает использование бюджета', () => {
    const metrics = tripMetrics(makeTrip({ budget: 100000 }))
    expect(metrics.budgetUsage).toBeGreaterThan(0)
    expect(metrics.budgetUsage).toBeLessThan(10)
  })

  it('без бюджета доля не считается', () => {
    expect(tripMetrics(makeTrip()).budgetUsage).toBeNull()
  })

  it('собирает список курортов без дублей', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [stay({ id: 's1', resort: 'Ишгль' }), stay({ id: 's2', resort: 'Ишгль' })],
      }),
    )
    expect(metrics.resorts).toBe('Ишгль')
  })
})