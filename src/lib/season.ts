import type { Resort } from '@/data/resorts'
import { resortSeason } from '@/data/resort-season'

export type SeasonLevel = 'peak' | 'high' | 'mid' | 'low' | 'off'

export const seasonLabels: Record<SeasonLevel, string> = {
  peak: 'пик сезона',
  high: 'высокий сезон',
  mid: 'средний сезон',
  low: 'низкий сезон',
  off: 'межсезонье',
}

export const seasonShortLabels: Record<SeasonLevel, string> = {
  peak: 'пик',
  high: 'высокий',
  mid: 'средний',
  low: 'низкий',
  off: 'закрыто',
}

/** Ориентировочный коэффициент спроса к средней цене; не заменяет оффер. */
export const seasonPriceFactor: Record<SeasonLevel, number> = {
  peak: 1.35,
  high: 1.15,
  mid: 1,
  low: 0.85,
  off: 0,
}

export function parseIsoDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addDaysIso(value: string, days: number): string {
  const date = parseIsoDate(value)
  if (!date) return value
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function inPeak(date: Date): boolean {
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  return (month === 12 && day >= 28) || (month === 1 && day <= 5)
}

/** Уровень сезона для конкретной даты по стране/региону курорта. */
export function seasonLevel(dateIso: string | undefined, resort: Resort): SeasonLevel {
  const date = parseIsoDate(dateIso)
  if (!date) return 'mid'
  const month = date.getUTCMonth() + 1
  const months = resortSeason(resort).months
  if (!months.includes(month)) return 'off'
  if (inPeak(date)) return 'peak'

  if (month === 12) return 'high'
  if (month === 1 || month === 2) return 'high'
  if (month === 3) return date.getUTCDate() <= 20 ? 'mid' : 'low'
  if (month === 11 || month === 4 || month === 5) return 'low'
  return 'mid'
}

export interface SeasonRange {
  level: SeasonLevel
  from: string
  to: string
  factor: number
}

/** Общий уровень диапазона: берём самый «дорогой» день поездки. */
export function seasonRange(
  checkIn: string | undefined,
  nights: number,
  resort: Resort,
): SeasonRange | null {
  const start = parseIsoDate(checkIn)
  if (!start || nights <= 0) return null
  const rank: SeasonLevel[] = ['off', 'low', 'mid', 'high', 'peak']
  let level: SeasonLevel = 'off'
  for (let index = 0; index < nights; index += 1) {
    const current = new Date(start)
    current.setUTCDate(current.getUTCDate() + index)
    const day = seasonLevel(current.toISOString().slice(0, 10), resort)
    if (rank.indexOf(day) > rank.indexOf(level)) level = day
  }
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + Math.max(0, nights - 1))
  return {
    level,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    factor: seasonPriceFactor[level],
  }
}

export interface SeasonMonth {
  month: number
  label: string
  level: SeasonLevel
  inSeason: boolean
}

const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const calendarOrder = [11, 12, 1, 2, 3, 4, 5]

/** Календарь сезонности по месяцам катания; уровень — по середине месяца. */
export function seasonCalendar(resort: Resort): SeasonMonth[] {
  return calendarOrder.map((month) => {
    const year = month >= 11 ? 2026 : 2027
    const date = new Date(Date.UTC(year, month - 1, 15))
    const iso = date.toISOString().slice(0, 10)
    const level = seasonLevel(iso, resort)
    return { month, label: monthNames[month - 1], level, inSeason: level !== 'off' }
  })
}

export interface NearbyDateOption {
  date: string
  shift: number
  level: SeasonLevel
  factor: number
  /** Разница к базовой цене в валюте отеля; минус — дешевле. */
  deltaPerNight: number
  deltaTotal: number
}

/**
 * Соседние даты ±3/±7 дней. pricePerNight — базовая цена среднего сезона.
 * Разница считается к текущему сезонному ориентиру, а не к офферу партнёра.
 */
export function nearbyDates(
  checkIn: string | undefined,
  nights: number,
  resort: Resort,
  pricePerNight: number,
): NearbyDateOption[] {
  if (!checkIn || nights <= 0 || !Number.isFinite(pricePerNight)) return []
  const base = seasonRange(checkIn, nights, resort)
  if (!base) return []
  const current = Math.round(pricePerNight * base.factor)
  return [-7, -3, 3, 7]
    .map((shift) => {
      const date = addDaysIso(checkIn, shift)
      const range = seasonRange(date, nights, resort)
      if (!range) return null
      const nightly = Math.round(pricePerNight * range.factor)
      const deltaPerNight = nightly - current
      return {
        date,
        shift,
        level: range.level,
        factor: range.factor,
        deltaPerNight,
        deltaTotal: deltaPerNight * nights,
      }
    })
    .filter((item): item is NearbyDateOption => item !== null && item.level !== 'off')
}

export function cheapestNearby(options: NearbyDateOption[]): NearbyDateOption | null {
  return options
    .filter((item) => item.deltaTotal < 0)
    .sort((a, b) => a.deltaTotal - b.deltaTotal)[0] ?? null
}
