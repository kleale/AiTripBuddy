import type { Currency } from '@/types'
import { convertGuideAmount } from '@/lib/currency'
import type { HotelOffer } from '@/data/hotels'

export interface HotelFilters {
  maxDistanceKm: number | null
  maxPrice: number | null
  minStars: number
  guests: number
  skiInOnly: boolean
}

export const defaultHotelFilters: HotelFilters = {
  maxDistanceKm: null,
  maxPrice: null,
  minStars: 0,
  guests: 1,
  skiInOnly: false,
}

/** Цена за номер на выбранную дату: базовая цена × сезонный ориентир. */
export function hotelNightly(
  offer: HotelOffer,
  currency: Currency,
  seasonFactor = 1,
): number {
  const base = convertGuideAmount(offer.priceFrom, offer.currency, currency)
  return Math.max(0, Math.round(base * (seasonFactor || 1)))
}

export function hotelStayTotal(
  offer: HotelOffer,
  currency: Currency,
  nights: number,
  rooms: number,
  seasonFactor = 1,
): number {
  return hotelNightly(offer, currency, seasonFactor) * Math.max(0, nights) * Math.max(1, rooms)
}

export function hotelPerPerson(
  offer: HotelOffer,
  currency: Currency,
  nights: number,
  rooms: number,
  pax: number,
  seasonFactor = 1,
): number {
  const total = hotelStayTotal(offer, currency, nights, rooms, seasonFactor)
  return Math.round(total / Math.max(1, pax))
}

export function isSkiIn(offer: HotelOffer): boolean {
  return offer.liftKm <= 0.4
}

export function filterHotelOffers(
  offers: HotelOffer[],
  filters: HotelFilters,
  currency: Currency,
  seasonFactor = 1,
): HotelOffer[] {
  return offers
    .filter((offer) => {
      if (filters.maxDistanceKm !== null && offer.liftKm > filters.maxDistanceKm) return false
      if (filters.minStars > 0 && offer.stars < filters.minStars) return false
      if (filters.guests > offer.maxGuests) return false
      if (filters.skiInOnly && !isSkiIn(offer)) return false
      if (filters.maxPrice !== null && hotelNightly(offer, currency, seasonFactor) > filters.maxPrice) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.liftKm !== b.liftKm) return a.liftKm - b.liftKm
      return b.rating - a.rating
    })
}

/** Подпись расстояния: пешком до нижней станции. */
export function liftWalkLabel(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return 'у подъёмника'
  if (km <= 0.4) return 'ski-in/ski-out'
  const minutes = Math.max(1, Math.round((km / 4.5) * 60))
  return `${minutes} мин пешком`
}
