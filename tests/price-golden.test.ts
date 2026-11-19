import { describe, expect, it } from 'vitest'
import type { StayStop } from '@/types'
import { findResort } from '@/data/resorts'
import { hotelPriceHint, skipassPriceHint } from '@/lib/price-hints'
import { priceGoldenSet } from './fixtures/price-golden'

function stub(caseItem: (typeof priceGoldenSet)[number]): StayStop {
  const resort = findResort(caseItem.resortId)
  return {
    id: caseItem.id,
    kind: 'stay',
    placeKind: 'resort',
    resortId: caseItem.resortId,
    resort: resort?.name ?? caseItem.resortId,
    country: caseItem.country,
    hotel: '',
    lat: resort?.lat ?? 0,
    lng: resort?.lng ?? 0,
    nights: 3,
    rooms: 1,
    maxGuests: 2,
    checkIn: caseItem.checkIn,
    hotelPerNight: 0,
    hotelSource: null,
    hotelStars: caseItem.stars,
    skipassDays: 2,
    skipassPerDay: 0,
    meals: { breakfast: 'cafe', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
  }
}

describe('golden-set AI-подсказок цен', () => {
  it('содержит ровно 50 запросов', () => {
    expect(priceGoldenSet).toHaveLength(50)
  })

  it('все 50 запросов дают валидный диапазон и источник', () => {
    for (const caseItem of priceGoldenSet) {
      const hint =
        caseItem.kind === 'hotel'
          ? hotelPriceHint(stub(caseItem), caseItem.currency, { pax: 2, rooms: 1 })
          : skipassPriceHint(stub(caseItem), caseItem.currency)
      expect(hint, caseItem.id).not.toBeNull()
      expect(hint?.low, caseItem.id).toBeLessThanOrEqual(hint?.typical ?? 0)
      expect(hint?.typical, caseItem.id).toBeLessThanOrEqual(hint?.high ?? 0)
      expect(hint?.source.length, caseItem.id).toBeGreaterThan(0)
      expect(hint?.history?.length, caseItem.id).toBe(12)
    }
  })

  it('групповой контекст и провайдер есть у отеля с датами', () => {
    const hotel = priceGoldenSet.find((item) => item.kind === 'hotel')
    if (!hotel) throw new Error('no hotel case')
    const hint = hotelPriceHint(stub(hotel), hotel.currency, { pax: 4, rooms: 2 })
    expect(hint.pax).toBe(4)
    expect(hint.rooms).toBe(2)
    expect(hint.providerUrl).toContain('booking.com')
    expect(hint.providerLabel).toBe('Booking')
  })
})
