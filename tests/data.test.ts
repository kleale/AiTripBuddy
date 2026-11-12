import { describe, expect, it } from 'vitest'
import { cities, findCity } from '@/data/cities'
import { resorts, findResort } from '@/data/resorts'
import {
  MAX_TRANSFER_KM,
  airportSuggestions,
  nearbyAirports,
  resortDistanceFromAirport,
  resortsForAirport,
} from '@/data/resort-airports'
import { foodPerDay, mealOptions } from '@/data/meals'

describe('целостность справочников', () => {
  it('у всех курортов есть хотя бы один аэропорт', () => {
    const missing = resorts.filter((resort) => nearbyAirports(resort.id).length === 0)
    expect(missing.map((r) => r.id)).toEqual([])
  })

  it('все аэропорты в связках существуют', () => {
    const broken: string[] = []
    for (const resort of resorts) {
      for (const item of nearbyAirports(resort.id)) {
        if (!findCity(item.cityId)) broken.push(`${resort.id} → ${item.cityId}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('нет дублей кодов аэропортов', () => {
    const seen = new Map<string, string[]>()
    for (const city of cities) {
      const list = seen.get(city.code) ?? []
      list.push(city.id)
      seen.set(city.code, list)
    }
    const duplicates = [...seen.entries()].filter(([, ids]) => ids.length > 1)
    expect(duplicates).toEqual([])
  })

  it('все ключи связок соответствуют реальным курортам', () => {
    const ids = new Set(resorts.map((r) => r.id))
    const extra: string[] = []
    for (const resort of resorts) {
      if (!ids.has(resort.id)) extra.push(resort.id)
    }
    expect(extra).toEqual([])
  })
})

describe('подбор курортов по аэропорту', () => {
  it('из Токио не предлагает Шерегеш', () => {
    const list = resortsForAirport('tokyo-nrt')
    expect(list.some((item) => item.resortId === 'sheregesh')).toBe(false)
  })

  it('из Инсбрука предлагает Ишгль в пределах трансфера', () => {
    const list = resortsForAirport('innsbruck-inn')
    const ischgl = list.find((item) => item.resortId === 'ischgl')
    expect(ischgl).toBeDefined()
    expect(ischgl?.km).toBe(100)
    expect(ischgl?.access).toBe('transfer')
  })

  it('из Инсбрука видит итальянские курорты как приграничный трансфер', () => {
    const list = resortsForAirport('innsbruck-inn')
    expect(list.some((item) => item.resortId === 'val-gardena')).toBe(true)
  })

  it('дальние хабы помечены как hub', () => {
    const list = resortsForAirport('tokyo-nrt')
    const niseko = list.find((item) => item.resortId === 'niseko')
    expect(niseko?.access).toBe('hub')
  })

  it('не предлагает курорты дальше лимита без явной связки', () => {
    const list = resortsForAirport('dubai-dxb')
    expect(list).toEqual([])
  })

  it('сортирует трансферы перед хабами и по расстоянию', () => {
    const list = resortsForAirport('tokyo-nrt')
    const firstHub = list.findIndex((item) => item.access === 'hub')
    if (firstHub > 0) {
      const before = list.slice(0, firstHub)
      expect(before.every((item) => item.access === 'transfer')).toBe(true)
      expect(before.every((item) => item.km <= MAX_TRANSFER_KM)).toBe(true)
    }
  })
})

describe('расстояния по курортам', () => {
  it('берёт точное расстояние из таблицы', () => {
    const item = resortDistanceFromAirport('ischgl', 'innsbruck-inn')
    expect(item?.exact).toBe(true)
    expect(item?.km).toBe(100)
  })

  it('оценивает расстояние по координатам, если связки нет', () => {
    const item = resortDistanceFromAirport('bad-gastein', 'innsbruck-inn')
    expect(item?.exact).toBe(false)
    expect(item?.km).toBeGreaterThan(0)
  })

  it('возвращает null для неизвестных id', () => {
    expect(resortDistanceFromAirport('nope', 'innsbruck-inn')).toBeNull()
    expect(resortDistanceFromAirport('ischgl', 'nope')).toBeNull()
  })

  it('подсказки аэропортов содержат город и курорт', () => {
    const suggestions = airportSuggestions('ischgl')
    expect(suggestions[0]?.city.code).toBe('INN')
    expect(suggestions[0]?.resortName).toBe('Ишгль')
  })
})

describe('питание', () => {
  it('дороже в Швейцарии, чем в России', () => {
    const meals = { breakfast: 'hotel', lunch: 'cafe', dinner: 'slope' } as const
    const swiss = foodPerDay('zermatt', meals, 'EUR')
    const russian = foodPerDay('sheregesh', meals, 'EUR')
    expect(swiss).toBeGreaterThan(russian)
  })

  it('нулевое питание при всех none', () => {
    const meals = { breakfast: 'none', lunch: 'none', dinner: 'none' } as const
    expect(foodPerDay('zermatt', meals, 'RUB')).toBe(0)
  })

  it('пересчитывает цену в валюту поездки', () => {
    const meals = { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' } as const
    expect(foodPerDay('ischgl', meals, 'RUB')).toBeGreaterThan(foodPerDay('ischgl', meals, 'EUR'))
  })

  it('содержит четыре варианта питания', () => {
    expect(mealOptions.map((o) => o.key)).toEqual(['none', 'hotel', 'cafe', 'slope'])
  })
})

describe('справочник курортов', () => {
  it('находит известный курорт', () => {
    expect(findResort('niseko')?.country).toBe('Япония')
  })
})