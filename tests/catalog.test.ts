import { describe, expect, it } from 'vitest'
import { resorts, type Resort } from '@/data/resorts'
import { catalogCountries, emptyFilters, filterResorts } from '@/lib/catalog'
import { resortSeason, seasonFilterMonths } from '@/data/resort-season'
import { hasGuide } from '@/data/resort-guides'

describe('сезоны курортов', () => {
  it('все сезоны состоят из валидных месяцев', () => {
    const valid = new Set(seasonFilterMonths.map((month) => month.value))
    for (const resort of resorts) {
      const season = resortSeason(resort)
      expect(season.months.length).toBeGreaterThan(0)
      expect(season.months.every((month) => valid.has(month))).toBe(true)
      expect(season.label.length).toBeGreaterThan(3)
    }
  })

  it('Хоккайдо открывается с ноября, остальная Япония — с декабря', () => {
    const niseko = resorts.find((resort) => resort.id === 'niseko')
    const hakuba = resorts.find((resort) => resort.id === 'hakuba')
    expect(niseko && resortSeason(niseko).months.includes(11)).toBe(true)
    expect(hakuba && resortSeason(hakuba).months.includes(11)).toBe(false)
    expect(hakuba && resortSeason(hakuba).months.includes(1)).toBe(true)
  })

  it('Альпы не закрываются в апреле, а Кавказ закрывается', () => {
    const chamonix = resorts.find((resort) => resort.id === 'chamonix')
    const gudauri = resorts.find((resort) => resort.id === 'gudauri')
    expect(chamonix && resortSeason(chamonix).months.includes(4)).toBe(true)
    expect(gudauri && resortSeason(gudauri).months.includes(4)).toBe(false)
  })

  it('сезон подписан диапазоном месяцев', () => {
    const ischgl = resorts.find((resort) => resort.id === 'ischgl')
    expect(ischgl && resortSeason(ischgl).label).toBe('дек — апр')
  })
})

describe('каталог курортов', () => {
  const source: Resort[] = resorts

  it('по умолчанию показывает все курорты', () => {
    expect(filterResorts(emptyFilters, source)).toHaveLength(source.length)
  })

  it('ищет по названию без учёта регистра', () => {
    const found = filterResorts({ ...emptyFilters, query: 'хакуба' }, source)
    expect(found.some((resort) => resort.id === 'hakuba')).toBe(true)
  })

  it('ищет по региону и стране', () => {
    expect(filterResorts({ ...emptyFilters, query: 'хоккайдо' }, source).length).toBeGreaterThan(0)
    const georgia = filterResorts({ ...emptyFilters, query: 'грузия' }, source)
    expect(georgia.every((resort) => resort.country === 'Грузия')).toBe(true)
  })

  it('фильтрует по стране', () => {
    const list = filterResorts({ ...emptyFilters, country: 'Япония' }, source)
    expect(list.length).toBeGreaterThan(10)
    expect(list.every((resort) => resort.country === 'Япония')).toBe(true)
  })

  it('фильтрует по месяцу сезона', () => {
    const may = filterResorts({ ...emptyFilters, month: 5 }, source)
    expect(may.length).toBeGreaterThan(0)
    expect(may.every((resort) => resortSeason(resort).months.includes(5))).toBe(true)
  })

  it('фильтр «только с гидом» оставляет 4 курорта', () => {
    const list = filterResorts({ ...emptyFilters, guideOnly: true }, source)
    expect(list).toHaveLength(4)
    expect(list.every((resort) => hasGuide(resort.id))).toBe(true)
  })

  it('комбинирует месяц и страну', () => {
    const list = filterResorts({ ...emptyFilters, country: 'Япония', month: 2 }, source)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((resort) => resort.country === 'Япония')).toBe(true)
  })

  it('сначала курорты с гидом, затем по алфавиту', () => {
    const list = filterResorts(emptyFilters, source)
    const guideFlags = list.map((resort) => hasGuide(resort.id))
    const firstWithoutGuide = guideFlags.indexOf(false)
    expect(guideFlags.slice(firstWithoutGuide).every((flag) => !flag)).toBe(true)
  })

  it('возвращает пусто на несуществующий запрос', () => {
    expect(filterResorts({ ...emptyFilters, query: 'абракадабра' }, source)).toEqual([])
  })

  it('список стран без дублей и отсортирован', () => {
    const countries = catalogCountries(source)
    expect(new Set(countries).size).toBe(countries.length)
    expect([...countries].sort((a, b) => a.localeCompare(b, 'ru'))).toEqual(countries)
  })
})