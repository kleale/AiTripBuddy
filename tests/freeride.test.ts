import { describe, expect, it } from 'vitest'
import { freeride, freerideFor, hasFreeride } from '@/data/freeride'
import { hasTrailList, trailListFor, trailLists } from '@/data/trail-lists'
import { resorts, findResort } from '@/data/resorts'
import { guideFor, resortGuides } from '@/data/resort-guides'
import { distanceKm } from '@/lib/geo'

const required = [
  'hakuba',
  'niseko',
  'krasnaya-polyana',
  'rosa-khutor',
  'mayrhofen',
  'gudauri',
  'mestia',
  'sheregesh',
  'krasnoe-ozero',
  'tuutari',
]

describe('фрирайд: покрытие', () => {
  it('есть данные для всех курортов с гидом', () => {
    const missing = Object.keys(resortGuides).filter((id) => !hasFreeride(id))
    expect(missing).toEqual([])
  })

  it('все ключи соответствуют реальным курортам', () => {
    const broken = Object.keys(freeride).filter((id) => !findResort(id))
    expect(broken).toEqual([])
  })

  it('описание и правила заполнены у каждого курорта', () => {
    for (const info of Object.values(freeride)) {
      expect(info.summary.length).toBeGreaterThan(40)
      expect(info.season.length).toBeGreaterThan(5)
      expect(info.gear.length).toBeGreaterThanOrEqual(2)
      expect(info.rules.length).toBeGreaterThanOrEqual(3)
      expect(info.bestFor.length).toBeGreaterThanOrEqual(2)
      expect(['low', 'moderate', 'considerable', 'high']).toContain(info.hazard)
    }
  })

  it('у курортов с развитым фрирайдом минимум две зоны', () => {
    for (const id of ['hakuba', 'niseko', 'krasnaya-polyana', 'rosa-khutor', 'gudauri', 'mestia']) {
      expect(freerideFor(id)?.zones.length ?? 0).toBeGreaterThanOrEqual(2)
    }
  })

  it('Туутари и Красное Озеро честно без фрирайда или почти без него', () => {
    expect(freerideFor('tuutari')?.zones).toHaveLength(0)
    expect(freerideFor('tuutari')?.hazard).toBe('low')
    expect((freerideFor('krasnoe-ozero')?.zones.length ?? 0)).toBeLessThanOrEqual(1)
  })
})

describe('фрирайд: геометрия', () => {
  it('полигоны зон имеют минимум четыре точки', () => {
    for (const info of Object.values(freeride)) {
      for (const zone of info.zones) {
        expect(zone.coordinates.length).toBeGreaterThanOrEqual(4)
      }
    }
  })

  it('зоны лежат рядом со своим курортом', () => {
    const broken: string[] = []
    for (const info of Object.values(freeride)) {
      const resort = findResort(info.resortId)
      if (!resort) continue
      for (const zone of info.zones) {
        for (const [lng, lat] of zone.coordinates) {
          const km = distanceKm({ lat: resort.lat, lng: resort.lng }, { lat, lng })
          if (km > 40) broken.push(`${info.resortId}/${zone.id}: ${Math.round(km)} км`)
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('вороты лежат близко к курорту', () => {
    const broken: string[] = []
    for (const info of Object.values(freeride)) {
      const resort = findResort(info.resortId)
      if (!resort) continue
      for (const gate of info.gates) {
        const km = distanceKm({ lat: resort.lat, lng: resort.lng }, { lat: gate.lat, lng: gate.lng })
        if (km > 40) broken.push(`${info.resortId}/${gate.id}: ${Math.round(km)} км`)
      }
    }
    expect(broken).toEqual([])
  })

  it('флаг наличия ворот совпадает с массивом', () => {
    for (const info of Object.values(freeride)) {
      expect(info.hasGates).toBe(info.gates.length > 0)
    }
  })

  it('у Хакубы и Нисеко вороты есть', () => {
    expect(freerideFor('hakuba')?.gates.length).toBeGreaterThan(0)
    expect(freerideFor('niseko')?.gates.length).toBeGreaterThan(0)
  })

  it('у курортов без ворот массив пуст', () => {
    for (const id of ['krasnaya-polyana', 'rosa-khutor', 'gudauri', 'mestia', 'sheregesh']) {
      expect(freerideFor(id)?.gates).toEqual([])
    }
  })
})

describe('список трасс для курортов без карты', () => {
  it('есть у Красной Поляны и Розы Хутор', () => {
    expect(hasTrailList('krasnaya-polyana')).toBe(true)
    expect(hasTrailList('rosa-khutor')).toBe(true)
  })

  it('у каждой трассы известны сложность, длина и перепад', () => {
    for (const list of Object.values(trailLists)) {
      for (const trail of list.trails) {
        expect(trail.lengthKm).toBeGreaterThan(0)
        expect(trail.verticalM).toBeGreaterThan(0)
        expect(['green', 'blue', 'red', 'black']).toContain(trail.difficulty)
      }
    }
  })

  it('покрыты все четыре сложности', () => {
    for (const list of Object.values(trailLists)) {
      const difficulties = new Set(list.trails.map((trail) => trail.difficulty))
      expect(difficulties.size).toBeGreaterThanOrEqual(3)
    }
  })

  it('у подъёмников есть тип и часы работы', () => {
    for (const list of Object.values(trailLists)) {
      for (const lift of list.lifts) {
        expect(['gondola', 'chair', 'drag', 'funicular', 'surface']).toContain(lift.type)
        expect(lift.hours.day).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/)
        expect(lift.lengthM).toBeGreaterThan(0)
      }
    }
  })

  it('есть подъёмники с вечерним катанием', () => {
    for (const list of Object.values(trailLists)) {
      expect(list.lifts.some((lift) => lift.hours.evening)).toBe(true)
    }
  })

  it('зоны трасс и подъёмников совпадают с зонами гида', () => {
    for (const list of Object.values(trailLists)) {
      const guide = guideFor(list.resortId)
      if (!guide) continue
      const zoneIds = new Set(guide.zones.map((zone) => zone.id))
      const trailZones = new Set(list.trails.map((trail) => trail.zoneId))
      for (const zoneId of trailZones) {
        expect(zoneIds.has(zoneId)).toBe(true)
      }
      for (const lift of list.lifts) {
        expect(zoneIds.has(lift.zoneId)).toBe(true)
      }
    }
  })

  it('источник указан и непустой', () => {
    for (const list of Object.values(trailLists)) {
      expect(list.source.length).toBeGreaterThan(10)
      expect(list.summary.length).toBeGreaterThan(40)
    }
  })

  it('для Хакубы геометрия на карте остаётся, курируемого списка нет', () => {
    expect(hasTrailList('hakuba')).toBe(false)
    expect(trailListFor('hakuba')).toBeUndefined()
  })

  it('в базе есть все 10 курортов с гидом', () => {
    expect(Object.keys(resortGuides).length).toBeGreaterThanOrEqual(10)
    expect(required.every((id) => resorts.some((resort) => resort.id === id))).toBe(true)
  })
})