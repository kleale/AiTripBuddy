import { describe, expect, it } from 'vitest'
import { distanceKm, formatDistance, hotelCoords, hotelOffset } from '@/lib/geo'
import { formatHours, formatMoney } from '@/lib/format'
import { convertAmount, rubRate } from '@/lib/currency'

describe('geo', () => {
  it('считает расстояние по большому кругу', () => {
    const moscow = { lat: 55.9726, lng: 37.4146 }
    const innsbruck = { lat: 47.2602, lng: 11.344 }
    const km = distanceKm(moscow, innsbruck)
    expect(km).toBeGreaterThan(1900)
    expect(km).toBeLessThan(2200)
  })

  it('возвращает 0 для одной и той же точки', () => {
    expect(distanceKm({ lat: 47, lng: 11 }, { lat: 47, lng: 11 })).toBe(0)
  })

  it('детерминированно смещает отель внутри зоны курорта', () => {
    const resort = { lat: 47.015, lng: 10.288 }
    const a = hotelOffset(resort, 'Hotel Elisabeth')
    const b = hotelOffset(resort, 'Hotel Elisabeth')
    expect(a).toEqual(b)
    expect(distanceKm(resort, a)).toBeLessThan(3)
    expect(distanceKm(resort, a)).toBeGreaterThan(0.1)
  })

  it('предпочитает явные координаты отеля', () => {
    const point = hotelCoords({ lat: 47, lng: 11 }, 'Hotel', { lat: 47.1, lng: 11.1 })
    expect(point).toEqual({ lat: 47.1, lng: 11.1 })
  })

  it('не строит координаты без названия отеля', () => {
    expect(hotelCoords({ lat: 47, lng: 11 }, '')).toBeNull()
  })

  it('форматирует расстояние', () => {
    expect(formatDistance(0)).toBe('—')
    expect(formatDistance(0.35)).toBe('350 м')
    expect(formatDistance(1.24)).toBe('1.2 км')
    expect(formatDistance(124.6)).toBe('125 км')
  })
})

describe('formatHours', () => {
  it('переносит минуты в час', () => {
    expect(formatHours(4.999)).toBe('5 ч')
    expect(formatHours(0.999)).toBe('1 ч')
    expect(formatHours(0.5)).toBe('30 мин')
    expect(formatHours(1.999)).toBe('2 ч')
    expect(formatHours(0)).toBe('—')
  })
})

describe('currency', () => {
  it('конвертирует суммы между валютами', () => {
    expect(convertAmount(100, 'RUB', 'RUB')).toBe(100)
    expect(convertAmount(1000, 'USD', 'RUB')).toBeCloseTo(1000 * rubRate.USD, 2)
    expect(convertAmount(1000, 'RUB', 'USD')).toBeCloseTo(1000 / rubRate.USD, 2)
  })

  it('не теряет сумму при конвертации туда и обратно', () => {
    const back = convertAmount(convertAmount(12345, 'RUB', 'EUR'), 'EUR', 'RUB')
    expect(Math.abs(back - 12345)).toBeLessThan(2)
  })

  it('форматирует деньги', () => {
    expect(formatMoney(1500, 'RUB')).toContain('₽')
    expect(formatMoney(Number.NaN, 'EUR')).toBe('0 €')
  })
})