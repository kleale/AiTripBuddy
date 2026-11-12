import { describe, expect, it } from 'vitest'
import { buildShareUrl, decodeTrips, encodeTrips } from '@/lib/share'
import type { Trip } from '@/types'

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Ишгль',
    pax: 2,
    currency: 'RUB',
    budget: 320000,
    returnFlight: 30000,
    returnHours: 4.5,
    stops: [
      {
        id: 's1',
        kind: 'stay',
        resortId: 'ischgl',
        resort: 'Ишгль',
        hotel: 'Hotel Elisabeth',
        lat: 47.015,
        lng: 10.288,
        nights: 7,
        checkIn: '2026-02-02',
        rooms: 1,
        hotelPerNight: 16000,
        hotelStars: 4,
        skipassDays: 6,
        skipassPerDay: 4200,
        meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'hotel' },
      },
    ],
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('share', () => {
  it('кодирует и декодирует одну поездку', async () => {
    const code = await encodeTrips([makeTrip()])
    expect(code.length).toBeGreaterThan(10)
    expect(code[0]).toBe('z')

    const decoded = await decodeTrips(code)
    expect(decoded).toHaveLength(1)
    expect(decoded?.[0]?.name).toBe('Ишгль')
    expect(decoded?.[0]?.stops[0]).toMatchObject({ checkIn: '2026-02-02', hotelStars: 4 })
  })

  it('сохраняет набор из нескольких поездок', async () => {
    const trips = [makeTrip({ id: 'a', name: 'A' }), makeTrip({ id: 'b', name: 'B' })]
    const decoded = await decodeTrips(await encodeTrips(trips))
    expect(decoded?.map((item) => item.name)).toEqual(['A', 'B'])
  })

  it('укладывает три поездки в разумную длину ссылки', async () => {
    const code = await encodeTrips([makeTrip({ id: 'a' }), makeTrip({ id: 'b' }), makeTrip({ id: 'c' })])
    expect(code.length).toBeLessThan(2400)
  })

  it('нормализует старые данные при декодировании', async () => {
    const legacy = makeTrip()
    delete (legacy.stops[0] as { meals?: unknown }).meals
    const decoded = await decodeTrips(await encodeTrips([legacy]))
    const stay = decoded?.[0]?.stops[0]
    expect(stay && 'meals' in stay ? stay.meals.breakfast : null).toBe('hotel')
  })

  it('возвращает null на мусор', async () => {
    expect(await decodeTrips('zAAAA')).toBeNull()
    expect(await decodeTrips('')).toBeNull()
    expect(await decodeTrips('jnot-base64!!')).toBeNull()
  })

  it('строит ссылку с хэшем', () => {
    expect(buildShareUrl('https://example.com', '/repo/', 'zABC')).toBe('https://example.com/repo/#trips=zABC')
  })
})