import { describe, expect, it } from 'vitest'
import { addDays, buildSchedule, shiftTripDates } from '@/lib/schedule'
import type { RouteLink, StayStop, Trip } from '@/types'

function stay(overrides: Partial<StayStop> = {}): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: 'Hotel',
    lat: 36.7,
    lng: 137.85,
    nights: 7,
    rooms: 1,
    hotelPerNight: 10000,
    hotelStars: 3,
    skipassDays: 6,
    skipassPerDay: 4000,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
    checkIn: '2027-01-23',
    ...overrides,
  }
}

function makeTrip(stops: Trip['stops'], links: RouteLink[]): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops,
    links,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

const origin = {
  id: 'o1',
  kind: 'origin' as const,
  cityId: 'spb-led',
  city: 'Санкт-Петербург',
  code: 'LED',
  lat: 59.8,
  lng: 30.26,
}

const airport = {
  id: 'a1',
  kind: 'airport' as const,
  cityId: 'tokyo-hnd',
  city: 'Токио',
  code: 'HND',
  lat: 35.55,
  lng: 139.78,
}

describe('сдвиг дат поездки', () => {
  it('сдвигает заезд отеля и даты участков', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2027-01-23' })],
      [
        { kind: 'flight', price: 0, hours: 14, date: '2027-01-22' },
        { kind: 'transfer', price: 0, hours: 5, date: '2027-01-23' },
      ],
    )

    expect(shiftTripDates(trip, 3)).toBe(true)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-01-26')
    expect(trip.links[0]?.date).toBe('2027-01-25')
    expect(trip.links[1]?.date).toBe('2027-01-26')
  })

  it('сдвигает назад через границу месяца', () => {
    const trip = makeTrip([stay({ checkIn: '2027-02-02' })], [{ kind: 'flight', price: 0, hours: 4, date: '2027-02-01' }])
    expect(shiftTripDates(trip, -5)).toBe(true)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-01-28')
    expect(trip.links[0]?.date).toBe('2027-01-27')
  })

  it('сдвигает на неделю вперёд', () => {
    const trip = makeTrip([stay({ checkIn: '2027-03-01', nights: 7 })], [])
    shiftTripDates(trip, 7)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-03-08')
  })

  it('нулевой сдвиг ничего не меняет и возвращает false', () => {
    const trip = makeTrip([stay({ checkIn: '2027-01-23' })], [{ kind: 'flight', price: 0, hours: 4, date: '2027-01-22' }])
    expect(shiftTripDates(trip, 0)).toBe(false)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-01-23')
  })

  it('не трогает отели без даты', () => {
    const trip = makeTrip([stay({ checkIn: undefined })], [])
    expect(shiftTripDates(trip, 2)).toBe(false)
  })

  it('не сдвигает участки без даты', () => {
    const trip = makeTrip([stay({ checkIn: '2027-01-23' })], [{ kind: 'flight', price: 0, hours: 4 }])
    shiftTripDates(trip, 2)
    expect(trip.links[0]?.date).toBeUndefined()
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-01-25')
  })

  it('сохраняет длительность и число ночей', () => {
    const trip = makeTrip([stay({ checkIn: '2027-01-23', nights: 7 })], [])
    const before = buildSchedule(trip).days.length
    shiftTripDates(trip, 10)
    expect(buildSchedule(trip).days.length).toBe(before)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].nights : null).toBe(7)
  })

  it('не меняет смету при сдвиге', async () => {
    const { computeCosts } = await import('@/lib/costs')
    const trip = makeTrip([stay({ checkIn: '2027-01-23' })], [])
    const before = computeCosts(trip).total
    shiftTripDates(trip, 14)
    expect(computeCosts(trip).total).toBe(before)
  })

  it('работает через addDays для больших сдвигов', () => {
    expect(addDays('2027-01-23', 90)).toBe('2027-04-23')
    const trip = makeTrip([stay({ checkIn: '2027-01-23' })], [])
    shiftTripDates(trip, 90)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-04-23')
  })

  it('округляет дробный сдвиг', () => {
    const trip = makeTrip([stay({ checkIn: '2027-01-23' })], [])
    shiftTripDates(trip, 2.6)
    expect(trip.stops[0]?.kind === 'stay' ? trip.stops[0].checkIn : null).toBe('2027-01-26')
  })
})