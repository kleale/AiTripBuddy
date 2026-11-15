import { describe, expect, it } from 'vitest'
import {
  applicableChecklist,
  avalancheKitReady,
  brandCategories,
  brandTierLabels,
  brandsByTier,
  brandsFor,
  budgetSections,
  checklistGroups,
  checklistProgress,
  needsAvalancheKit,
} from '@/data/gear'

const baseMix = { trail: 60, freeride: 0, park: 0 }

describe('чек-лист', () => {
  it('базовый набор есть всегда', () => {
    const groups = applicableChecklist(baseMix, 'own')
    const base = groups.find((group) => group.id === 'base')
    expect(base?.items.length).toBe(9)
    expect(base?.items.some((item) => item.id === 'helmet')).toBe(true)
  })

  it('фрирайд и парк появляются только по стилю', () => {
    const noFree = applicableChecklist(baseMix, 'own')
    expect(noFree.some((group) => group.id === 'freeride')).toBe(false)
    expect(noFree.some((group) => group.id === 'park')).toBe(false)

    const withFree = applicableChecklist({ trail: 40, freeride: 40, park: 20 }, 'own')
    expect(withFree.some((group) => group.id === 'freeride')).toBe(true)
    expect(withFree.some((group) => group.id === 'park')).toBe(true)
  })

  it('группа проката зависит от владения снаряжением', () => {
    expect(applicableChecklist(baseMix, 'own').some((group) => group.id === 'rent')).toBe(false)
    expect(applicableChecklist(baseMix, 'rent').some((group) => group.id === 'rent')).toBe(true)
    expect(applicableChecklist(baseMix, 'mix').some((group) => group.id === 'rent')).toBe(true)
  })

  it('прогресс считает только применимые пункты', () => {
    const mix = { trail: 40, freeride: 40, park: 20 }
    const progress = checklistProgress({ mix, ownership: 'own', checklist: { helmet: true, beacon: true } })
    expect(progress.done).toBe(2)
    expect(progress.total).toBe(28)
    expect(progress.percent).toBe(7)
  })

  it('доп. снаряжение не входит в шкалу', () => {
    const mix = { trail: 60, freeride: 20, park: 20 }
    const base = checklistProgress({ mix, ownership: 'mix', checklist: {} })
    const withExtra = checklistProgress({ mix, ownership: 'mix', checklist: { headlamp: true, thermos: true } })
    expect(withExtra.total).toBe(base.total)
    expect(withExtra.done).toBe(base.done)
  })

  it('лавинный набор обязателен для фрирайда', () => {
    expect(needsAvalancheKit({ trail: 100, freeride: 0, park: 0 })).toBe(false)
    expect(needsAvalancheKit({ trail: 60, freeride: 40, park: 0 })).toBe(true)
    expect(avalancheKitReady({ beacon: true, probe: true, shovel: true })).toBe(true)
    expect(avalancheKitReady({ beacon: true, probe: true })).toBe(false)
  })

  it('у каждого пункта уникальный id', () => {
    const ids = checklistGroups.flatMap((group) => group.items.map((item) => item.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('бренды', () => {
  it('в каждой категории есть бренды с ценой и запросом', () => {
    for (const category of brandCategories) {
      const list = brandsFor(category.id)
      expect(list.length).toBeGreaterThanOrEqual(5)
      for (const brand of list) {
        expect(brand.price.length).toBeGreaterThan(0)
        expect(brand.query.length).toBeGreaterThan(0)
      }
    }
  })

  it('ботинки и крепления расширены', () => {
    expect(brandsFor('boots').length).toBeGreaterThanOrEqual(18)
    expect(brandsFor('bindings').length).toBeGreaterThanOrEqual(18)
    for (const tier of ['budget', 'mid', 'top'] as const) {
      expect(brandsByTier('boots').some((group) => group.tier === tier)).toBe(true)
      expect(brandsByTier('clothing').some((group) => group.tier === tier)).toBe(true)
    }
    expect(brandTierLabels.top).toBe('Топ')
  })

  it('есть сноуборды и лыжи популярных марок', () => {
    const boards = brandsFor('snowboard').map((brand) => brand.name)
    const skis = brandsFor('ski').map((brand) => brand.name)
    expect(boards).toEqual(expect.arrayContaining(['Burton', 'Jones', 'Lib Tech']))
    expect(skis).toEqual(expect.arrayContaining(['Atomic', 'Rossignol', 'Blizzard']))
  })
})

describe('бюджет РФ', () => {
  it('четыре раздела: аренда, доска, лыжи, одежда', () => {
    expect(budgetSections.map((section) => section.id)).toEqual(['rent', 'buy-board', 'buy-ski', 'clothing'])
  })

  it('в каждом разделе три уровня с итогом', () => {
    for (const section of budgetSections) {
      expect(section.tiers).toHaveLength(3)
      for (const tier of section.tiers) {
        expect(tier.items.length).toBeGreaterThan(0)
        expect(tier.total).toContain('₽')
      }
    }
  })
})
