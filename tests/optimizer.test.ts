import { describe, expect, it } from 'vitest'
import { findResort } from '@/data/resorts'
import { defaultOptimizerInput, optimizeTrip, transferBetween } from '@/lib/optimizer'

const kp = findResort('krasnaya-polyana')
const rosa = findResort('rosa-khutor')
if (!kp || !rosa) throw new Error('resorts missing')

function input(overrides: Partial<ReturnType<typeof defaultOptimizerInput>> = {}) {
  return {
    ...defaultOptimizerInput('RUB'),
    resortIds: ['krasnaya-polyana', 'rosa-khutor'],
    nights: 8,
    pax: 2,
    budget: 250000,
    ...overrides,
  }
}

describe('мультикурортный оптимизатор', () => {
  it('оценивает переезд между соседними курортами', () => {
    const transfer = transferBetween(kp, rosa, 2, 'RUB')
    expect(transfer.km).toBeGreaterThan(0)
    expect(transfer.price).toBeGreaterThan(0)
    expect(transfer.hours).toBeGreaterThan(0)
    expect(['car', 'train', 'plane']).toContain(transfer.mode)
  })

  it('возвращает варианты с монотонными датами и полной суммой ночей', () => {
    const variants = optimizeTrip(input())
    expect(variants.length).toBeGreaterThanOrEqual(3)
    for (const variant of variants) {
      expect(variant.stays.reduce((sum, stay) => sum + stay.nights, 0)).toBe(8)
      expect(variant.total).toBeGreaterThan(0)
      expect(variant.perPerson).toBeGreaterThan(0)
      for (let index = 1; index < variant.stays.length; index += 1) {
        const current = variant.stays[index]
        const previous = variant.stays[index - 1]
        if (!current || !previous) continue
        expect(current.checkIn >= previous.checkIn).toBe(true)
      }
    }
  })

  it('не дублирует одинаковые варианты', () => {
    const variants = optimizeTrip(input({ nights: 6, minNights: 2 }))
    expect(new Set(variants.map((variant) => variant.id)).size).toBe(variants.length)
  })

  it('не строит вариант из одного курорта или слишком короткой поездки', () => {
    expect(optimizeTrip(input({ resortIds: ['krasnaya-polyana'] }))).toEqual([])
    expect(optimizeTrip(input({ nights: 3, minNights: 2 }))).toEqual([])
  })

  it('поддерживает 4 курорта и профиль комфорта', () => {
    const variants = optimizeTrip(
      input({
        resortIds: ['krasnaya-polyana', 'rosa-khutor', 'arkhyz', 'dombay'],
        nights: 10,
        profile: 'premium',
      }),
    )
    expect(variants.length).toBeGreaterThan(0)
    expect(variants.every((variant) => variant.stays.length === 4)).toBe(true)
  })
})
