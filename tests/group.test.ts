import { describe, expect, it } from 'vitest'
import type { Trip } from '@/types'
import { groupSeats, makeJoinCode, setGroupCapacity } from '@/lib/group'

function trip(): Trip {
  return {
    id: 't1',
    name: 'Группа',
    pax: 4,
    currency: 'RUB',
    budget: null,
    returnFlight: 0,
    returnHours: 0,
    stops: [],
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('группа без платежей', () => {
  it('свободные места = вместимость − участники', () => {
    const value = trip()
    setGroupCapacity(value, 8)
    expect(groupSeats(value)).toMatchObject({ capacity: 8, taken: 4, free: 4 })
  })

  it('вместимость не меньше 1 и не больше 30', () => {
    const value = trip()
    setGroupCapacity(value, 0)
    expect(groupSeats(value).capacity).toBe(1)
    setGroupCapacity(value, 99)
    expect(groupSeats(value).capacity).toBe(30)
  })

  it('код приглашения создаётся один раз', () => {
    const value = trip()
    setGroupCapacity(value, 6)
    const code = value.group?.joinCode
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
    setGroupCapacity(value, 7)
    expect(value.group?.joinCode).toBe(code)
  })

  it('makeJoinCode даёт 6 символов', () => {
    expect(makeJoinCode()).toMatch(/^[A-Z0-9]{6}$/)
  })
})
