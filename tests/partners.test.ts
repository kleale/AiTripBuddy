import { describe, expect, it } from 'vitest'
import { partnerRegions, partnersFor } from '@/data/partners'

describe('партнёрские предложения', () => {
  it('у каждого региона есть партнёры с https-ссылками', () => {
    for (const region of partnerRegions) {
      const offers = partnersFor(region.id)
      expect(offers.length).toBeGreaterThanOrEqual(3)
      expect(offers.every((offer) => offer.url.startsWith('https://'))).toBe(true)
      expect(offers.every((offer) => offer.note.length > 0)).toBe(true)
    }
  })

  it('в РФ есть Ozon, Яндекс и Спортмастер', () => {
    const names = partnersFor('RU').map((offer) => offer.name)
    expect(names).toEqual(expect.arrayContaining(['Ozon Travel', 'Яндекс Путешествия', 'Спортмастер']))
  })

  it('в ЕС и США есть Booking/REI/evo', () => {
    expect(partnersFor('EU').some((offer) => offer.name === 'Booking')).toBe(true)
    expect(partnersFor('US').map((offer) => offer.name)).toEqual(expect.arrayContaining(['REI', 'evo']))
  })
})
