import { describe, expect, it } from 'vitest'
import { hotelCatalog, hotelsFor, hotelOfferCoords } from '@/data/hotels'
import { findResort } from '@/data/resorts'
import { guideFor } from '@/data/resort-guides'
import {
  defaultHotelFilters,
  filterHotelOffers,
  hotelNightly,
  hotelPerPerson,
  hotelStayTotal,
  isSkiIn,
  liftWalkLabel,
} from '@/lib/hotel-search'

describe('каталог отелей', () => {
  it('у каждого отеля существует курорт и часть гида', () => {
    const broken = hotelCatalog.filter((offer) => {
      const resort = findResort(offer.resortId)
      const guide = guideFor(offer.resortId)
      return !resort || !guide?.zones.some((zone) => zone.id === offer.zoneId)
    })
    expect(broken.map((offer) => offer.id)).toEqual([])
  })

  it('нет дублей идентификаторов', () => {
    const ids = hotelCatalog.map((offer) => offer.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('координаты отеля строятся от нижней станции', () => {
    const offer = hotelsFor('hakuba')[0]
    const coords = hotelOfferCoords(offer)
    expect(coords?.lat).toBeTypeOf('number')
    expect(coords?.lng).toBeTypeOf('number')
  })
})

describe('подбор отеля', () => {
  const offers = hotelsFor('hakuba')

  it('фильтрует по расстоянию и звёздам', () => {
    const result = filterHotelOffers(
      offers,
      { ...defaultHotelFilters, maxDistanceKm: 0.5, minStars: 3 },
      'RUB',
      1,
    )
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((offer) => offer.liftKm <= 0.5 && offer.stars >= 3)).toBe(true)
  })

  it('фильтрует по цене в валюте поездки', () => {
    const result = filterHotelOffers(
      offers,
      { ...defaultHotelFilters, maxPrice: 12000 },
      'RUB',
      1,
    )
    expect(result.every((offer) => hotelNightly(offer, 'RUB', 1) <= 12000)).toBe(true)
  })

  it('считает итог и цену на человека', () => {
    const offer = offers[0]
    const nightly = hotelNightly(offer, 'RUB', 1.15)
    const total = hotelStayTotal(offer, 'RUB', 5, 2, 1.15)
    expect(total).toBe(nightly * 10)
    expect(hotelPerPerson(offer, 'RUB', 5, 2, 4, 1.15)).toBe(Math.round(total / 4))
  })

  it('ski-in начинается с расстояния до 400 м', () => {
    expect(isSkiIn({ ...offers[0], liftKm: 0.3 })).toBe(true)
    expect(isSkiIn({ ...offers[0], liftKm: 0.8 })).toBe(false)
    expect(liftWalkLabel(0.3)).toBe('ski-in/ski-out')
  })
})
