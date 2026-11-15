import { describe, expect, it } from 'vitest'
import {
  bookingUrl,
  hotelButtons,
  hotelQueryLabel,
  hotelSourceLabel,
  isHotelSource,
  ozonUrl,
  tripUrl,
  yandexHotelsUrl,
  yandexPlaceSlug,
  type HotelQuery,
} from '@/lib/hotel-links'

const stay: HotelQuery = {
  hotel: 'Petit Hotel Anise Garden',
  place: 'Хакуба',
  country: 'Япония',
  checkIn: '2027-01-23',
  checkOut: '2027-02-02',
  adults: 2,
  rooms: 1,
  currency: 'RUB',
  lat: 36.7019,
  lng: 137.837,
}

function params(url: string): URLSearchParams {
  return new URL(url).searchParams
}

describe('Booking: место и даты', () => {
  it('передаёт отель, место, даты, гостей и валюту', () => {
    const url = bookingUrl(stay)
    expect(url).not.toBeNull()
    expect(url?.startsWith('https://www.booking.com/searchresults.ru.html?')).toBe(true)
    const q = params(url as string)
    expect(q.get('ss')).toContain('Petit Hotel Anise Garden')
    expect(q.get('ss')).toContain('Хакуба')
    expect(q.get('ss')).toContain('Япония')
    expect(q.get('checkin')).toBe('2027-01-23')
    expect(q.get('checkout')).toBe('2027-02-02')
    expect(q.get('group_adults')).toBe('2')
    expect(q.get('no_rooms')).toBe('1')
    expect(q.get('selected_currency')).toBe('RUB')
    expect(q.get('lang')).toBe('ru')
    expect(q.get('dest_id')).toBe('36.7019,137.837')
    expect(q.get('dest_type')).toBe('city')
  })

  it('без названия отеля ищет по курорту', () => {
    const q = params(bookingUrl({ ...stay, hotel: undefined }) as string)
    expect(q.get('ss')).toBe('Хакуба, Япония')
  })

  it('не строит ссылку без дат', () => {
    expect(bookingUrl({ ...stay, checkIn: '' })).toBeNull()
    expect(bookingUrl({ ...stay, checkOut: '' })).toBeNull()
  })
})

describe('Trip.com: название места и даты', () => {
  it('передаёт город, поисковую строку и даты', () => {
    const url = tripUrl(stay) as string
    const q = params(url)
    expect(url.startsWith('https://www.trip.com/hotels/list?')).toBe(true)
    expect(q.get('cityName')).toBe('Хакуба')
    expect(q.get('searchWord')).toContain('Petit Hotel Anise Garden')
    expect(q.get('searchType')).toBe('CT')
    expect(q.get('checkIn')).toBe('2027-01-23')
    expect(q.get('checkOut')).toBe('2027-02-02')
    expect(q.get('adult')).toBe('2')
    expect(q.get('crn')).toBe('1')
    expect(q.get('curr')).toBe('RUB')
  })

  it('не строит ссылку без места', () => {
    expect(tripUrl({ ...stay, place: '' })).toBeNull()
  })
})

describe('Ozon Travel: даты, гости и текст места', () => {
  it('передаёт даты и число гостей', () => {
    const url = ozonUrl(stay) as string
    const q = params(url)
    expect(url.startsWith('https://www.ozon.ru/travel/hotels/search-new?')).toBe(true)
    expect(q.get('checkIn')).toBe('2027-01-23')
    expect(q.get('checkOut')).toBe('2027-02-02')
    expect(q.get('Dlts')).toBe('2')
    expect(q.get('text')).toContain('Хакуба')
  })

  it('room count не ломает ссылку', () => {
    expect(ozonUrl({ ...stay, rooms: 3 })).toContain('Dlts=2')
  })

  it('не строит ссылку без дат', () => {
    expect(ozonUrl({ ...stay, checkIn: '23.01.2027' })).toBeNull()
  })
})

