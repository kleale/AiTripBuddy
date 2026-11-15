import { beforeEach, describe, expect, it } from 'vitest'
import { connectStops, insertStayAfter, removeStop, trip } from '@/stores/trip'
import type { AirportStop, OriginStop, RouteLink, StayStop, Trip } from '@/types'

function stay(id: string, overrides: Partial<StayStop> = {}): StayStop {
  return {
    id,
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: 'Hotel ' + id,
    lat: 36.7,
    lng: 137.85,
    nights: 3,
    rooms: 1,
    hotelPerNight: 10000,
    hotelSource: null,
    hotelStars: 3,
    skipassDays: 0,
    skipassPerDay: 0,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
    ...overrides,
  }
}

const origin: OriginStop = {
  id: 'o1',
  kind: 'origin',
  cityId: 'spb-led',
  city: 'Санкт-Петербург',
  code: 'LED',
  lat: 59.8,
  lng: 30.26,
}

const airport: AirportStop = {
  id: 'a1',
  kind: 'airport',
  cityId: 'tokyo-hnd',
  city: 'Токио',
  code: 'HND',
  lat: 35.55,
  lng: 139.78,
}

function makeTrip(): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [
      origin,
      stay('s1', { checkIn: '2027-01-23' }),
      stay('s2', { checkIn: '2027-01-26', nights: 2 }),
      airport,
    ],
    links: [
      { kind: 'transfer', transport: 'bus', price: 500, hours: 1, date: '2027-01-23' },
      { kind: 'move', transport: 'car', price: 1000, hours: 2, date: '2027-01-26' },
      { kind: 'flight', transport: 'plane', price: 5000, hours: 3, date: '2027-01-28' },
    ],
    createdAt: '2027-01-01T00:00:00.000Z',
  }
}

beforeEach(() => {
  trip.value = makeTrip()
})

describe('удаление точки', () => {
  it('оставляет последующие точки и связи между ними', () => {
    removeStop('s1')
    const current = trip.value as Trip
    expect(current.stops.map((stop) => stop.id)).toEqual(['o1', 's2', 'a1'])
    expect(current.links).toHaveLength(2)
  })

  it('сохраняет дату выезда к следующей точке', () => {
    removeStop('s1')
    expect(trip.value?.links[0]?.date).toBe('2027-01-26')
    expect(trip.value?.links[0]?.price).toBe(1500)
    expect(trip.value?.links[0]?.hours).toBe(3)
  })

  it('не трогает последнюю точку при удалении предпоследней', () => {
    removeStop('s2')
    const ids = trip.value?.stops.map((stop) => stop.id)
    expect(ids).toContain('a1')
    expect(ids).toEqual(['o1', 's1', 'a1'])
  })
})

describe('вставка точки между узлами', () => {
  it('вставляет город после выбранного участка', () => {
    const id = insertStayAfter(1, 'city')
    const current = trip.value as Trip
    expect(id).toBeTruthy()
    expect(current.stops.map((stop) => stop.id)).toEqual(['o1', 's1', id, 's2', 'a1'])
    const inserted = current.stops[2]
    expect(inserted?.kind === 'stay' ? inserted.placeKind : '').toBe('city')
  })

  it('начинает заезд с выезда предыдущего отеля', () => {
    insertStayAfter(1)
    const inserted = trip.value?.stops[2]
    expect(inserted?.kind === 'stay' ? inserted.checkIn : '').toBe('2027-01-26')
  })

  it('сохраняет старый участок и добавляет новый', () => {
    const before = trip.value?.links[1] as RouteLink
    insertStayAfter(1)
    const links = trip.value?.links as RouteLink[]
    expect(links).toHaveLength(4)
    expect(links[1]?.transport).toBe('bus')
    expect(links[1]?.price).toBe(0)
    expect(links[1]?.date).toBe('2027-01-26')
    expect(links[2]?.date).toBe(before.date)
    expect(links[2]?.price).toBe(before.price)
  })

  it('не вставляет после последней точки', () => {
    expect(insertStayAfter(3)).toBeNull()
    expect(trip.value?.stops).toHaveLength(4)
  })
})

describe('соединение мышью', () => {
  it('разрешает соседние точки и возвращает индекс участка', () => {
    expect(connectStops('s1', 's2')).toBe(1)
    expect(connectStops('o1', 's1')).toBe(0)
  })

  it('отклоняет несоседние точки', () => {
    expect(connectStops('o1', 's2')).toBeNull()
    expect(connectStops('s2', 's1')).toBeNull()
  })

  it('отклоняет неизвестные точки', () => {
    expect(connectStops('nope', 's2')).toBeNull()
  })
})
