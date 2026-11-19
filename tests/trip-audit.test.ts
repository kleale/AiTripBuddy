import { describe, expect, it } from 'vitest'
import type { StayStop, Trip } from '@/types'
import { localTripAudit } from '@/lib/ai/audit'

const origin = {
  id: 'o1',
  kind: 'origin' as const,
  cityId: 'tokyo-nrt',
  city: 'Токио',
  code: 'NRT',
  lat: 35.77,
  lng: 140.39,
}

function stay(): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: 'Hakuba Tokyu Hotel',
    lat: 36.697,
    lng: 137.841,
    nights: 5,
    rooms: 1,
    maxGuests: 2,
    checkIn: '2027-01-02',
    hotelPerNight: 50000,
    hotelSource: null,
    hotelStars: 4,
    skipassDays: 3,
    skipassPerDay: 10000,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
  }
}

function trip(): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: 200000,
    returnFlight: 0,
    returnHours: 0,
    stops: [origin, stay()],
    links: [{ kind: 'transfer', price: 0, hours: 2 }],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('AI-аудит поездки', () => {
  it('находит даты, отель и скипасс с локальным расчётом', () => {
    const audit = localTripAudit(trip())
    expect(audit.provider).toBe('local')
    expect(audit.summary).toContain('Итого')
    const kinds = audit.suggestions.map((item) => item.kind)
    expect(kinds).toContain('dates')
    expect(kinds).toContain('hotel')
    expect(kinds).toContain('skipass')
  })

  it('все суммы положительные и совпадают с apply', () => {
    const audit = localTripAudit(trip())
    expect(audit.suggestions.every((item) => item.savings > 0)).toBe(true)
    const hotel = audit.suggestions.find((item) => item.kind === 'hotel')
    expect(hotel?.apply?.type).toBe('hotel')
    const dates = audit.suggestions.find((item) => item.kind === 'dates')
    expect(dates?.apply?.type).toBe('shift-dates')
  })

  it('без ключа DeepSeek остаётся локальный результат', () => {
    const audit = localTripAudit(trip())
    expect(audit.notes).toEqual([])
  })
})
