import { describe, expect, it } from 'vitest'
import type { RouteLink, StayStop } from '@/types'
import { askPriceHint, hotelPriceHint, linkPriceHint, skipassPriceHint } from '@/lib/price-hints'

function stay(overrides: Partial<StayStop> = {}): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: '',
    lat: 36.7,
    lng: 137.85,
    nights: 7,
    rooms: 1,
    hotelPerNight: 0,
    hotelSource: null,
    hotelStars: 3,
    skipassDays: 5,
    skipassPerDay: 0,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
    checkIn: '2027-01-23',
    ...overrides,
  } as StayStop
}

const link: RouteLink = { kind: 'transfer', transport: 'bus', price: 0, hours: 0 }
const moscow = { lat: 55.75, lng: 37.61 }
const spb = { lat: 59.93, lng: 30.33 }

describe('AI-подсказка отеля', () => {
  it('диапазон и типичная цена в валюте поездки', () => {
    const hint = hotelPriceHint(stay(), 'RUB')
    expect(hint.low).toBeLessThan(hint.typical)
    expect(hint.high).toBeGreaterThan(hint.typical)
    expect(hint.currency).toBe('RUB')
    expect(hint.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('пять звёзд дороже трёх', () => {
    expect(hotelPriceHint(stay({ hotelStars: 5 }), 'RUB').typical).toBeGreaterThan(
      hotelPriceHint(stay({ hotelStars: 3 }), 'RUB').typical,
    )
  })

  it('высокий сезон дороже межсезонья', () => {
    expect(hotelPriceHint(stay({ checkIn: '2027-01-10' }), 'RUB').typical).toBeGreaterThan(
      hotelPriceHint(stay({ checkIn: '2027-11-10' }), 'RUB').typical,
    )
  })

  it('валюта пересчитывается', () => {
    const eur = hotelPriceHint(stay(), 'EUR')
    expect(eur.currency).toBe('EUR')
    expect(eur.typical).toBeLessThan(hotelPriceHint(stay(), 'RUB').typical)
  })
})

describe('AI-подсказка переезда', () => {
  it('считает по расстоянию и виду транспорта', () => {
    const hint = linkPriceHint(link, moscow, spb, 2, 'RUB')
    expect(hint).not.toBeNull()
    expect(hint?.kind).toBe('transfer')
    expect(hint?.typical).toBeGreaterThan(0)
    expect(hint?.source).toContain('км')
  })

  it('автобус на группу дороже для четырёх человек', () => {
    const two = linkPriceHint(link, moscow, spb, 2, 'RUB')?.typical ?? 0
    const four = linkPriceHint(link, moscow, spb, 4, 'RUB')?.typical ?? 0
    expect(four).toBeGreaterThan(two)
  })

  it('такси считается за машину, а не за человека', () => {
    const taxi: RouteLink = { kind: 'transfer', transport: 'taxi', price: 0, hours: 0 }
    expect(linkPriceHint(taxi, moscow, spb, 1, 'RUB')?.typical).toBe(
      linkPriceHint(taxi, moscow, spb, 4, 'RUB')?.typical,
    )
  })

  it('без координат оценки нет', () => {
    expect(linkPriceHint(link, null, spb, 2, 'RUB')).toBeNull()
  })
})

describe('AI-подсказка скипасса', () => {
  it('берёт скипасс из гида', () => {
    const hint = skipassPriceHint(stay(), 'RUB')
    expect(hint?.typical).toBeGreaterThan(0)
    expect(hint?.source).toContain('гид')
  })

  it('в городе скипасс не нужен', () => {
    expect(skipassPriceHint(stay({ placeKind: 'city', resortId: '' }), 'RUB')).toBeNull()
  })
})

describe('провайдер AI', () => {
  it('без внешнего URL возвращает локальную оценку', async () => {
    const local = hotelPriceHint(stay(), 'RUB')
    await expect(askPriceHint(local, {})).resolves.toEqual(local)
  })
})
