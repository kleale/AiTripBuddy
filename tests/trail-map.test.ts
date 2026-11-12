import { describe, expect, it } from 'vitest'
import { hakubaTrails, trailsFor, hasTrailMap } from '@/data/trail-maps'
import { guideFor } from '@/data/resort-guides'
import {
  confidenceCoverage,
  filterTrails,
  freshestSnow,
  highestHazard,
  liftColors,
  liftLabels,
  scheduleLabel,
  snowForZone,
  snowLabels,
  trailColors,
  trailStats,
  trailsByZone,
  snowAgeHours,
} from '@/lib/trail-map'
import { distanceKm } from '@/lib/geo'

describe('набор трасс Хакубы', () => {
  it('доступен по id курорта', () => {
    expect(hasTrailMap('hakuba')).toBe(true)
    expect(trailsFor('hakuba')?.resortId).toBe('hakuba')
    expect(trailsFor('niseko')).toBeUndefined()
  })

  it('содержит трассы всех сложностей', () => {
    const difficulties = new Set(hakubaTrails.trails.map((trail) => trail.difficulty))
    expect(difficulties).toEqual(new Set(['green', 'blue', 'red', 'black']))
  })

  it('у каждой трассы минимум три точки и положительная длина', () => {
    for (const trail of hakubaTrails.trails) {
      expect(trail.coordinates.length).toBeGreaterThanOrEqual(3)
      expect(trail.lengthKm).toBeGreaterThan(0)
      expect(trail.verticalM).toBeGreaterThan(0)
    }
  })

  it('геометрия трасс лежит рядом с курортом', () => {
    const center = { lat: 36.7, lng: 137.85 }
    for (const trail of hakubaTrails.trails) {
      for (const [lng, lat] of trail.coordinates) {
        const km = distanceKm(center, { lat, lng })
        expect(km).toBeLessThan(25)
      }
    }
  })

  it('все zoneId трасс и подъёмников есть среди зон гида', () => {
    const guide = guideFor('hakuba')
    if (!guide) throw new Error('нет гида Хакубы')
    const zoneIds = new Set(guide.zones.map((zone) => zone.id))

    for (const trail of hakubaTrails.trails) {
      expect(zoneIds.has(trail.zoneId)).toBe(true)
    }
    for (const lift of hakubaTrails.lifts) {
      expect(zoneIds.has(lift.zoneId)).toBe(true)
    }
  })

  it('есть открытые и закрытые трассы, освещённые и нет', () => {
    expect(hakubaTrails.trails.some((t) => t.status === 'open')).toBe(true)
    expect(hakubaTrails.trails.some((t) => t.status === 'closed')).toBe(true)
    expect(hakubaTrails.trails.some((t) => t.lit)).toBe(true)
    expect(hakubaTrails.trails.some((t) => !t.lit)).toBe(true)
  })
})

