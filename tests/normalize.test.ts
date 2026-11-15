import { describe, expect, it } from 'vitest'
import { normalizeTrip } from '@/stores/trip'
import type { Trip, StayStop } from '@/types'

function stay(overrides: Record<string, unknown> = {}) {
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
    foodPerDayOverride: null,
    ...overrides,
  } as unknown as StayStop
}

function makeTrip(overrides: Record<string, unknown> = {}): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [
      { id: 'o1', kind: 'origin', cityId: 'moscow-svo', city: 'Москва', code: 'SVO', lat: 55.97, lng: 37.41 },
      stay(),
    ],
    links: [{ kind: 'flight', price: 10000, hours: 5 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Trip
}

describe('normalizeTrip: метаданные', () => {
  it('ограничивает число человек диапазоном 1–20', () => {
    expect(normalizeTrip(makeTrip({ pax: 0 })).pax).toBe(1)
    expect(normalizeTrip(makeTrip({ pax: 99 })).pax).toBe(20)
    expect(normalizeTrip(makeTrip({ pax: 2.7 })).pax).toBe(3)
  })

  it('подставляет валюту RUB для незнакомой', () => {
    expect(normalizeTrip(makeTrip({ currency: 'GBP' })).currency).toBe('RUB')
    expect(normalizeTrip(makeTrip({ currency: 'EUR' })).currency).toBe('EUR')
  })

  it('убирает отрицательный бюджет и часы', () => {
    const trip = normalizeTrip(makeTrip({ budget: -100, returnFlight: -5, returnHours: -1 }))
    expect(trip.budget).toBe(0)
    expect(trip.returnFlight).toBe(0)
    expect(trip.returnHours).toBe(0)
  })

  it('оставляет пустой бюджет пустым', () => {
    expect(normalizeTrip(makeTrip({ budget: null })).budget).toBeNull()
  })

  it('подставляет название и дату создания', () => {
    const trip = normalizeTrip(makeTrip({ name: '', createdAt: '' }))
    expect(trip.name).toBe('Поездка в горы')
    expect(trip.createdAt.length).toBeGreaterThan(10)
  })
})

describe('normalizeTrip: отель', () => {
  it('принимает валидную дату заезда', () => {
    const trip = normalizeTrip(makeTrip({ stops: [makeTrip().stops[0], stay({ checkIn: '2027-02-02' })] }))
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.checkIn : null).toBe('2027-02-02')
  })

  it('отбрасывает несуществующую дату и мусор', () => {
    for (const value of ['2027-02-30', '2027-13-01', '02.02.2027', '2027-2-2', 12345, null]) {
      const trip = normalizeTrip(makeTrip({ stops: [makeTrip().stops[0], stay({ checkIn: value })] }))
      const entry = trip.stops[1]
      expect(entry?.kind === 'stay' ? entry.checkIn : null).toBeUndefined()
    }
  })

  it('ограничивает ночи, комнаты и звёзды', () => {
    const trip = normalizeTrip(
      makeTrip({
        stops: [
          makeTrip().stops[0],
          stay({ nights: 999, rooms: 0, hotelStars: 9, hotelPerNight: -10 }),
        ],
      }),
    )
    const entry = trip.stops[1]
    if (entry?.kind !== 'stay') throw new Error('нет отеля')
    expect(entry.nights).toBe(365)
    expect(entry.rooms).toBe(1)
    expect(entry.hotelStars).toBe(5)
    expect(entry.hotelPerNight).toBe(0)
  })

  it('по умолчанию считает место курортом', () => {
    const trip = normalizeTrip(makeTrip({ stops: [makeTrip().stops[0], stay({ placeKind: undefined })] }))
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.placeKind : null).toBe('resort')
  })

  it('сохраняет город как место ночёвки', () => {
    const trip = normalizeTrip(
      makeTrip({ stops: [makeTrip().stops[0], stay({ placeKind: 'city', city: 'Вена', cityId: 'vienna-vie' })] }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.placeKind : null).toBe('city')
    expect(entry?.kind === 'stay' ? entry.city : null).toBe('Вена')
  })

  it('добавляет питание к старым сохранениям', () => {
    const legacy = stay()
    delete (legacy as { meals?: unknown }).meals
    const trip = normalizeTrip(makeTrip({ stops: [makeTrip().stops[0], legacy] }))
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.meals.breakfast : null).toBe('hotel')
  })
})

