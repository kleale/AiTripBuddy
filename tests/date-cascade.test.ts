import { describe, expect, it } from 'vitest'
import {
  cascadeAfterLink,
  cascadeAfterStop,
  fillStayDates,
  buildSchedule,
} from '@/lib/schedule'
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
    ...overrides,
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

function threeStays() {
  const a = stay({ id: 's1', checkIn: '2027-01-23', nights: 7 })
  const b = stay({ id: 's2', checkIn: '2027-01-30', nights: 3 })
  const c = stay({ id: 's3', checkIn: '2027-02-02', nights: 2 })
  return makeTrip(
    [origin, airport, a, b, c],
    [
      { kind: 'flight', price: 0, hours: 14, date: '2027-01-22' },
      { kind: 'transfer', price: 0, hours: 5, date: '2027-01-23' },
      { kind: 'move', price: 0, hours: 2, date: '2027-01-30' },
      { kind: 'move', price: 0, hours: 2, date: '2027-02-02' },
    ],
  )
}

describe('каскад дат после точки', () => {
  it('сдвигает все последующие отели и участки', () => {
    const trip = threeStays()
    expect(cascadeAfterStop(trip, 's1', 3)).toBe(true)

    // stops: [origin, airport, s1, s2, s3]
    expect(trip.stops[3]?.kind === 'stay' ? trip.stops[3].checkIn : null).toBe('2027-02-02')
    expect(trip.stops[4]?.kind === 'stay' ? trip.stops[4].checkIn : null).toBe('2027-02-05')
    // входящий трансфер — предыдущая точка, он остаётся на месте
    expect(trip.links[1]?.date).toBe('2027-01-23')
    expect(trip.links[2]?.date).toBe('2027-02-02')
    expect(trip.links[3]?.date).toBe('2027-02-05')
  })

  it('сохраняет промежуток между отелями', () => {
    const a = stay({ id: 's1', checkIn: '2027-01-23', nights: 7 })
    const b = stay({ id: 's2', checkIn: '2027-02-02', nights: 2 })
    const trip = makeTrip([a, b], [{ kind: 'move', price: 0, hours: 1, date: '2027-02-02' }])

    // между отелями было 3 дня паузы: 30.01 выезд, 02.02 заезд
    cascadeAfterStop(trip, 's1', 2)

    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-02-04')
    const gap = 29 * 0 + 0
    void gap
  })

  it('сдвиг назад через месяц', () => {
    const a = stay({ id: 's1', checkIn: '2027-02-05', nights: 3 })
    const b = stay({ id: 's2', checkIn: '2027-02-08', nights: 2 })
    const trip = makeTrip([a, b], [])
    cascadeAfterStop(trip, 's1', -5)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-02-03')
  })

  it('нулевой сдвиг ничего не меняет', () => {
    const trip = threeStays()
    expect(cascadeAfterStop(trip, 's1', 0)).toBe(false)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-01-23')
  })

  it('неизвестная точка возвращает false', () => {
    expect(cascadeAfterStop(threeStays(), 'nope', 3)).toBe(false)
  })

  it('не трогает отели без даты', () => {
    const a = stay({ id: 's1', checkIn: '2027-01-23' })
    const b = stay({ id: 's2', checkIn: undefined })
    const trip = makeTrip([a, b], [])
    cascadeAfterStop(trip, 's1', 3)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : 'none').toBeUndefined()
  })
})

describe('каскад после участка', () => {
  it('сдвигает отель прилёта и всё дальше', () => {
    const trip = threeStays()
    // рейс 22.01 сдвигаем на 4 дня
    expect(cascadeAfterLink(trip, 0, 4)).toBe(true)

    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-01-27')
    expect(trip.stops[3]?.kind === 'stay' ? trip.stops[3].checkIn : null).toBe('2027-02-03')
    expect(trip.links[1]?.date).toBe('2027-01-27')
    expect(trip.links[0]?.date).toBe('2027-01-22')
  })

  it('не меняет сам изменённый участок', () => {
    const trip = threeStays()
    cascadeAfterLink(trip, 1, 2)
    expect(trip.links[1]?.date).toBe('2027-01-23')
  })

  it('неверный индекс — false', () => {
    expect(cascadeAfterLink(threeStays(), 99, 3)).toBe(false)
  })
})

describe('заполнение дат заезда', () => {
  it('подставляет выезд предыдущего отеля', () => {
    const a = stay({ id: 's1', checkIn: '2027-01-23', nights: 7 })
    const b = stay({ id: 's2', checkIn: undefined, nights: 2 })
    const trip = makeTrip([a, b], [])

    expect(fillStayDates(trip)).toBe(true)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-01-30')
  })

  it('заполняет цепочку из трёх отелей', () => {
    const trip = makeTrip(
      [
        stay({ id: 's1', checkIn: '2027-01-23', nights: 7 }),
        stay({ id: 's2', checkIn: undefined, nights: 3 }),
        stay({ id: 's3', checkIn: undefined, nights: 2 }),
      ],
      [],
    )
    fillStayDates(trip)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-01-30')
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-02-02')
  })

  it('не перезаписывает существующие даты', () => {
    const trip = makeTrip(
      [
        stay({ id: 's1', checkIn: '2027-01-23', nights: 7 }),
        stay({ id: 's2', checkIn: '2027-02-05', nights: 2 }),
      ],
      [],
    )
    expect(fillStayDates(trip)).toBe(false)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-02-05')
  })

  it('без дат ничего не делает', () => {
    const trip = makeTrip([stay({ checkIn: undefined })], [])
    expect(fillStayDates(trip)).toBe(false)
  })
})

describe('каскад и расписание', () => {
  it('каскад сохраняет число ночей и промежутки', () => {
    const trip = threeStays()
    const before = buildSchedule(trip)
    const nightsBefore = before.days.length

    cascadeAfterStop(trip, 's1', 3)
    const after = buildSchedule(trip)

    // первый отель сдвинулся, поэтому шкала начинается позже и растягивается
    expect(after.days.length).toBe(nightsBefore + 3)
    expect(after.items.filter((s) => s.kind === 'stay').map((s) => s.length)).toEqual([7, 3, 2])
  })

  it('каскад не меняет смету', async () => {
    const { computeCosts } = await import('@/lib/costs')
    const trip = threeStays()
    const before = computeCosts(trip).total
    cascadeAfterStop(trip, 's1', 5)
    expect(computeCosts(trip).total).toBe(before)
  })
})

describe('смена ночей не двигает заезд', () => {
  it('входящий трансфер остаётся, выезд и всё дальше едет', () => {
    const trip = threeStays()
    const incomingBefore = trip.links[1]?.date

    cascadeAfterStop(trip, 's1', 2)

    expect(trip.links[1]?.date).toBe(incomingBefore)
    // s2 был 30.01, после +2 дней стал 01.02
    expect(trip.stops[3]?.kind === 'stay' ? trip.stops[3].checkIn : null).toBe('2027-02-01')
    expect(trip.links[2]?.date).toBe('2027-02-01')
  })

  it('сам отель не сдвигается по дате заезда', () => {
    const trip = threeStays()
    const checkIn = trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null
    cascadeAfterStop(trip, 's1', 2)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe(checkIn)
  })
})
