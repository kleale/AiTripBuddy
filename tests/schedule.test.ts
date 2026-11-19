import { describe, expect, it } from 'vitest'
import {
  addDays,
  alignTripDates,
  buildSchedule,
  diffDays,
  fillLinkDates,
  placeName,
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
    expect(schedule.items.find((item) => item.stopId === 's1')?.nights).toBe(7)
  })

  it('без дат события не добавляют лишние дни в шкалу', () => {
    const trip = makeTrip(
      [origin, airport, stay({ nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 4 },
        { kind: 'transfer', price: 0, hours: 1 },
      ],
    )
    const schedule = buildSchedule(trip)
    expect(schedule.anchored).toBe(false)
    expect(schedule.days.length).toBe(7)
    const events = schedule.items.filter((item) => item.linkIndex !== undefined)
    expect(events.every((item) => item.start === 0)).toBe(true)
  })

  it('без дат событие после отеля встаёт на последний день', () => {
    const trip = makeTrip(
      [stay({ id: 's1', nights: 5 }), airport],
      [{ kind: 'flight', price: 0, hours: 4 }],
    )
    const schedule = buildSchedule(trip)
    expect(schedule.days.length).toBe(5)
    const flight = schedule.items.find((item) => item.kind === 'flight')
    expect(flight?.start).toBe(4)
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

  it('ставит мероприятия на их дату и время', () => {
    const trip = makeTrip([
      stay({
        checkIn: '2026-02-02',
        activities: [
          {
            id: 'a1',
            title: 'Снежные обезьяны',
            kind: 'excursion',
            price: 800,
            date: '2026-02-04',
            time: '09:30',
            durationHours: 4,
          },
        ],
      }),
    ])
    const schedule = buildSchedule(trip)
    const activity = schedule.items.find((item) => item.kind === 'activity')
    expect(activity?.date).toBe('2026-02-04')
    expect(activity?.start).toBe(2)
    expect(activity?.time).toBe('09:30')
    expect(activity?.meta).toBe('4 ч')
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

describe('даты событий: ручные не перезаписываются', () => {
  it('fillLinkDates оставляет ручные даты как есть', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2027-02-01', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 5, date: '2027-01-30' },
        { kind: 'transfer', price: 0, hours: 2, date: '2027-01-31' },
      ],
    )
    expect(fillLinkDates(trip)).toBe(false)
    expect(trip.links[0]?.date).toBe('2027-01-30')
    expect(trip.links[1]?.date).toBe('2027-01-31')
  })

  it('fillLinkDates дополняет только пустые даты', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2027-02-01', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 5, date: '2027-01-30' },
        { kind: 'transfer', price: 0, hours: 2 },
      ],
    )
    expect(fillLinkDates(trip)).toBe(true)
    expect(trip.links[0]?.date).toBe('2027-01-30')
    expect(trip.links[1]?.date).toBe('2027-02-01')
  })

  it('событие после последнего отеля получает дату выезда', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2027-02-01', nights: 7 }), airport],
      [
        { kind: 'flight', price: 0, hours: 5 },
        { kind: 'transfer', price: 0, hours: 2 },
        { kind: 'flight', price: 0, hours: 5 },
      ],
    )
    expect(fillLinkDates(trip)).toBe(true)
    expect(trip.links[2]?.date).toBe('2027-02-08')
  })

  it('без отелей и дат событий fillLinkDates ничего не делает', () => {
    const trip = makeTrip([origin, airport], [
      { kind: 'flight', price: 0, hours: 5 },
    ])
    expect(fillLinkDates(trip)).toBe(false)
    expect(trip.links[0]?.date).toBeUndefined()
  })
})

