import type { GuideZone, ResortGuide, TrailDifficulty } from '@/data/resort-guides'
import { distanceKm } from './geo'

/**
 * Трассы вьются, поэтому длина спуска больше прямой от базы до вершины.
 * Коэффициент 3.2 даёт реалистичный уклон: Майрхофен-Пенкен ≈ 13–14°,
 * что совпадает с паспортами трасс, тогда как расчёт по прямой давал 37°.
 */
const PISTE_WINDING = 3.2

/** Выше этого значения уклон считаем артефактом геометрии, а не реальной крутизной. */
const MAX_GRADIENT_PERCENT = 100

export interface SlopeZoneMetrics {
  zoneId: string
  name: string
  /** перепад зоны, м */
  vertical: number
  /** расстояние по прямой от базы до вершины, км */
  horizontalKm: number
  /** оценка среднего уклона трасс, % */
  avgGradientPercent: number
  /** оценка среднего уклона трасс, градусы */
  avgGradientDegrees: number
  /** длина спуска с учётом заложения трасс, км */
  runLengthKm: number
  trailsKm: number
  /** километров трасс на один подъёмник */
  kmPerLift: number
  /** метров перепада на один подъёмник */
  verticalPerLift: number
  /** доля трасс по сложности, % */
  shares: Record<TrailDifficulty, number>
}

export interface SlopePassport {
  resortId: string
  /** максимальный перепад среди зон, м */
  vertical: number
  /** суммарный километраж трасс, км */
  trailsKm: number
  lifts: number
  zones: SlopeZoneMetrics[]
  /** доля трасс по сложности по всему курорту, % */
  shares: Record<TrailDifficulty, number>
  kmPerLift: number
  verticalPerLift: number
  /** самая крутая зона по среднему уклону */
  steepest: SlopeZoneMetrics | null
  /** самая длинная зона по километражу */
  longest: SlopeZoneMetrics | null
}

const emptyShares = (): Record<TrailDifficulty, number> => ({
  green: 0,
  blue: 0,
  red: 0,
  black: 0,
})

function safe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Доли трасс по сложности в процентах; при нулевом километраже — нули. */
export function difficultyShares(trailsKm: Record<TrailDifficulty, number>): Record<TrailDifficulty, number> {
  const total = safe(trailsKm.green) + safe(trailsKm.blue) + safe(trailsKm.red) + safe(trailsKm.black)
  if (total === 0) return emptyShares()
  return {
    green: round((safe(trailsKm.green) / total) * 100),
    blue: round((safe(trailsKm.blue) / total) * 100),
    red: round((safe(trailsKm.red) / total) * 100),
    black: round((safe(trailsKm.black) / total) * 100),
  }
}

/**
 * Паспорт зоны катания: перепад, оценка уклона трасс и эффективность подъёмников.
 * Уклон считается от высот базы и вершины и длины спуска с коэффициентом заложения:
 * это ориентир «средней крутизны трасс зоны», а не уклон каждой отдельной трассы.
 */
export function zoneSlopeMetrics(zone: GuideZone): SlopeZoneMetrics {
  const vertical = Math.max(0, safe(zone.topAltitude) - safe(zone.baseAltitude))
  const horizontalKm = distanceKm(zone.base, zone.summit)
  const horizontalM = horizontalKm * 1000

  const runLengthM = horizontalM * PISTE_WINDING
  const runLengthKm = runLengthM / 1000
  const rawRatio = runLengthM > 0 ? vertical / runLengthM : 0
  const ratio = Math.min(rawRatio, MAX_GRADIENT_PERCENT / 100)
  const avgGradientPercent = ratio * 100
  const avgGradientDegrees = (Math.atan(ratio) * 180) / Math.PI

  const trailsKm = round(
    safe(zone.trailsKm.green) + safe(zone.trailsKm.blue) + safe(zone.trailsKm.red) + safe(zone.trailsKm.black),
    1,
  )
  const lifts = Math.max(1, Math.round(safe(zone.lifts)))

  return {
    zoneId: zone.id,
    name: zone.name,
    vertical,
    horizontalKm: round(horizontalKm, 2),
    avgGradientPercent: round(avgGradientPercent, 1),
    avgGradientDegrees: round(avgGradientDegrees, 1),
    runLengthKm: round(runLengthKm, 1),
    trailsKm,
    kmPerLift: round(trailsKm / lifts, 1),
    verticalPerLift: round(vertical / lifts),
    shares: difficultyShares(zone.trailsKm),
  }
}

/** Паспорт всего курорта по данным гида. */
export function slopePassport(guide: ResortGuide): SlopePassport {
  const zones = guide.zones.map(zoneSlopeMetrics)

  const trailsKm = round(
    zones.reduce((sum, zone) => sum + zone.trailsKm, 0),
    1,
  )
  const lifts = Math.max(1, Math.round(safe(guide.lifts)))
  const vertical = zones.reduce((max, zone) => Math.max(max, zone.vertical), 0)

  const totals = guide.zones.reduce(
    (acc, zone) => {
      acc.green += safe(zone.trailsKm.green)
      acc.blue += safe(zone.trailsKm.blue)
      acc.red += safe(zone.trailsKm.red)
      acc.black += safe(zone.trailsKm.black)
      return acc
    },
    emptyShares(),
  )

  const steepest = [...zones].sort((a, b) => b.avgGradientPercent - a.avgGradientPercent)[0] ?? null
  const longest = [...zones].sort((a, b) => b.trailsKm - a.trailsKm)[0] ?? null

  return {
    resortId: guide.resortId,
    vertical,
    trailsKm,
    lifts,
    zones,
    shares: difficultyShares(totals),
    kmPerLift: round(trailsKm / lifts, 1),
    verticalPerLift: round(vertical / lifts),
    steepest: steepest && steepest.avgGradientPercent > 0 ? steepest : null,
    longest: longest && longest.trailsKm > 0 ? longest : null,
  }
}

/** Короткая подпись для карточки каталога: «900 м · 14° · 4.5 км/подъёмник». */
export function slopeSummary(passport: SlopePassport): string {
  const parts: string[] = []
  if (passport.vertical > 0) parts.push(`${passport.vertical} м`)
  const steepest = passport.steepest
  if (steepest) parts.push(`${steepest.avgGradientDegrees}°`)
  if (passport.kmPerLift > 0) parts.push(`${passport.kmPerLift} км/подъёмник`)
  return parts.join(' · ')
}