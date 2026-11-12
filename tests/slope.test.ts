import { describe, expect, it } from 'vitest'
import { difficultyShares, slopePassport, slopeSummary, zoneSlopeMetrics } from '@/lib/slope'
import { guideFor, resortGuides, type GuideZone } from '@/data/resort-guides'

const zone = (overrides: Partial<GuideZone> = {}): GuideZone => ({
  id: 'z1',
  name: 'Тестовая зона',
  baseAltitude: 1000,
  topAltitude: 2000,
  lifts: 5,
  trailsKm: { green: 2, blue: 6, red: 10, black: 2 },
  passPrice: 100,
  passCurrency: 'RUB',
  base: { lat: 47, lng: 11 },
  summit: { lat: 47, lng: 11 },
  ...overrides,
})

describe('доли сложности', () => {
  it('считает проценты и округляет', () => {
    expect(difficultyShares({ green: 2, blue: 6, red: 10, black: 2 })).toEqual({
      green: 10,
      blue: 30,
      red: 50,
      black: 10,
    })
  })

  it('возвращает нули при пустом километраже', () => {
    expect(difficultyShares({ green: 0, blue: 0, red: 0, black: 0 })).toEqual({
      green: 0,
      blue: 0,
      red: 0,
      black: 0,
    })
  })

  it('игнорирует отрицательные значения', () => {
    const shares = difficultyShares({ green: -5, blue: 10, red: 10, black: 0 })
    expect(shares.green).toBe(0)
    expect(shares.blue).toBe(50)
  })
})

describe('паспорт зоны', () => {
  it('считает перепад и средний уклон по координатам', () => {
    const metrics = zoneSlopeMetrics(
      zone({
        baseAltitude: 540,
        topAltitude: 2320,
        base: { lat: 43.5707, lng: 40.2765 },
        summit: { lat: 43.55, lng: 40.29 },
      }),
    )
    expect(metrics.vertical).toBe(1780)
    expect(metrics.horizontalKm).toBeGreaterThan(2)
    expect(metrics.horizontalKm).toBeLessThan(4)
    expect(metrics.avgGradientDegrees).toBeGreaterThan(10)
    expect(metrics.avgGradientDegrees).toBeLessThan(20)
  })

  it('учитывает заложение трасс: 1 км перепада на 1 км прямой даёт ~17°', () => {
    // 0.009 градуса широты ≈ 1 км; перепад 1 км, длина спуска ≈ 3.2 км
    const metrics = zoneSlopeMetrics(
      zone({
        baseAltitude: 0,
        topAltitude: 1000,
        base: { lat: 45, lng: 10 },
        summit: { lat: 45.009, lng: 10 },
      }),
    )
    expect(metrics.runLengthKm).toBeGreaterThan(3)
    expect(metrics.runLengthKm).toBeLessThan(3.5)
    expect(metrics.avgGradientPercent).toBeGreaterThan(28)
    expect(metrics.avgGradientPercent).toBeLessThan(35)
    expect(metrics.avgGradientDegrees).toBeGreaterThan(15)
    expect(metrics.avgGradientDegrees).toBeLessThan(20)
  })

  it('не выдаёт уклон выше 100% даже на отвесной геометрии', () => {
    const metrics = zoneSlopeMetrics(
      zone({
        baseAltitude: 0,
        topAltitude: 5000,
        base: { lat: 45, lng: 10 },
        summit: { lat: 45.0002, lng: 10 },
      }),
    )
    expect(metrics.avgGradientPercent).toBeLessThanOrEqual(100)
    expect(metrics.avgGradientDegrees).toBeLessThanOrEqual(45.1)
  })

  it('не делит на ноль при совпадающих точках', () => {
    const metrics = zoneSlopeMetrics(zone({ baseAltitude: 1000, topAltitude: 1500 }))
    expect(metrics.horizontalKm).toBe(0)
    expect(metrics.avgGradientPercent).toBe(0)
    expect(metrics.avgGradientDegrees).toBe(0)
    expect(metrics.vertical).toBe(500)
  })

  it('считает километры и перепад на подъёмник', () => {
    const metrics = zoneSlopeMetrics(zone({ lifts: 4, baseAltitude: 1000, topAltitude: 1400 }))
    expect(metrics.trailsKm).toBe(20)
    expect(metrics.kmPerLift).toBe(5)
    expect(metrics.verticalPerLift).toBe(100)
  })

  it('защищает от нулевого числа подъёмников', () => {
    const metrics = zoneSlopeMetrics(zone({ lifts: 0, trailsKm: { green: 1, blue: 1, red: 1, black: 1 } }))
    expect(metrics.kmPerLift).toBe(4)
    expect(Number.isFinite(metrics.verticalPerLift)).toBe(true)
  })

  it('берёт перепад по модулю верхней и нижней отметки', () => {
    const metrics = zoneSlopeMetrics(zone({ baseAltitude: 2000, topAltitude: 1000 }))
    expect(metrics.vertical).toBe(0)
  })
})