describe('выравнивание дат со сдвигом событий', () => {
  it('первый отель задаёт начало: его дата и даты событий не меняются', () => {
    const trip = makeTrip(
      [origin, airport, stay({ checkIn: '2027-02-10', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 5, date: '2027-02-09' },
        { kind: 'transfer', price: 0, hours: 2, date: '2027-02-10' },
      ],
    )
    expect(alignTripDates(trip)).toBe(false)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-02-10')
    expect(trip.links[0]?.date).toBe('2027-02-09')
    expect(trip.links[1]?.date).toBe('2027-02-10')
  })

  it('не двигает ничего, если даты уже подряд', () => {
    const trip = makeTrip(
      [stay({ id: 's1', checkIn: '2027-02-01', nights: 7 }), stay({ id: 's2', checkIn: '2027-02-08', nights: 3 })],
      [{ kind: 'move', price: 0, hours: 1, date: '2027-02-08' }],
    )
    expect(alignTripDates(trip)).toBe(false)
    expect(trip.links[0]?.date).toBe('2027-02-08')
  })

  it('не сдвигает событие перед первым отелем, если сдвинулся только второй', () => {
    const trip = makeTrip(
      [origin, stay({ id: 's1', checkIn: '2027-02-01', nights: 7 }), stay({ id: 's2', checkIn: '2027-02-12', nights: 3 })],
      [
        { kind: 'transfer', price: 0, hours: 1, date: '2027-02-01' },
        { kind: 'move', price: 0, hours: 1, date: '2027-02-12' },
      ],
    )
    expect(alignTripDates(trip)).toBe(true)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-02-01')
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-02-08')
    expect(trip.links[0]?.date).toBe('2027-02-01')
    expect(trip.links[1]?.date).toBe('2027-02-08')
  })

  it('не трогает дату события, явно сдвинутую на 2+ дня от отеля', () => {
    const trip = makeTrip(
      [origin, stay({ id: 's1', checkIn: '2027-02-01', nights: 7 }), stay({ id: 's2', checkIn: '2027-02-12', nights: 3 })],
      [
        { kind: 'transfer', price: 0, hours: 1, date: '2027-02-01' },
        { kind: 'move', price: 0, hours: 1, date: '2027-02-10' },
      ],
    )
    expect(alignTripDates(trip)).toBe(true)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-02-08')
    expect(trip.links[1]?.date).toBe('2027-02-10')
  })

  it('переносит событие за день до заезда вместе с отелем', () => {
    const trip = makeTrip(
      [origin, airport, stay({ id: 's1', checkIn: '2027-02-02', nights: 7 })],
      [
        { kind: 'flight', price: 0, hours: 5, date: '2027-02-01' },
        { kind: 'transfer', price: 0, hours: 2, date: '2027-02-02' },
      ],
    )
    const second = stay({ id: 's2', checkIn: '2027-02-12', nights: 3 })
    trip.stops.push(second)
    trip.links.push({ kind: 'move', price: 0, hours: 1 })
    expect(alignTripDates(trip)).toBe(true)
    expect(trip.stops[2]?.kind === 'stay' ? trip.stops[2].checkIn : null).toBe('2027-02-02')
    expect(trip.links[0]?.date).toBe('2027-02-01')
  })

  it('сдвигает второй отель и его событие на разрыв', () => {
    const trip = makeTrip(
      [stay({ id: 's1', checkIn: '2027-02-01', nights: 7 }), stay({ id: 's2', checkIn: '2027-02-12', nights: 3 })],
      [{ kind: 'move', price: 0, hours: 1, date: '2027-02-12' }],
    )
    expect(alignTripDates(trip)).toBe(true)
    expect(trip.stops[1]?.kind === 'stay' ? trip.stops[1].checkIn : null).toBe('2027-02-08')
    expect(trip.links[0]?.date).toBe('2027-02-08')
  })
})

describe('вспомогательные функции расписания', () => {
  it('называет место курортом или городом', () => {
    expect(placeName(stay({ resort: 'Ишгль', placeKind: 'resort' }))).toBe('Ишгль')
    expect(placeName(stay({ resort: '', city: 'Вена', placeKind: 'city' }))).toBe('Вена')
    expect(placeName(stay({ resort: '', city: '', placeKind: 'resort' }))).toBe('Курорт')
    expect(placeName(stay({ resort: '', city: '', placeKind: 'city' }))).toBe('Город')
  })

  it('диапазон расписания берёт первый и последний день', () => {
    const schedule = buildSchedule(makeTrip([stay({ checkIn: '2027-02-02', nights: 3 })]))
    expect(scheduleRange(schedule)).toEqual({ from: '2027-02-02', to: '2027-02-04' })
  })

  it('без дат диапазона нет', () => {
    expect(scheduleRange(buildSchedule(makeTrip([stay()])))).toBeNull()
  })

  it('нормализует нулевые ночи до одного дня на шкале', () => {
    const schedule = buildSchedule(makeTrip([stay({ nights: 0 })]))
    const item = schedule.items.find((entry) => entry.stopId === 's1')
    expect(item?.length).toBe(1)
    expect(item?.nights).toBe(0)
  })
})