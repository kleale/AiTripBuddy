import { describe, expect, it } from 'vitest'
import { mergeSlopePassports, tripMetrics } from '@/lib/compare'
import { slopePassport } from '@/lib/slope'
import { guideFor } from '@/data/resort-guides'
import type { StayStop, Trip } from '@/types'

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

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [
      {
        id: 'o1',
        kind: 'origin',
        cityId: 'moscow-svo',
        city: 'Москва',
        code: 'SVO',
        lat: 55.97,
        lng: 37.41,
      },
      stay(),
    ],
    links: [{ kind: 'flight', price: 30000, hours: 4 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('tripMetrics', () => {
  it('считает итог, дни катания и цену дня катания', () => {
    const metrics = tripMetrics(makeTrip())
    expect(metrics.rideDays).toBe(6)
    expect(metrics.nights).toBe(7)
    expect(metrics.total).toBeGreaterThan(30000)
    expect(metrics.perRideDayRub).toBeGreaterThan(0)
  })

  it('считает уровень отеля и среднюю цену номера', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', nights: 7, hotelStars: 5, hotelPerNight: 10000 }),
          stay({ id: 's2', nights: 3, hotelStars: 3, hotelPerNight: 6000 }),
        ],
      }),
    )
    expect(metrics.avgStars).toBe(4)
    expect(metrics.avgHotelPerNightRub).toBeCloseTo((7 * 10000 + 3 * 6000) / 10, 0)
    expect(metrics.stays).toBe(2)
  })

  it('игнорирует отели без указанного уровня', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', hotelStars: 5 }),
          stay({ id: 's2', hotelStars: 0 }),
        ],
      }),
    )
    expect(metrics.avgStars).toBe(5)
  })

  it('приводит сумму к рублям для сравнения валют', () => {
    const eur = tripMetrics(makeTrip({ currency: 'EUR' }))
    expect(eur.totalRub).toBeGreaterThan(0)
    expect(eur.totalRub).toBeGreaterThan(eur.total)
    expect(eur.perPersonRub).toBeGreaterThan(eur.perPersonRub / 2)
  })

  it('считает использование бюджета', () => {
    const metrics = tripMetrics(makeTrip({ budget: 100000 }))
    expect(metrics.budgetUsage).toBeGreaterThan(0)
    expect(metrics.budgetUsage).toBeLessThan(10)
  })

  it('без бюджета доля не считается', () => {
    expect(tripMetrics(makeTrip()).budgetUsage).toBeNull()
  })

  it('собирает список курортов без дублей', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [stay({ id: 's1', resort: 'Ишгль' }), stay({ id: 's2', resort: 'Ишгль' })],
      }),
    )
    expect(metrics.resorts).toBe('Ишгль')
  })

  it('учитывает города в списке мест', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', placeKind: 'resort', resort: 'Ишгль' }),
          stay({ id: 's2', placeKind: 'city', resort: '', city: 'Вена', cityId: 'vienna-vie' }),
        ],
      }),
    )
    expect(metrics.resorts).toBe('Ишгль · Вена')
  })
})

describe('tripMetrics: граничные случаи', () => {
  it('считает часы в дороге вместе с обратным перелётом', () => {
    const metrics = tripMetrics(makeTrip({ returnHours: 6 }))
    expect(metrics.travelHours).toBe(10)
  })

  it('показывает перерасход бюджета больше 100%', () => {
    const metrics = tripMetrics(makeTrip({ budget: 1000 }))
    expect(metrics.budgetUsage).toBeGreaterThan(1)
  })

  it('не падает, если у отеля нет названия места', () => {
    const metrics = tripMetrics(makeTrip({ stops: [stay({ placeKind: 'city', resort: '', city: '' })] }))
    expect(metrics.resorts).toBe('')
  })

  it('цена дня катания нулевая без дней катания', () => {
    const metrics = tripMetrics(makeTrip({ stops: [stay({ skipassDays: 0 })] }))
    expect(metrics.perRideDayRub).toBe(0)
    expect(metrics.skipassPerDayRub).toBe(0)
  })
})

describe('паспорт склона в метриках поездки', () => {
  it('появляется, если у курорта есть гид', () => {
    const metrics = tripMetrics(makeTrip({ stops: [stay({ resortId: 'mayrhofen' })] }))
    expect(metrics.slope).not.toBeNull()
    expect(metrics.slope?.vertical).toBeGreaterThan(0)
  })

  it('отсутствует для курорта без гида', () => {
    const withGuide = tripMetrics(makeTrip({ stops: [stay({ resortId: 'sheregesh' })] }))
    expect(withGuide.slope).not.toBeNull()
    const noGuide = tripMetrics(makeTrip({ stops: [stay({ resortId: 'beshtau' })] }))
    expect(noGuide.slope).toBeNull()
  })

  it('пропускает города и учитывает только курорты', () => {
    const metrics = tripMetrics(
      makeTrip({
        stops: [
          stay({ id: 's1', resortId: 'mayrhofen' }),
          stay({ id: 's2', placeKind: 'city', resortId: '', city: 'Вена', cityId: 'vienna-vie' }),
        ],
      }),
    )
    expect(metrics.slope?.zones.length).toBeGreaterThan(0)
  })

  it('объединяет два курорта: перепад максимум, километраж сумма', () => {
    const mayr = guideFor('mayrhofen')
    const rosa = guideFor('rosa-khutor')
    if (!mayr || !rosa) throw new Error('нет гидов')

    const merged = mergeSlopePassports([slopePassport(mayr), slopePassport(rosa)])
    expect(merged).not.toBeNull()
    const a = slopePassport(mayr)
    const b = slopePassport(rosa)
    expect(merged?.vertical).toBe(Math.max(a.vertical, b.vertical))
    expect(merged?.trailsKm).toBeCloseTo(a.trailsKm + b.trailsKm, 1)
    expect(merged?.lifts).toBe(a.lifts + b.lifts)
    expect(merged?.zones.length).toBe(a.zones.length + b.zones.length)
  })

  it('доли сложности объединённого паспорта в сумме дают около 100%', () => {
    const passports = ['mayrhofen', 'hakuba']
      .map((id) => guideFor(id))
      .filter((guide) => Boolean(guide))
      .map((guide) => slopePassport(guide as NonNullable<typeof guide>))
    const merged = mergeSlopePassports(passports)
    if (!merged) throw new Error('паспорт не собрался')
    const total = Object.values(merged.shares).reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThan(95)
    expect(total).toBeLessThan(105)
  })

  it('пустой список даёт null', () => {
    expect(mergeSlopePassports([])).toBeNull()
  })
})
