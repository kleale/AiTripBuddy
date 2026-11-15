import { describe, expect, it } from 'vitest'
import {
  flexAdvice,
  flexScore,
  googleSearchUrl,
  normalizeMix,
  skiRange,
  skiWaist,
  snowboardRange,
} from '@/lib/gear-fit'

describe('проценты стиля катания', () => {
  it('приводит сумму к 100', () => {
    const mix = normalizeMix({ trail: 50, freeride: 30, park: 20 })
    expect(mix).toEqual({ trail: 50, freeride: 30, park: 20 })
  })

  it('делит произвольные числа поровну', () => {
    const mix = normalizeMix({ trail: 10, freeride: 10, park: 10 })
    expect(mix.trail + mix.freeride + mix.park).toBe(100)
    expect(mix.trail).toBe(33)
    expect(mix.freeride).toBe(33)
    expect(mix.park).toBe(34)
  })

  it('нулевой набор заменяет базовым', () => {
    expect(normalizeMix({ trail: 0, freeride: 0, park: 0 })).toEqual({ trail: 60, freeride: 20, park: 20 })
    expect(normalizeMix(null)).toEqual({ trail: 60, freeride: 20, park: 20 })
  })
})

describe('подбор длины', () => {
  const mix = normalizeMix({ trail: 60, freeride: 20, park: 20 })

  it('сноуборд: рост 175, вес 75 — около 155 см', () => {
    const range = snowboardRange(175, 75, mix, 'intermediate')
    expect(range.center).toBe(154)
    expect(range.min).toBe(151)
    expect(range.max).toBe(157)
  })

  it('фрирайд длиннее парка', () => {
    const freeride = snowboardRange(175, 75, normalizeMix({ trail: 20, freeride: 60, park: 20 }), 'intermediate')
    const park = snowboardRange(175, 75, normalizeMix({ trail: 20, freeride: 20, park: 60 }), 'intermediate')
    expect(freeride.center).toBeGreaterThan(park.center)
  })

  it('тяжёлый райдер получает длиннее', () => {
    expect(snowboardRange(175, 95, mix, 'intermediate').center).toBeGreaterThan(
      snowboardRange(175, 65, mix, 'intermediate').center,
    )
  })

  it('лыжи: рост минус 10 см с диапазоном', () => {
    const range = skiRange(175, 75, mix, 'intermediate')
    expect(range.center).toBe(165)
    expect(range.min).toBe(160)
    expect(range.max).toBe(170)
  })

  it('лыжи для фрирайда длиннее, для парка короче', () => {
    const freeride = skiRange(175, 75, normalizeMix({ trail: 20, freeride: 60, park: 20 }), 'intermediate')
    const park = skiRange(175, 75, normalizeMix({ trail: 20, freeride: 20, park: 60 }), 'intermediate')
    expect(freeride.center).toBeGreaterThan(park.center)
  })

  it('ширина талии зависит от стиля', () => {
    expect(skiWaist({ trail: 20, freeride: 60, park: 20 }).min).toBe(100)
    expect(skiWaist({ trail: 20, freeride: 20, park: 60 }).min).toBe(84)
    expect(skiWaist({ trail: 80, freeride: 10, park: 10 }).min).toBe(78)
  })

  it('диапазон не выходит за разумные границы', () => {
    const tiny = snowboardRange(130, 40, mix, 'beginner')
    const huge = skiRange(210, 120, mix, 'expert')
    expect(tiny.min).toBeGreaterThanOrEqual(125)
    expect(huge.max).toBeLessThanOrEqual(195)
  })
})

describe('жёсткость и примеры', () => {
  const beginner = normalizeMix({ trail: 60, freeride: 20, park: 20 })
  const expertFree = normalizeMix({ trail: 20, freeride: 60, park: 20 })

  it('новичок — мягко, эксперт-фрирайдер — жёстко', () => {
    expect(flexScore(70, beginner, 'beginner')).toBeLessThanOrEqual(3)
    expect(flexScore(85, expertFree, 'expert')).toBeGreaterThanOrEqual(7)
  })

  it('сноуборд: ботинки и крепления под жёсткость', () => {
    const soft = flexAdvice('snowboard', 'beginner', beginner, 70)
    const stiff = flexAdvice('snowboard', 'expert', expertFree, 85)
    expect(soft.label).toBe('мягкая')
    expect(soft.boots.some((item) => item.label.includes('Moto'))).toBe(true)
    expect(stiff.label).toBe('жёсткая')
    expect(stiff.bindings.some((item) => item.label.includes('Atlas'))).toBe(true)
    expect(soft.boots).toHaveLength(7)
    expect(soft.bindings).toHaveLength(7)
    expect(stiff.boots).toHaveLength(7)
    expect(stiff.bindings).toHaveLength(7)
  })

  it('лыжи: гибкость ботинок в числовом диапазоне', () => {
    const advice = flexAdvice('ski', 'expert', expertFree, 85)
    expect(advice.bootFlex).toBe('110–130')
    expect(advice.boots).toHaveLength(7)
    expect(advice.bindings).toHaveLength(7)
  })

  it('ссылка на Google экранирует запрос', () => {
    const url = googleSearchUrl('Burton Custom 158')
    expect(url.startsWith('https://www.google.com/search?q=')).toBe(true)
    expect(url).toContain('Burton%20Custom%20158')
  })
})
