import { describe, expect, it } from 'vitest'
import { activityKindLabels, activityMapUrl, activitySearchLinks } from '@/lib/activity-links'
import { activityIdeas, activityIdeasFor } from '@/data/activity-ideas'
import { findResort } from '@/data/resorts'

describe('ссылки мероприятий', () => {
  it('строит партнёрские ссылки с UTM и пометкой sponsored', () => {
    const links = activitySearchLinks('Спа', 'Роза Хутор', 'Россия')
    expect(links.map((link) => link.label)).toEqual([
      'Trip.com',
      'Viator',
      'GetYourGuide',
      'Klook',
      'Ozon',
      'Яндекс',
    ])
    expect(links.every((link) => link.href.startsWith('https://'))).toBe(true)
    expect(links.every((link) => link.href.includes('utm_source=aitripbuddy'))).toBe(true)
    expect(links.every((link) => link.partner)).toBe(true)
  })

  it('без запроса не строит ссылки', () => {
    expect(activitySearchLinks('', '')).toEqual([])
  })

  it('карта работает по координатам и по адресу', () => {
    expect(activityMapUrl({ title: 'Спа', lat: 43.5, lng: 40.2 })).toContain('pt=40.2,43.5')
    expect(activityMapUrl({ title: 'Спа', address: 'Роза Хутор' })).toContain('text=')
  })

  it('все типы мероприятий подписаны', () => {
    expect(Object.keys(activityKindLabels)).toEqual(['spa', 'excursion', 'concert', 'ride', 'custom'])
  })
})

describe('идеи мероприятий', () => {
  it('у каждой идеи есть курсорт и уникальный id', () => {
    const ids = activityIdeas.map((idea) => idea.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(activityIdeas.filter((idea) => !findResort(idea.resortId))).toEqual([])
  })

  it('цены не отрицательные и есть описание', () => {
    expect(activityIdeas.every((idea) => idea.priceFrom >= 0 && idea.description.length > 0)).toBe(true)
  })

  it('для Хакубы есть идеи', () => {
    expect(activityIdeasFor('hakuba').length).toBeGreaterThan(0)
  })
})
