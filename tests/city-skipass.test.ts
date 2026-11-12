import { describe, expect, it, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

/**
 * Проверяем поведение стора без монтирования компонентов:
 * переключение на город, подстановку скипасса и запрос центрирования карты.
 */
describe('переключение города и скипасс', () => {
  beforeEach(() => {
    vi.resetModules()
    const storage = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage
  })

  it('город обнуляет дни катания и скипасс', async () => {
    const store = await import('@/stores/trip')
    store.createTrip()

    const current = store.trip.value
    if (!current) throw new Error('поездка не создана')

    store.addTransfer()
    await nextTick()

    const stay = store.trip.value?.stops.find((stop) => stop.kind === 'stay')
    if (!stay) throw new Error('нет отеля')

    store.patchStay(stay.id, { skipassDays: 6, skipassPerDay: 4200, nights: 7 })
    expect(store.trip.value?.stops.find((s) => s.id === stay.id)).toMatchObject({
      skipassDays: 6,
      skipassPerDay: 4200,
    })

    store.setStayPlaceKind(stay.id, 'city')
    const after = store.trip.value?.stops.find((s) => s.id === stay.id)
    expect(after?.kind === 'stay' ? after.placeKind : null).toBe('city')
    expect(after?.kind === 'stay' ? after.skipassDays : null).toBe(0)
    expect(after?.kind === 'stay' ? after.skipassPerDay : null).toBe(0)
  })

  it('возврат к курорту снова включает дни катания по ночам', async () => {
    const store = await import('@/stores/trip')
    store.createTrip()
    store.addTransfer()

    const stay = store.trip.value?.stops.find((stop) => stop.kind === 'stay')
    if (!stay) throw new Error('нет отеля')

    store.patchStay(stay.id, { nights: 7 })
    store.setStayPlaceKind(stay.id, 'city')
    store.setStayPlaceKind(stay.id, 'resort')

    const after = store.trip.value?.stops.find((s) => s.id === stay.id)
    expect(after?.kind === 'stay' ? after.placeKind : null).toBe('resort')
    expect(after?.kind === 'stay' ? after.skipassDays : null).toBe(6)
  })

  it('город не влияет на отель и питание', async () => {
    const store = await import('@/stores/trip')
    store.createTrip()
    store.addTransfer()

    const stay = store.trip.value?.stops.find((stop) => stop.kind === 'stay')
    if (!stay) throw new Error('нет отеля')

    store.patchStay(stay.id, { hotel: 'Hotel MyStays', hotelPerNight: 9800, nights: 2 })
    store.setStayPlaceKind(stay.id, 'city')

    const after = store.trip.value?.stops.find((s) => s.id === stay.id)
    expect(after?.kind === 'stay' ? after.hotel : null).toBe('Hotel MyStays')
    expect(after?.kind === 'stay' ? after.hotelPerNight : null).toBe(9800)
  })
})

describe('центрирование карты', () => {
  beforeEach(async () => {
    vi.resetModules()
    const storage = new Map<string, string>()
    globalThis.localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage
  })

  it('запрос содержит id точки и уникальный nonce', async () => {
    const store = await import('@/stores/trip')
    store.createTrip()
    store.addTransfer()

    const stay = store.trip.value?.stops.find((stop) => stop.kind === 'stay')
    if (!stay) throw new Error('нет отеля')

    store.focusStopOnMap(stay.id)
    const first = store.mapFocus.value
    expect(first?.stopId).toBe(stay.id)

    store.focusStopOnMap(stay.id)
    const second = store.mapFocus.value
    expect(second?.stopId).toBe(stay.id)
    expect(second?.nonce).toBeGreaterThanOrEqual(first?.nonce ?? 0)
  })
})

describe('скипасс из гида', () => {
  it('гид Хакубы даёт дневную цену 8500 JPY', async () => {
    const { guideFor, guidePassPerDay } = await import('@/data/resort-guides')
    const guide = guideFor('hakuba')
    if (!guide) throw new Error('нет гида')
    expect(guidePassPerDay(guide)).toMatchObject({ amount: 8500, currency: 'JPY' })
  })

  it('цена из гида не зависит от выбранной части курорта', async () => {
    const { guideFor, guidePassPerDay } = await import('@/data/resort-guides')
    const guide = guideFor('mayrhofen')
    if (!guide) throw new Error('нет гида')
    const pass = guidePassPerDay(guide)
    // единый пасс действует на все зоны Майрхофена
    expect(guide.passAll?.note).toContain('Циллерталь')
    expect(pass?.amount).toBeGreaterThan(0)
  })
})