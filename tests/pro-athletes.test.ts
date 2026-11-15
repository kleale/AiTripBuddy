import { describe, expect, it } from 'vitest'
import { proAthletes, proAthletesFor } from '@/data/pro-athletes'

describe('профили райдеров', () => {
  it('до 20 человек и оба вида спорта', () => {
    expect(proAthletes.length).toBe(20)
    expect(proAthletesFor('snowboard').length).toBeGreaterThanOrEqual(10)
    expect(proAthletesFor('ski').length).toBeGreaterThanOrEqual(10)
  })

  it('у каждого заполнены стиль, параметры и снаряжение', () => {
    for (const athlete of proAthletes) {
      expect(athlete.name.length).toBeGreaterThan(0)
      expect(athlete.style.length).toBeGreaterThan(0)
      expect(athlete.heightCm).toBeGreaterThan(140)
      expect(athlete.weightKg).toBeGreaterThan(40)
      expect(athlete.boardBrand.length).toBeGreaterThan(0)
      expect(athlete.boardModel.length).toBeGreaterThan(0)
      expect(athlete.camber.length).toBeGreaterThan(0)
      expect(athlete.flex.length).toBeGreaterThan(0)
      expect(athlete.boots.length).toBeGreaterThan(0)
      expect(athlete.bindings.length).toBeGreaterThan(0)
      expect(athlete.search.length).toBeGreaterThan(0)
    }
  })

  it('id уникальны', () => {
    expect(new Set(proAthletes.map((athlete) => athlete.id)).size).toBe(proAthletes.length)
  })

  it('фильтр по спорту работает', () => {
    expect(proAthletesFor('snowboard').every((athlete) => athlete.sport === 'snowboard')).toBe(true)
    expect(proAthletesFor('ski').every((athlete) => athlete.sport === 'ski')).toBe(true)
    expect(proAthletesFor('all')).toHaveLength(20)
  })
})
