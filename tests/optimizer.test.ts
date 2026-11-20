import { describe, expect, it } from 'vitest'
import { findResort } from '@/data/resorts'
import { defaultOptimizerInput, buildTransferMatrix, normalizeOptimizerInput, optimizeTrip, transferBetween, transferKey } from '@/lib/optimizer'

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

  it('supports 4 resorts and premium profile', () => {
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

  it('normalizes input and clamps constraints', () => {
    const normalized = normalizeOptimizerInput({
      resortIds: ['krasnaya-polyana', 'krasnaya-polyana', 'bad-id', 'rosa-khutor'],
      nights: 99,
      pax: 0,
      rooms: 0,
      minNights: 0,
      maxTransferHours: 0,
      profile: 'balanced',
      currency: 'RUB',
    })
    expect(normalized.resortIds).toEqual(['krasnaya-polyana', 'rosa-khutor'])
    expect(normalized.nights).toBe(30)
    expect(normalized.pax).toBe(1)
    expect(normalized.rooms).toBe(1)
    expect(normalized.minNights).toBe(2)
    expect(normalized.version).toBe(1)
  })

  it('builds a transfer matrix once for all pairs', () => {
    const matrix = buildTransferMatrix(['krasnaya-polyana', 'rosa-khutor', 'arkhyz'], 2, 'RUB')
    expect(matrix.size).toBe(6)
    expect(matrix.get(transferKey('krasnaya-polyana', 'rosa-khutor'))?.price).toBeGreaterThan(0)
  })

  it('adds explanations and confidence to each variant', () => {
    const variants = optimizeTrip(input())
    expect(variants.length).toBeGreaterThan(0)
    for (const variant of variants) {
      expect(variant.explanations.length).toBeGreaterThanOrEqual(3)
      expect(['low', 'medium', 'high']).toContain(variant.confidence)
    }
  })

  it('meets the perf budget for four resorts', () => {
    const started = performance.now()
    const variants = optimizeTrip(
      input({
        resortIds: ['krasnaya-polyana', 'rosa-khutor', 'arkhyz', 'dombay'],
        nights: 10,
        maxVariants: 2000,
      }),
    )
    expect(variants.length).toBeGreaterThan(0)
    expect(performance.now() - started).toBeLessThan(3000)
  })

  it('keeps invariants across generated variants', () => {
    for (const nights of [6, 7, 8, 9, 10]) {
      for (const variant of optimizeTrip(input({ nights }))) {
        expect(variant.stays.reduce((sum, stay) => sum + stay.nights, 0)).toBe(nights)
        expect(variant.total).toBeGreaterThan(0)
        expect(variant.confidence === 'low').toBe(false)
        expect(variant.warnings.every((warning) => typeof warning === 'string')).toBe(true)
      }
    }
  })
})
