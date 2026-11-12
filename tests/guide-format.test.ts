import { describe, expect, it } from 'vitest'
import { formatGuideDayPrice, formatGuidePrice, guideCurrencySymbols } from '@/lib/guide-format'
import { guideFor } from '@/data/resort-guides'

/** Intl ставит узкие пробелы — сравниваем, приводя любые пробелы к обычному. */
const norm = (value: string): string => value.replace(/\s/g, ' ')

describe('формат цены гида', () => {
  it('подставляет символы всех валют гидов', () => {
    expect(guideCurrencySymbols).toEqual({ JPY: '¥', RUB: '₽', EUR: '€', GEL: '₾' })
  })

  it('форматирует рубли без дробной части', () => {
    expect(norm(formatGuidePrice(4250, 'RUB'))).toBe('4 250 ₽')
  })

  it('сохраняет одну десятую для евро', () => {
    expect(norm(formatGuidePrice(163.5, 'EUR'))).toBe('163,5 €')
    expect(norm(formatGuidePrice(82, 'EUR'))).toBe('82 €')
  })

  it('форматирует лари и иены', () => {
    expect(norm(formatGuidePrice(70, 'GEL'))).toBe('70 ₾')
    expect(norm(formatGuidePrice(9500, 'JPY'))).toBe('9 500 ¥')
  })

  it('возвращает прочерк для нуля и мусора', () => {
    expect(formatGuidePrice(0, 'RUB')).toBe('—')
    expect(formatGuidePrice(-5, 'RUB')).toBe('—')
    expect(formatGuidePrice(Number.NaN, 'EUR')).toBe('—')
  })

  it('добавляет подпись «в день»', () => {
    expect(norm(formatGuideDayPrice(5200, 'RUB'))).toBe('5 200 ₽ / день')
    expect(formatGuideDayPrice(0, 'EUR')).toBe('—')
  })

  it('работает с реальными ценами гидов', () => {
    const mayrhofen = guideFor('mayrhofen')
    const zone = mayrhofen?.zones[0]
    expect(zone && norm(formatGuidePrice(zone.passPrice, zone.passCurrency))).toBe('82 €')
    const sheregesh = guideFor('sheregesh')
    expect(
      sheregesh?.passAll && norm(formatGuidePrice(sheregesh.passAll.price, sheregesh.passAll.currency)),
    ).toBe('4 250 ₽')
  })
})