describe('паспорт курорта', () => {
  it('считает километраж по зонам, а не по заявленному итогу', () => {
    const guide = guideFor('rosa-khutor')
    if (!guide) throw new Error('нет гида')
    const passport = slopePassport(guide)
    // в зонах гида описано 19 + 26 км, официальный итог курорта — 77 км
    expect(passport.trailsKm).toBe(45)
    expect(guide.totalTrailsKm).toBe(77)
    expect(passport.vertical).toBe(1780)
    expect(passport.zones).toHaveLength(2)
    expect(passport.kmPerLift).toBeGreaterThan(0)
    expect(passport.verticalPerLift).toBeGreaterThan(0)
  })

  it('находит самую крутую и самую длинную зону', () => {
    const guide = guideFor('hakuba')
    if (!guide) throw new Error('нет гида')
    const passport = slopePassport(guide)
    expect(passport.steepest).not.toBeNull()
    expect(passport.longest).not.toBeNull()
    if (passport.steepest && passport.longest) {
      expect(passport.steepest.avgGradientPercent).toBeGreaterThanOrEqual(
        Math.max(...passport.zones.map((z) => z.avgGradientPercent)) - 0.01,
      )
      expect(passport.longest.trailsKm).toBeGreaterThanOrEqual(
        Math.max(...passport.zones.map((z) => z.trailsKm)) - 0.01,
      )
    }
  })

  it('считает доли сложности по всему курорту', () => {
    const guide = guideFor('mayrhofen')
    if (!guide) throw new Error('нет гида')
    const passport = slopePassport(guide)
    const total = Object.values(passport.shares).reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThan(95)
    expect(total).toBeLessThan(105)
  })

  it('работает для всех гидов без NaN', () => {
    for (const guide of Object.values(resortGuides)) {
      const passport = slopePassport(guide)
      expect(passport.vertical).toBeGreaterThan(0)
      expect(passport.trailsKm).toBeGreaterThan(0)
      expect(Number.isFinite(passport.kmPerLift)).toBe(true)
      expect(Number.isFinite(passport.verticalPerLift)).toBe(true)
      for (const zone of passport.zones) {
        expect(Number.isFinite(zone.avgGradientPercent)).toBe(true)
        expect(Number.isFinite(zone.avgGradientDegrees)).toBe(true)
        expect(zone.avgGradientPercent).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('короткая подпись содержит перепад и уклон', () => {
    const guide = guideFor('sheregesh')
    if (!guide) throw new Error('нет гида')
    const summary = slopeSummary(slopePassport(guide))
    expect(summary).toContain('м')
    expect(summary).toContain('км/подъёмник')
  })
})


describe('согласованность гидов', () => {
  it('официальный итог не меньше описанных зон', () => {
    const broken: string[] = []
    for (const guide of Object.values(resortGuides)) {
      const passport = slopePassport(guide)
      if (guide.totalTrailsKm < passport.trailsKm) {
        broken.push(guide.resortId + ': ' + guide.totalTrailsKm + ' < ' + passport.trailsKm)
      }
    }
    expect(broken).toEqual([])
  })

  it('паспорт курорта = сумма паспортов зон', () => {
    for (const guide of Object.values(resortGuides)) {
      const passport = slopePassport(guide)
      const zoneKm = passport.zones.reduce((sum, zone) => sum + zone.trailsKm, 0)
      expect(Math.abs(passport.trailsKm - zoneKm)).toBeLessThan(0.2)
    }
  })

  it('в каждой зоне трассы распределены по сложностям', () => {
    for (const guide of Object.values(resortGuides)) {
      for (const zone of guide.zones) {
        const km = Object.values(zone.trailsKm).reduce((sum, value) => sum + value, 0)
        expect(km).toBeGreaterThan(0)
      }
    }
  })
})


describe('реалистичность оценок уклона', () => {
  it('средний уклон всех зон в правдоподобном диапазоне 1–30°', () => {
    const broken: string[] = []
    for (const guide of Object.values(resortGuides)) {
      for (const zone of slopePassport(guide).zones) {
        // учебные склоны Туутари и Красного Озера честно пологие — от 2°
        if (zone.avgGradientDegrees < 1 || zone.avgGradientDegrees > 30) {
          broken.push(guide.resortId + '/' + zone.name + ': ' + zone.avgGradientDegrees + '°')
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('Майрхофен-Пенкен близок к реальным 13–15°', () => {
    const guide = guideFor('mayrhofen')
    if (!guide) throw new Error('нет гида')
    const penken = slopePassport(guide).zones.find((zone) => zone.zoneId === 'penken')
    expect(penken).toBeDefined()
    expect(penken && penken.avgGradientDegrees).toBeGreaterThan(11)
    expect(penken && penken.avgGradientDegrees).toBeLessThan(18)
  })
})
