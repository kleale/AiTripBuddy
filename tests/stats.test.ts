import { describe, expect, it } from 'vitest'
import { aggregateStats, statsSummary, type StatsDay } from '@/lib/stats'

function makeDays(count: number): StatsDay[] {
  const days: StatsDay[] = []
  const start = new Date(Date.UTC(2026, 0, 1))
  for (let index = 0; index < count; index += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    days.push({
      date: date.toISOString().slice(0, 10),
      unique: index % 3 === 0 ? 1 : 0,
      returning: index > 5 && index % 4 === 0 ? 1 : 0,
      total: index + 1,
    })
  }
  return days
}

describe('статистика посещений', () => {
  const days = makeDays(40)

  it('неделя — 7 точек', () => {
    expect(aggregateStats(days, 'week')).toHaveLength(7)
  })

  it('месяц — 30 точек', () => {
    expect(aggregateStats(days, 'month')).toHaveLength(30)
  })

  it('год группирует по месяцам', () => {
    const points = aggregateStats(days, 'year')
    expect(points.length).toBeGreaterThanOrEqual(2)
    expect(points[0]?.label).toMatch(/^\d{2}\.\d{2}$/)
  })

  it('всё — все дни', () => {
    expect(aggregateStats(days, 'all')).toHaveLength(40)
  })

  it('сводка: уникальные, возвраты и заходы', () => {
    const summary = statsSummary(days)
    expect(summary.unique).toBe(40)
    expect(summary.returning).toBeGreaterThan(0)
    expect(summary.visits).toBeGreaterThan(0)
  })

  it('пустой ряд не ломает график', () => {
    expect(aggregateStats([], 'week')).toEqual([])
    expect(statsSummary([])).toEqual({ unique: 0, returning: 0, visits: 0 })
  })
})