describe('Яндекс Путешествия: даты и место', () => {
  it('передаёт checkinDate/checkoutDate и взрослых', () => {
    const url = yandexHotelsUrl(stay) as string
    const q = params(url)
    expect(url.startsWith('https://travel.yandex.ru/hotels/hakuba/?')).toBe(true)
    expect(q.get('checkinDate')).toBe('2027-01-23')
    expect(q.get('checkoutDate')).toBe('2027-02-02')
    expect(q.get('adults')).toBe('2')
    expect(q.get('roomCount')).toBe('1')
  })

  it('не строит ссылку без места', () => {
    expect(yandexHotelsUrl({ ...stay, place: '  ' })).toBeNull()
  })
})

describe('кнопки отелей', () => {
  it('порядок: Booking, Trip.com, Ozon, Яндекс', () => {
    expect(hotelButtons(stay).map((b) => b.id)).toEqual(['booking', 'trip', 'ozon', 'yandex'])
  })

  it('все предзаполнены при наличии места и дат', () => {
    const buttons = hotelButtons(stay)
    expect(buttons.every((b) => b.prefilled)).toBe(true)
    expect(buttons.every((b) => b.url.startsWith('https://'))).toBe(true)
  })

  it('без запроса открывают обычный поиск', () => {
    const buttons = hotelButtons(null)
    expect(buttons).toHaveLength(4)
    expect(buttons.every((b) => !b.prefilled)).toBe(true)
    expect(buttons.find((b) => b.id === 'booking')?.url).toBe('https://www.booking.com/')
    expect(buttons.find((b) => b.id === 'yandex')?.url).toBe('https://travel.yandex.ru/hotels/')
  })

  it('подписи короткие', () => {
    expect(hotelButtons(null).map((b) => b.label)).toEqual(['Booking', 'Trip.com', 'Ozon', 'Яндекс'])
  })

  it('title объясняет состояние', () => {
    expect(hotelButtons(stay)[0]?.title).toContain('место и даты')
    expect(hotelButtons(null)[0]?.title).toContain('выберите место и даты')
  })
})

describe('источник цены', () => {
  it('распознаёт только известные сайты', () => {
    expect(isHotelSource('booking')).toBe(true)
    expect(isHotelSource('trip')).toBe(true)
    expect(isHotelSource('ozon')).toBe(true)
    expect(isHotelSource('yandex')).toBe(true)
    expect(isHotelSource('airbnb')).toBe(false)
    expect(isHotelSource('')).toBe(false)
    expect(isHotelSource(null)).toBe(false)
    expect(isHotelSource(42)).toBe(false)
  })

  it('подписи источников', () => {
    expect(hotelSourceLabel('booking')).toBe('Booking')
    expect(hotelSourceLabel('trip')).toBe('Trip.com')
    expect(hotelSourceLabel('ozon')).toBe('Ozon')
    expect(hotelSourceLabel('yandex')).toBe('Яндекс')
    expect(hotelSourceLabel(null)).toBe('')
  })
})

describe('подпись запроса', () => {
  it('место, даты и гости', () => {
    const label = hotelQueryLabel(stay)
    expect(label).toContain('Хакуба')
    expect(label).toContain('2 гост.')
    expect(label).toContain('—')
    expect(label).not.toContain('ном.')
  })

  it('добавляет число номеров, если их больше одного', () => {
    expect(hotelQueryLabel({ ...stay, rooms: 2 })).toContain('2 ном.')
  })
})

describe('слаг Яндекс Путешествий', () => {
  it('знает крупные города', () => {
    expect(yandexPlaceSlug('Санкт-Петербург')).toBe('saint-petersburg')
    expect(yandexPlaceSlug('Москва')).toBe('moscow')
    expect(yandexPlaceSlug('Красная Поляна')).toBe('krasnaya-polyana')
  })

  it('транслитерирует незнакомые названия', () => {
    expect(yandexPlaceSlug('Хакуба')).toBe('hakuba')
    expect(yandexPlaceSlug('Фудзикавагутико')).toBe('fujikawaguchiko')
    expect(yandexPlaceSlug('  Токио ')).toBe('tokyo')
  })
})
