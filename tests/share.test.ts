import { describe, expect, it } from 'vitest'
import { buildShareUrl, decodeTrips, encodeTrips, shareCodeFromLocation } from '@/lib/share'
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

  it('отклоняет неизвестный префикс формата', async () => {
    const code = await encodeTrips([makeTrip()])
    expect(await decodeTrips('x' + code.slice(1))).toBeNull()
    expect(await decodeTrips('!' + code.slice(1))).toBeNull()
  })

  it('отклоняет набор из более новой версии формата', async () => {
    const payload = JSON.stringify({ v: 99, trips: [makeTrip()] })
    const bytes = new TextEncoder().encode(payload)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const code = 'j' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await decodeTrips(code)).toBeNull()
  })

  it('строит ссылку с хэшем', () => {
    expect(buildShareUrl('https://example.com', '/repo/', 'zABC')).toBe('https://example.com/repo/#trips=zABC')
  })
})

describe('чтение кода из адреса', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'location')

  function withLocation(value: { hash: string; search: string }, run: () => void): void {
    Object.defineProperty(globalThis, 'location', {
      value,
      configurable: true,
      writable: true,
    })
    try {
      run()
    } finally {
      if (original) Object.defineProperty(globalThis, 'location', original)
      else delete (globalThis as { location?: unknown }).location
    }
  }

  it('читает код из хэша', () => {
    withLocation({ hash: '#trips=zABC', search: '' }, () => {
      expect(shareCodeFromLocation()).toBe('zABC')
    })
  })

  it('читает второй параметр хэша', () => {
    withLocation({ hash: '#route=led-hakuba&trips=jXYZ', search: '' }, () => {
      expect(shareCodeFromLocation()).toBe('jXYZ')
    })
  })

  it('читает код из query, если хэша нет', () => {
    withLocation({ hash: '', search: '?trips=zQUERY' }, () => {
      expect(shareCodeFromLocation()).toBe('zQUERY')
    })
  })

  it('игнорирует мусор в query', () => {
    withLocation({ hash: '', search: '?trips=../../etc' }, () => {
      expect(shareCodeFromLocation()).toBeNull()
    })
  })

  it('возвращает null без параметров', () => {
    withLocation({ hash: '#route=led-hakuba', search: '' }, () => {
      expect(shareCodeFromLocation()).toBeNull()
    })
  })
})