describe('normalizeTrip: участки', () => {
  it('подгоняет число участков под число точек', () => {
    const trip = normalizeTrip(makeTrip())
    expect(trip.links).toHaveLength(1)

    const short = normalizeTrip(makeTrip({ links: [] }))
    expect(short.links).toHaveLength(1)
    expect(short.links[0]?.price).toBe(0)

    const long = normalizeTrip(makeTrip({ links: [1, 2, 3, 4].map(() => ({ kind: 'flight', price: 1, hours: 1 })) }))
    expect(long.links).toHaveLength(1)
  })

  it('выводит тип участка из соседних точек', () => {
    const airport = {
      id: 'a1',
      kind: 'airport' as const,
      cityId: 'innsbruck-inn',
      city: 'Инсбрук',
      code: 'INN',
      lat: 47.26,
      lng: 11.34,
    }
    const flight = normalizeTrip(
      makeTrip({
        stops: [makeTrip().stops[0], airport],
        links: [{ kind: 'move', price: 0, hours: 1 }],
      }),
    )
    expect(flight.links[0]?.kind).toBe('flight')

    const transfer = normalizeTrip(
      makeTrip({
        stops: [airport, stay()],
        links: [{ kind: 'flight', price: 0, hours: 1 }],
      }),
    )
    expect(transfer.links[0]?.kind).toBe('transfer')
  })

  it('чистит время участка и сохраняет валидное', () => {
    const trip = normalizeTrip(
      makeTrip({
        links: [
          { kind: 'flight', price: 100, hours: 4, date: '2027-01-22', time: '08:40' },
          { kind: 'transfer', price: 0, hours: 1, time: '8:4' },
        ],
      }),
    )
    expect(trip.links[0]?.time).toBe('08:40')
    expect(trip.links[1]).toBeUndefined()
  })

  it('не падает на пустых массивах', () => {
    const trip = normalizeTrip(makeTrip({ stops: [], links: [] }))
    expect(trip.stops).toEqual([])
    expect(trip.links).toEqual([])
  })
})

describe('нормализация источника цены за номер', () => {
  it('сохраняет известный сайт и дату фиксации', () => {
    const trip = normalizeTrip(
      makeTrip({
        stops: [makeTrip().stops[0], stay({ hotelSource: 'booking', hotelPriceAt: '2026-11-15' })],
      }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.hotelSource : 'x').toBe('booking')
    expect(entry?.kind === 'stay' ? entry.hotelPriceAt : 'x').toBe('2026-11-15')
  })

  it('отбрасывает незнакомый сайт и его дату', () => {
    const trip = normalizeTrip(
      makeTrip({
        stops: [makeTrip().stops[0], stay({ hotelSource: 'airbnb', hotelPriceAt: '2026-11-15' })],
      }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.hotelSource : 'x').toBeNull()
    expect(entry?.kind === 'stay' ? entry.hotelPriceAt : 'x').toBeUndefined()
  })

  it('старое сохранение без источника получает null', () => {
    const legacy = stay()
    delete (legacy as { hotelSource?: unknown }).hotelSource
    const trip = normalizeTrip(makeTrip({ stops: [makeTrip().stops[0], legacy] }))
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.hotelSource : 'x').toBeNull()
  })

  it('дата без источника не сохраняется', () => {
    const trip = normalizeTrip(
      makeTrip({
        stops: [makeTrip().stops[0], stay({ hotelSource: null, hotelPriceAt: '2026-11-15' })],
      }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.hotelPriceAt : 'x').toBeUndefined()
  })

  it('несуществующая дата фиксации отбрасывается', () => {
    const trip = normalizeTrip(
      makeTrip({
        stops: [makeTrip().stops[0], stay({ hotelSource: 'ozon', hotelPriceAt: '2026-02-30' })],
      }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.hotelPriceAt : 'x').toBeUndefined()
  })
})

describe('нормализация ручной цены питания', () => {
  it('сохраняет положительную цену', () => {
    const trip = normalizeTrip(
      makeTrip({ stops: [makeTrip().stops[0], stay({ foodPerDayOverride: 1200 })] }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.foodPerDayOverride : null).toBe(1200)
  })

  it('превращает отсутствующее значение в null (авторасчёт)', () => {
    const trip = normalizeTrip(
      makeTrip({ stops: [makeTrip().stops[0], stay({ foodPerDayOverride: undefined })] }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.foodPerDayOverride : 'x').toBeNull()
  })

  it('отрицательную цену поднимает до нуля', () => {
    const trip = normalizeTrip(
      makeTrip({ stops: [makeTrip().stops[0], stay({ foodPerDayOverride: -300 })] }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.foodPerDayOverride : null).toBe(0)
  })

  it('не превращает null в ноль', () => {
    const trip = normalizeTrip(
      makeTrip({ stops: [makeTrip().stops[0], stay({ foodPerDayOverride: null })] }),
    )
    const entry = trip.stops[1]
    expect(entry?.kind === 'stay' ? entry.foodPerDayOverride : 0).toBeNull()
  })
})

describe('нормализация транспорта', () => {
  it('сохраняет известный транспорт', () => {
    const trip = normalizeTrip(
      makeTrip({ links: [{ kind: 'transfer', transport: 'train', price: 100, hours: 2 }] }),
    )
    expect(trip.links[0]?.transport).toBe('train')
  })

  it('старой ссылке без транспорта подставляет значение по типу', () => {
    const trip = normalizeTrip(makeTrip({ links: [{ kind: 'flight', price: 100, hours: 2 }] }))
    expect(trip.links[0]?.transport).toBe('plane')
  })

  it('неизвестный транспорт заменяет значением по умолчанию', () => {
    const trip = normalizeTrip(
      makeTrip({ links: [{ kind: 'move', transport: 'rocket', price: 0, hours: 0 }] }),
    )
    expect(trip.links[0]?.transport).toBe('car')
  })

  it('достраивает недостающий участок самолётом', () => {
    const trip = normalizeTrip(makeTrip({ links: [] }))
    expect(trip.links[0]?.transport).toBe('plane')
  })
})
