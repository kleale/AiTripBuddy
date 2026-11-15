import { describe, expect, it } from 'vitest'
import {
  baseTypes,
  beginnerSetup,
  boardShapes,
  bindingSetupGuide,
  camberTypes,
  constructionParts,
  setupSteps,
  sidecutInfo,
  waxTypes,
  woodTypes,
} from '@/data/board-info'

describe('формы и геометрия доски', () => {
  it('есть Twin, Directional Twin, Directional и другие формы', () => {
    const ids = boardShapes.map((shape) => shape.id)
    expect(ids).toEqual(expect.arrayContaining(['twin', 'directional-twin', 'directional', 'tapered']))
    expect(boardShapes.length).toBeGreaterThanOrEqual(6)
  })

  it('есть все основные варианты прогибов', () => {
    const ids = camberTypes.map((item) => item.id)
    expect(ids).toEqual(expect.arrayContaining(['camber', 'rocker', 'flat', 'hybrid', 'crc', 'directional', '3bt', 'spoon', 'pow']))
    expect(camberTypes.length).toBeGreaterThanOrEqual(9)
  })

  it('радиус выреза объясняет короткие, средние и длинные дуги', () => {
    expect(sidecutInfo.length).toBeGreaterThanOrEqual(4)
    expect(sidecutInfo.some((item) => item.title.includes('Короткий'))).toBe(true)
    expect(sidecutInfo.some((item) => item.title.includes('Длинный'))).toBe(true)
  })
})

describe('материалы и конструкция', () => {
  it('описаны породы дерева', () => {
    expect(woodTypes.length).toBeGreaterThanOrEqual(5)
    expect(woodTypes.some((wood) => wood.name.includes('Павловния'))).toBe(true)
  })

  it('есть стрингеры, карбон, оплётка, боковины, закладные и мини-диск', () => {
    const titles = constructionParts.map((part) => part.title.toLowerCase())
    for (const word of ['стрингеры', 'карбон', 'оплётка', 'боковины', 'закладные', 'мини-диск']) {
      expect(titles.some((title) => title.includes(word))).toBe(true)
    }
  })

  it('скользяки и парафин описаны', () => {
    expect(baseTypes).toHaveLength(2)
    expect(waxTypes.length).toBeGreaterThanOrEqual(4)
  })
})

describe('настройка и новичок', () => {
  it('пошаговая настройка и хайбек', () => {
    expect(setupSteps.length).toBeGreaterThanOrEqual(6)
    expect(bindingSetupGuide.some((item) => item.title === 'Хайбек')).toBe(true)
  })

  it('рекомендация новичка сходится по процентам', () => {
    const mix = beginnerSetup.mix
    const style = beginnerSetup.style
    expect(mix.trail + mix.freeride + mix.park).toBe(100)
    expect(style.carving + style.freestyle + style.freeride + style.flat).toBe(100)
    expect(beginnerSetup.stance.forwardLean).toBeGreaterThanOrEqual(0)
    expect(beginnerSetup.stance.forwardLean).toBeLessThanOrEqual(6)
  })
})
