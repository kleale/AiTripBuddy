import { describe, expect, it } from 'vitest'
import {
  addDays,
  alignTripDates,
  buildSchedule,
  diffDays,
  fillLinkDates,
  scheduleRange,
  stayCheckOut,
} from '@/lib/schedule'
import type { RouteLink, StayStop, Trip } from '@/types'

function stay(overrides: Partial<StayStop> = {}): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'ischgl',
    resort: 'Ишгль',
    country: 'Австрия',
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

const origin = {
  id: 'o1',
  kind: 'origin' as const,
  cityId: 'moscow-svo',
  city: 'Москва',
  code: 'SVO',
  lat: 55.97,
  lng: 37.41,
}

const airport = {
  id: 'a1',
  kind: 'airport' as const,
  cityId: 'innsbruck-inn',
  city: 'Инсбрук',
  code: 'INN',
  lat: 47.26,
  lng: 11.34,
}

function makeTrip(stops: Trip['stops'], links?: RouteLink[]): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 1,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops,
    links: links ?? stops.slice(1).map(() => ({ kind: 'flight' as const, price: 0, hours: 1 })),
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function findItem(schedule: ReturnType<typeof buildSchedule>, stopId: string) {
  return schedule.items.find((item) => item.stopId === stopId)
}

describe('даты', () => {
  it('складывает и вычитает дни без сдвигов TZ', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(diffDays('2026-03-01', '2026-03-10')).toBe(9)
  })

  it('считает выезд из отеля', () => {
    expect(stayCheckOut(stay({ checkIn: '2026-02-01', nights: 7 }))).toBe('2026-02-08')
    expect(stayCheckOut(stay())).toBeUndefined()
  })
})

describe('buildSchedule', () => {
  it('без дат нумерует дни условно', () => {
    const schedule = buildSchedule(makeTrip([stay()]))
    expect(schedule.anchored).toBe(false)
    expect(schedule.days.length).toBe(7)
    expect(schedule.days[0]?.label).toBe('Д1')
    expect(findItem(schedule, 's1')?.nights).toBe(7)
  })

  it('привязывает расписание к первой дате заезда', () => {
    const schedule = buildSchedule(makeTrip([stay({ checkIn: '2026-02-02' })]))
    expect(schedule.anchored).toBe(true)
    expect(schedule.days[0]?.date).toBe('2026-02-02')
    expect(schedule.days[0]?.weekday).toBe('Пн')
    expect(schedule.days[6]?.date).toBe('2026-02-08')
    expect(scheduleRange(schedule)).toEqual({ from: '2026-02-02', to: '2026-02-08' })
  })

  it('выстраивает второй отель по его дате и оставляет промежуток', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', checkIn: '2026-02-10', nights: 3 })
    const schedule = buildSchedule(makeTrip([first, second]))
    expect(findItem(schedule, 's2')?.start).toBe(8)
    expect(schedule.days.length).toBe(11)
  })

  it('отели подряд без промежутка', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', checkIn: '2026-02-09', nights: 3 })
    const schedule = buildSchedule(makeTrip([first, second]))
    expect(findItem(schedule, 's2')?.start).toBe(7)
  })

  it('ставит аэропорт на день ближайшего отеля', () => {
    const schedule = buildSchedule(makeTrip([origin, airport, stay({ checkIn: '2026-02-02' })]))
    expect(findItem(schedule, 'o1')?.start).toBe(0)
    expect(findItem(schedule, 'a1')?.start).toBe(0)
  })

  it('строит строки для перелёта и трансфера с датой и временем', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2026-02-02' })],
      [
        { kind: 'flight', price: 28000, hours: 4.5, date: '2026-02-02', time: '08:40' },
        { kind: 'transfer', price: 9000, hours: 1.5, date: '2026-02-02', time: '13:20' },
      ],
    )
    const schedule = buildSchedule(trip)
    const flight = schedule.items.find((item) => item.kind === 'flight')
    const transfer = schedule.items.find((item) => item.kind === 'transfer')

    expect(flight?.date).toBe('2026-02-02')
    expect(flight?.time).toBe('08:40')
    expect(flight?.start).toBe(0)
    expect(flight?.meta).toBe('4 ч 30 мин')
    expect(transfer?.time).toBe('13:20')
    expect(schedule.items.length).toBe(5)
  })

  it('событие на другой день растягивает шкалу', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2026-02-02', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 4, date: '2026-02-01', time: '06:00' },
        { kind: 'transfer', price: 0, hours: 1, date: '2026-02-09' },
      ],
    )
    const schedule = buildSchedule(trip)
    const flight = schedule.items.find((item) => item.kind === 'flight')
    const transfer = schedule.items.find((item) => item.kind === 'transfer')
    expect(flight?.start).toBe(0)
    expect(findItem(schedule, 's1')?.start).toBe(1)
    expect(transfer?.start).toBe(8)
    expect(schedule.days.length).toBe(9)
  })

  it('выравнивает даты отелей подряд', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', nights: 3 })
    const trip = makeTrip([first, second])
    expect(alignTripDates(trip)).toBe(true)
    expect(second.checkIn).toBe('2026-02-09')
    expect(buildSchedule(trip).days.length).toBe(10)
  })

  it('подставляет даты событиям из отелей', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2026-02-02', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 4 },
        { kind: 'transfer', price: 0, hours: 1 },
      ],
    )
    expect(fillLinkDates(trip)).toBe(true)
    expect(trip.links[0]?.date).toBe('2026-02-02')
    expect(trip.links[1]?.date).toBe('2026-02-02')
  })
})