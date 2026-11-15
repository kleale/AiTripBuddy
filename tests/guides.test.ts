import { describe, expect, it } from 'vitest'
import { findResort } from '@/data/resorts'
import { nearbyAirports } from '@/data/resort-airports'
import { guideDifficulty, hasGuide, resortGuides } from '@/data/resort-guides'

const required = [
  'niseko',
  'hakuba',
  'krasnaya-polyana',
  'rosa-khutor',
  'gudauri',
  'mestia',
  'sheregesh',
  'krasnoe-ozero',
  'tuutari',
  'mayrhofen',
  'kirovsk',
  'dombay',
  'elbrus',
  'manzherok',
  'arkhyz',
]

describe('гиды по курортам', () => {
  it('есть гиды для Нисеко, Хакубы, Красной Поляны и Розы Хутор', () => {
    expect(required.filter((id) => !hasGuide(id))).toEqual([])
  })

  it('в базе не меньше 15 гидов', () => {
    expect(Object.keys(resortGuides).length).toBeGreaterThanOrEqual(15)
  })

  it('новые российские гиды на месте', () => {
    for (const id of ['kirovsk', 'dombay', 'elbrus', 'manzherok', 'arkhyz']) {
      const guide = resortGuides[id]
      expect(guide?.zones.length).toBeGreaterThanOrEqual(2)
      expect(guide?.zones.every((zone) => zone.passCurrency === 'RUB')).toBe(true)
    }
  })

  it('все гиды ссылаются на существующие курорты', () => {
    const broken = Object.keys(resortGuides).filter((id) => !findResort(id))
    expect(broken).toEqual([])
  })

  it('у всех курортов с гидом есть аэропорты', () => {
    const broken = Object.keys(resortGuides).filter((id) => nearbyAirports(id).length === 0)
    expect(broken).toEqual([])
  })

  it('в каждом гиде минимум 2 части курорта', () => {
    const shallow = Object.values(resortGuides).filter((guide) => guide.zones.length < 2)
    expect(shallow.map((guide) => guide.resortId)).toEqual([])
  })

  it('у каждой части курорта корректные высоты, цена и подъёмники', () => {
    for (const guide of Object.values(resortGuides)) {
      for (const zone of guide.zones) {
        expect(zone.baseAltitude).toBeLessThan(zone.topAltitude)
        expect(zone.passPrice).toBeGreaterThan(0)
        expect(zone.lifts).toBeGreaterThan(0)
        expect(['JPY', 'RUB', 'EUR', 'GEL']).toContain(zone.passCurrency)
        const km = Object.values(zone.trailsKm).reduce((sum, value) => sum + value, 0)
        expect(km).toBeGreaterThan(0)
      }
    }
  })

  it('id частей курорта уникальны внутри гида', () => {
    for (const guide of Object.values(resortGuides)) {
      const ids = guide.zones.map((zone) => zone.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('суммарная сложность совпадает с суммой по частям', () => {
    for (const guide of Object.values(resortGuides)) {
      const total = guideDifficulty(guide)
      const byZones = guide.zones.reduce(
        (acc, zone) => {
          acc.green += zone.trailsKm.green
          acc.blue += zone.trailsKm.blue
          acc.red += zone.trailsKm.red
          acc.black += zone.trailsKm.black
          return acc
        },
        { green: 0, blue: 0, red: 0, black: 0 },
      )
      expect(total).toEqual(byZones)
    }
  })

  it('в гиде есть сезон, советы и рекомендации', () => {
    for (const guide of Object.values(resortGuides)) {
      expect(guide.season.length).toBeGreaterThan(3)
      expect(guide.tips.length).toBeGreaterThanOrEqual(3)
      expect(guide.bestFor.length).toBeGreaterThanOrEqual(3)
      expect(guide.totalTrailsKm).toBeGreaterThan(0)
      expect(guide.lifts).toBeGreaterThan(0)
      expect(guide.vertical).toBeGreaterThan(0)
    }
  })

  it('общий скипасс указан там, где он есть', () => {
    expect(resortGuides.niseko?.passAll?.price).toBeGreaterThan(0)
    expect(resortGuides.hakuba?.passAll?.price).toBeGreaterThan(0)
    expect(resortGuides['rosa-khutor']?.passAll?.price).toBeGreaterThan(0)
    expect(resortGuides.gudauri?.passAll?.currency).toBe('GEL')
    expect(resortGuides.mayrhofen?.passAll?.currency).toBe('EUR')
  })

  it('у Розы Хутор два склона с разными ценами', () => {
    const guide = resortGuides['rosa-khutor']
    expect(guide?.zones.map((zone) => zone.name)).toEqual(['Северный склон', 'Южный склон'])
    const prices = new Set(guide?.zones.map((zone) => zone.passPrice))
    expect(prices.size).toBe(2)
  })

  it('у каждой части курорта есть реальные координаты базы и вершины', () => {
    for (const guide of Object.values(resortGuides)) {
      for (const zone of guide.zones) {
        expect(Number.isFinite(zone.base.lat)).toBe(true)
        expect(Number.isFinite(zone.base.lng)).toBe(true)
        expect(Number.isFinite(zone.summit.lat)).toBe(true)
        expect(Number.isFinite(zone.summit.lng)).toBe(true)
        expect(Math.abs(zone.base.lat)).toBeLessThanOrEqual(90)
        expect(Math.abs(zone.base.lng)).toBeLessThanOrEqual(180)
        const same = zone.base.lat === zone.summit.lat && zone.base.lng === zone.summit.lng
        expect(same).toBe(false)
      }
    }
  })

  it('координаты гидов лежат рядом с самим курортом', () => {
    for (const guide of Object.values(resortGuides)) {
      const resort = findResort(guide.resortId)
      if (!resort) continue
      for (const zone of guide.zones) {
        const km = Math.hypot((zone.base.lat - resort.lat) * 111, (zone.base.lng - resort.lng) * 85)
        expect(km).toBeLessThan(30)
      }
    }
  })

  it('Роза Хутор — отдельный курорт с аэропортом Сочи', () => {
    const links = nearbyAirports('rosa-khutor')
    expect(links[0]?.cityId).toBe('sochi-aer')
    expect(findResort('rosa-khutor')?.country).toBe('Россия')
  })
})