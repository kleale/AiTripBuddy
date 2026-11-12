import { describe, expect, it } from 'vitest'
import { addDays, alignTripDates, buildSchedule, diffDays, scheduleRange, stayCheckOut } from '@/lib/schedule'
import type { StayStop, Trip } from '@/types'

function stay(overrides: Partial<StayStop> = {}): StayStop {
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
    ...overrides,
  }
}

function makeTrip(stops: Trip['stops']): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 1,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops,
    links: stops.slice(1).map(() => ({ kind: 'flight' as const, price: 0, hours: 1 })),
    createdAt: '2026-01-01T00:00:00.000Z',
  }
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
    expect(schedule.segments[0]?.nights).toBe(7)
  })

  it('привязывает расписание к первой дате заезда', () => {
    const schedule = buildSchedule(makeTrip([stay({ checkIn: '2026-02-02' })]))
    expect(schedule.anchored).toBe(true)
    expect(schedule.days[0]?.date).toBe('2026-02-02')
    expect(schedule.days[0]?.weekday).toBe('Пн')
    expect(schedule.days[6]?.date).toBe('2026-02-08')
    expect(scheduleRange(schedule)).toEqual({ from: '2026-02-02', to: '2026-02-09' })
  })

  it('выстраивает второй отель по его дате и оставляет промежуток', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', checkIn: '2026-02-10', nights: 3 })
    const schedule = buildSchedule(makeTrip([first, second]))
    const secondSegment = schedule.segments.find((item) => item.stopId === 's2')
    expect(secondSegment?.start).toBe(8)
    expect(schedule.days.length).toBe(11)
  })

  it('отели подряд без промежутка', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', checkIn: '2026-02-09', nights: 3 })
    const schedule = buildSchedule(makeTrip([first, second]))
    expect(schedule.segments.find((item) => item.stopId === 's2')?.start).toBe(7)
  })

  it('ставит аэропорт на день ближайшего отеля', () => {
    const airport = {
      id: 'a1',
      kind: 'airport' as const,
      cityId: 'innsbruck-inn',
      city: 'Инсбрук',
      code: 'INN',
      lat: 47.26,
      lng: 11.34,
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
    const schedule = buildSchedule(makeTrip([origin, airport, stay({ checkIn: '2026-02-02' })]))
    expect(schedule.segments.find((item) => item.stopId === 'o1')?.start).toBe(0)
    expect(schedule.segments.find((item) => item.stopId === 'a1')?.start).toBe(0)
  })

  it('выравнивает даты отелей подряд', () => {
    const first = stay({ id: 's1', checkIn: '2026-02-02', nights: 7 })
    const second = stay({ id: 's2', nights: 3 })
    const trip = makeTrip([first, second])
    expect(alignTripDates(trip)).toBe(true)
    expect(second.checkIn).toBe('2026-02-09')
    expect(buildSchedule(trip).days.length).toBe(10)
  })
})