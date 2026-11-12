import type { Resort } from './resorts'

export interface SeasonInfo {
  months: number[]
  label: string
}

const MONTH_LABELS: Record<number, string> = {
  11: 'ноя',
  12: 'дек',
  1: 'янв',
  2: 'фев',
  3: 'мар',
  4: 'апр',
  5: 'май',
}

/** Ориентировочные месяцы катания по странам; Хоккайдо выделен отдельно. */
const countryMonths: Record<string, number[]> = {
  Россия: [12, 1, 2, 3, 4],
  Грузия: [12, 1, 2, 3],
  Армения: [12, 1, 2, 3],
  Турция: [12, 1, 2, 3],
  Казахстан: [12, 1, 2, 3],
  Кыргызстан: [12, 1, 2, 3],
  Узбекистан: [12, 1, 2, 3],
  Франция: [12, 1, 2, 3, 4],
  Швейцария: [12, 1, 2, 3, 4],
  Австрия: [12, 1, 2, 3, 4],
  Италия: [12, 1, 2, 3, 4],
  Германия: [12, 1, 2, 3],
  Андорра: [12, 1, 2, 3, 4],
  Испания: [12, 1, 2, 3, 4],
  Болгария: [12, 1, 2, 3],
  Словакия: [12, 1, 2, 3, 4],
  Словения: [12, 1, 2, 3],
  Польша: [12, 1, 2, 3],
  Чехия: [12, 1, 2, 3],
  Норвегия: [11, 12, 1, 2, 3, 4, 5],
  Швеция: [11, 12, 1, 2, 3, 4],
  Финляндия: [11, 12, 1, 2, 3, 4, 5],
  Япония: [12, 1, 2, 3, 4],
  'Южная Корея': [12, 1, 2, 3],
  США: [12, 1, 2, 3, 4],
  Канада: [12, 1, 2, 3, 4],
}

const DEFAULT_MONTHS = [12, 1, 2, 3]

const monthOrder = [11, 12, 1, 2, 3, 4, 5]

function formatMonths(months: number[]): string {
  const sorted = [...months].sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first === undefined || last === undefined) return 'сезон уточняется'
  return `${MONTH_LABELS[first]} — ${MONTH_LABELS[last]}`
}

export function resortSeason(resort: Resort): SeasonInfo {
  let months = countryMonths[resort.country] ?? DEFAULT_MONTHS
  if (resort.country === 'Япония' && resort.region === 'Хоккайдо') {
    months = [11, 12, 1, 2, 3, 4]
  }
  return { months, label: formatMonths(months) }
}

export const seasonFilterMonths: { value: number; label: string }[] = [
  { value: 11, label: 'Ноябрь' },
  { value: 12, label: 'Декабрь' },
  { value: 1, label: 'Январь' },
  { value: 2, label: 'Февраль' },
  { value: 3, label: 'Март' },
  { value: 4, label: 'Апрель' },
  { value: 5, label: 'Май' },
]