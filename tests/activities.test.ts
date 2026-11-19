import { describe, expect, it } from 'vitest'
import type { StayStop, Trip } from '@/types'
import { computeCosts } from '@/lib/costs'
import { normalizeTrip } from '@/stores/trip'

const origin = {
  id: 'o1', kind: 'origin' as const, cityId: 'moscow-svo', city: 'Москва', code: 'SVO', lat: 55.97, lng: 37.41,
}

function stay(activities: StayStop['activities']): StayStop {
  return {
    id: 's1', kind: 'stay', placeKind: 'resort', resortId: 'hakuba', resort: 'Хакуба', country: 'Япония',
    hotel: '', lat: 36.7, lng: 137.85, nights: 5, rooms: 1, maxGuests: 2, hotelPerNight: 10000,
    hotelSource: null, hotelStars: 3, skipassDays: 0, skipassPerDay: 0,
    meals: { breakfast: 'none', lunch: 'none', dinner: 'none' }, foodPerDayOverride: 0, activities,
  }
}

function trip(activities: StayStop['activities']): Trip {
  return {
    id: 't1', name: 'Тест', pax: 2, currency: 'RUB', budget: null, returnFlight: 0, returnHours: 0,
    stops: [origin, stay(activities)], links: [{ kind: 'transfer', price: 0, hours: 0 }],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('мероприятия в поездке', () => {
  it('нормализует название, цену и дату', () => {
    const value = normalizeTrip(trip([
      { id: 'a1', title: '  Спа  ', price: 2500, date: '2027-01-24', booked: true, url: 'https://example.com/spa' },
      { id: 'a2', title: '', price: 999 },
    ]))
    const entry = value.stops[1]
    const list = entry?.kind === 'stay' ? entry.activities ?? [] : []
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      title: 'Спа',
      price: 2500,
      date: '2027-01-24',
      booked: true,
      url: 'https://example.com/spa',
    })
  })

  it('отбрасывает невалидную ссылку', () => {
    const value = normalizeTrip(trip([{ id: 'a1', title: 'Спа', price: 0, url: 'javascript:alert(1)' }]))
    const entry = value.stops[1]
    const list = entry?.kind === 'stay' ? entry.activities ?? [] : []
    expect(list[0]?.url).toBeUndefined()
  })

  it('цена мероприятия входит в смету на человека', () => {
    const value = normalizeTrip(trip([{ id: 'a1', title: 'Хаски', price: 3000 }]))
    const costs = computeCosts(value)
    expect(costs.activities).toBe(6000)
    expect(costs.total).toBeGreaterThan(costs.activities)
  })
})
