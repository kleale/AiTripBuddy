import { describe, expect, it } from 'vitest'
import {
  defaultTransport,
  isTransportMode,
  transportById,
  transportColor,
  transportFor,
  transportModes,
} from '@/lib/transport'

describe('виды транспорта', () => {
  it('шесть типов, у каждого свой цвет', () => {
    expect(transportModes.map((mode) => mode.id)).toEqual(['plane', 'train', 'bus', 'taxi', 'car', 'ferry'])
    expect(new Set(transportModes.map((mode) => mode.color)).size).toBe(6)
  })

  it('распознаёт только известные типы', () => {
    expect(isTransportMode('train')).toBe(true)
    expect(isTransportMode('ferry')).toBe(true)
    expect(isTransportMode('rocket')).toBe(false)
    expect(isTransportMode(null)).toBe(false)
    expect(isTransportMode(1)).toBe(false)
  })

  it('тип по умолчанию зависит от участка', () => {
    expect(defaultTransport('flight')).toBe('plane')
    expect(defaultTransport('transfer')).toBe('bus')
    expect(defaultTransport('move')).toBe('car')
  })

  it('явный транспорт важнее типа участка', () => {
    expect(transportFor({ kind: 'transfer', transport: 'train' }).label).toBe('Поезд')
    expect(transportFor({ kind: 'flight', transport: 'plane' }).label).toBe('Самолёт')
    expect(transportFor({ kind: 'flight' }).id).toBe('plane')
    expect(transportFor({ kind: 'move' }).id).toBe('car')
  })

  it('неизвестный транспорт откатывается к типу участка', () => {
    expect(transportFor({ kind: 'transfer', transport: 'plane' as never }).id).toBe('plane')
    expect(transportFor({ kind: 'transfer' }).id).toBe('bus')
  })

  it('цвет берётся из транспорта', () => {
    expect(transportColor({ kind: 'transfer', transport: 'ferry' })).toBe(transportById.ferry.color)
    expect(transportColor({ kind: 'move' })).toBe(transportById.car.color)
  })

  it('парому и поезду задан пунктир, машине — нет', () => {
    expect(transportById.ferry.dash).toBeTruthy()
    expect(transportById.train.dash).toBeTruthy()
    expect(transportById.car.dash).toBeUndefined()
  })
})
