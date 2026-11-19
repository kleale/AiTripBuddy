import { describe, expect, it } from 'vitest'
import { findResort } from '@/data/resorts'
import {
  cheapestNearby,
  nearbyDates,
  seasonCalendar,
  seasonLevel,
  seasonRange,
} from '@/lib/season'

const hakuba = findResort('hakuba')
const sochi = findResort('krasnaya-polyana')
if (!hakuba || !sochi) throw new Error('resorts missing')

describe('сезонность курорта', () => {
  it('пик новогодних праздников и высокий сезон', () => {
    expect(seasonLevel('2027-01-01', hakuba)).toBe('peak')
    expect(seasonLevel('2027-01-20', hakuba)).toBe('high')
    expect(seasonLevel('2027-03-05', hakuba)).toBe('mid')
    expect(seasonLevel('2027-04-20', hakuba)).toBe('low')
  })

  it('межсезонье определяется по стране', () => {
    expect(seasonLevel('2027-07-10', sochi)).toBe('off')
    expect(seasonLevel('2027-08-10', hakuba)).toBe('off')
  })

  it('диапазон берёт самый дорогой день', () => {
    const range = seasonRange('2026-12-30', 5, hakuba)
    expect(range?.level).toBe('peak')
    expect(range?.factor).toBeGreaterThan(1)
  })

  it('календарь идёт от ноября к маю', () => {
    const months = seasonCalendar(hakuba)
    expect(months.map((month) => month.month)).toEqual([11, 12, 1, 2, 3, 4, 5])
    expect(months.filter((month) => month.inSeason).length).toBeGreaterThan(3)
  })

  it('соседние даты считают ориентир экономии', () => {
    const options = nearbyDates('2027-01-02', 4, hakuba, 20000)
    const cheaper = cheapestNearby(options)
    expect(cheaper).not.toBeNull()
    expect(cheaper?.deltaTotal).toBeLessThan(0)
  })

  it('без даты не строит варианты', () => {
    expect(nearbyDates(undefined, 4, hakuba, 20000)).toEqual([])
  })
})
