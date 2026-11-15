import { beforeEach, describe, expect, it } from 'vitest'
import {
  disablePrep,
  enablePrep,
  patchPrep,
  resetPrepChecklist,
  togglePrepItem,
  trip,
} from '@/stores/trip'
import { defaultPrep, normalizePrep } from '@/lib/prep'
import type { Trip } from '@/types'

function makeTrip(): Trip {
  return {
    id: 't1',
    name: 'Тест',
    pax: 2,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [
      { id: 'o1', kind: 'origin', cityId: 'moscow-svo', city: 'Москва', code: 'SVO', lat: 55.97, lng: 37.41 },
    ],
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('нормализация подготовки', () => {
  it('по умолчанию сумма стилей 100', () => {
    const prep = defaultPrep()
    expect(prep.mix.trail + prep.mix.freeride + prep.mix.park).toBe(100)
    expect(prep.enabled).toBe(true)
  })

  it('стиль и стойка есть по умолчанию', () => {
    const prep = defaultPrep()
    expect(prep.style.carving + prep.style.freestyle + prep.style.freeride + prep.style.flat).toBe(100)
    expect(prep.stance.widthCm).toBe(52)
    expect(prep.stance.frontAngle).toBe(15)
    expect(prep.stance.forwardLean).toBe(3)
  })

  it('старое сохранение без подготовки остаётся без неё', () => {
    expect(normalizePrep(undefined)).toBeUndefined()
  })

  it('ограничивает рост, вес и размер ботинок', () => {
    const prep = normalizePrep({
      ...defaultPrep(),
      heightCm: 90,
      weightKg: 300,
      bootSize: 60,
      stance: { ...defaultPrep().stance, forwardLean: 9 },
      level: 'super',
      equipment: 'sled',
      ownership: 'steal',
    })
    expect(prep?.heightCm).toBe(120)
    expect(prep?.weightKg).toBe(160)
    expect(prep?.bootSize).toBe(50)
    expect(prep?.level).toBe('beginner')
    expect(prep?.equipment).toBe('undecided')
    expect(prep?.ownership).toBe('mix')
    expect(prep?.style.carving + prep?.style.freestyle + prep?.style.freeride + prep?.style.flat).toBe(100)
    expect(prep?.stance.widthCm).toBe(52)
    expect(prep?.stance.forwardLean).toBe(6)
  })

  it('оставляет только выполненные пункты чек-листа', () => {
    const prep = normalizePrep({
      ...defaultPrep(),
      checklist: { helmet: true, gloves: false, beacon: true, junk: 'yes' },
    })
    expect(prep?.checklist).toEqual({ helmet: true, beacon: true })
  })
})

describe('подготовка в поездке', () => {
  beforeEach(() => {
    trip.value = makeTrip()
  })

  it('включается и выключается', () => {
    enablePrep()
    expect(trip.value?.prep?.enabled).toBe(true)
    disablePrep()
    expect(trip.value?.prep?.enabled).toBe(false)
    expect(trip.value?.prep?.mix.trail).toBe(60)
    expect(trip.value?.prep?.style.carving).toBe(40)
  })

  it('патч нормализует стиль и параметры', () => {
    enablePrep()
    patchPrep({
      mix: { trail: 20, freeride: 20, park: 60 },
      heightCm: 182,
      weightKg: 88,
    })
    const prep = trip.value?.prep
    expect(prep?.mix).toEqual({ trail: 20, freeride: 20, park: 60 })
    expect(prep?.heightCm).toBe(182)
    expect(prep?.weightKg).toBe(88)
  })

  it('пункты чек-листа переключаются и сбрасываются', () => {
    enablePrep()
    togglePrepItem('helmet')
    expect(trip.value?.prep?.checklist.helmet).toBe(true)
    togglePrepItem('helmet')
    expect(trip.value?.prep?.checklist.helmet).toBeUndefined()
    togglePrepItem('beacon')
    resetPrepChecklist()
    expect(trip.value?.prep?.checklist).toEqual({})
  })
})