describe('подъёмники', () => {
  it('все типы имеют подписи и цвета', () => {
    const types = new Set(hakubaTrails.lifts.map((lift) => lift.type))
    expect(types.has('gondola')).toBe(true)
    expect(types.has('chair')).toBe(true)
    expect(types.has('drag')).toBe(true)
    for (const type of types) {
      expect(liftLabels[type].length).toBeGreaterThan(2)
      expect(liftColors[type]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('у каждого подъёмника есть расписание и статус', () => {
    for (const lift of hakubaTrails.lifts) {
      expect(lift.schedule.day).toMatch(/\d{2}:\d{2}–\d{2}:\d{2}/)
      expect(['open', 'closed', 'scheduled', 'unknown']).toContain(lift.status)
      expect(lift.coordinates.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('есть подъёмники с вечерним катанием', () => {
    expect(hakubaTrails.lifts.some((lift) => lift.schedule.evening)).toBe(true)
  })

  it('расписание собирается в одну подпись', () => {
    const label = scheduleLabel(hakubaTrails.hours)
    expect(label).toContain('дневное 08:00–16:30')
    expect(label).toContain('вечернее 18:00–21:00')
  })
})

describe('сводка по трассам', () => {
  const stats = trailStats(hakubaTrails)

  it('считает открытые, освещённые и подготовленные', () => {
    expect(stats.total).toBe(hakubaTrails.trails.length)
    expect(stats.open).toBeGreaterThan(0)
    expect(stats.open).toBeLessThanOrEqual(stats.total)
    expect(stats.lit).toBeGreaterThan(0)
    expect(stats.groomed).toBeGreaterThan(0)
  })

  it('суммирует длину по сложностям', () => {
    const sum = Object.values(stats.byDifficulty).reduce((total, item) => total + item.lengthKm, 0)
    expect(sum).toBeCloseTo(stats.lengthKm, 1)
  })

  it('считает среднюю ширину только по известным', () => {
    expect(stats.avgWidthM).not.toBeNull()
    expect(stats.avgWidthM ?? 0).toBeGreaterThan(20)
  })

  it('считает подъёмники и вечерние', () => {
    expect(stats.liftsTotal).toBe(hakubaTrails.lifts.length)
    expect(stats.liftsOpen).toBeGreaterThan(0)
    expect(stats.eveningLifts).toBeGreaterThan(0)
  })
})

describe('фильтры', () => {
  it('фильтрует по сложности', () => {
    const red = filterTrails(hakubaTrails, { difficulty: 'red', litOnly: false, openOnly: false })
    expect(red.length).toBeGreaterThan(0)
    expect(red.every((trail) => trail.difficulty === 'red')).toBe(true)
  })

  it('фильтрует освещённые и открытые', () => {
    const lit = filterTrails(hakubaTrails, { difficulty: null, litOnly: true, openOnly: true })
    expect(lit.every((trail) => trail.lit && trail.status === 'open')).toBe(true)
  })

  it('пустой фильтр возвращает всё', () => {
    const all = filterTrails(hakubaTrails, { difficulty: null, litOnly: false, openOnly: false })
    expect(all).toHaveLength(hakubaTrails.trails.length)
  })

  it('фильтрует трассы и подъёмники по зоне', () => {
    const happo = trailsByZone(hakubaTrails, 'happo')
    expect(happo.length).toBeGreaterThan(0)
    expect(happo.every((trail) => trail.zoneId === 'happo')).toBe(true)
    expect(trailsByZone(hakubaTrails, null)).toHaveLength(hakubaTrails.trails.length)
  })
})

describe('доверие к данным', () => {
  it('покрытие подтверждённых полей выше 50%', () => {
    const coverage = confidenceCoverage(hakubaTrails)
    expect(coverage).toBeGreaterThan(50)
    expect(coverage).toBeLessThanOrEqual(100)
  })

  it('у каждой трассы указаны уровни и для геометрии, и для атрибутов', () => {
    for (const trail of hakubaTrails.trails) {
      expect(['verified', 'curated', 'estimate']).toContain(trail.confidence.geometry)
      expect(['verified', 'curated', 'estimate']).toContain(trail.confidence.attributes)
    }
  })
})

describe('снег', () => {
  it('состояния имеют подписи', () => {
    for (const state of hakubaTrails.snow) {
      expect(snowLabels[state.condition].length).toBeGreaterThan(2)
    }
  })

  it('находит снег по зоне', () => {
    expect(snowForZone(hakubaTrails, 'happo')?.condition).toBe('powder')
    expect(snowForZone(hakubaTrails, 'nope')).toBeNull()
    expect(snowForZone(hakubaTrails, null)).toBeNull()
  })

  it('считает свежесть и самую новую сводку', () => {
    const now = new Date('2026-11-12T08:00:00Z').getTime()
    expect(snowAgeHours('2026-11-12T06:00:00Z', now)).toBe(2)
    expect(snowAgeHours('мусор', now)).toBe(Number.POSITIVE_INFINITY)
    expect(freshestSnow(hakubaTrails, now)?.ageHours).toBeLessThanOrEqual(2)
  })
})

describe('backcountry', () => {
  it('находит самую опасную линию', () => {
    const top = highestHazard(hakubaTrails.backcountry)
    expect(top).not.toBeNull()
    expect(top?.hazard).toBe('high')
  })

  it('у каждой линии есть направление и примечание', () => {
    for (const route of hakubaTrails.backcountry) {
      expect(route.aspect.length).toBeGreaterThan(2)
      expect(route.note.length).toBeGreaterThan(10)
      expect(route.coordinates.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('пустой список даёт null', () => {
    expect(highestHazard([])).toBeNull()
  })
})

describe('цвета сложности', () => {
  it('все сложности имеют цвет-валидный hex', () => {
    for (const color of Object.values(trailColors)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})