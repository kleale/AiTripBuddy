import type { Currency, HotelSource } from '@/types'

export interface HotelQuery {
  /** Название отеля: уточняет поиск, если уже выбрано. */
  hotel?: string
  /** Курорт или город. */
  place: string
  country?: string
  /** YYYY-MM-DD */
  checkIn: string
  /** YYYY-MM-DD */
  checkOut: string
  adults: number
  rooms: number
  currency: Currency
  /** координаты места — Booking по ним сохраняет даты */
  lat?: number
  lng?: number
}

export interface HotelButton {
  id: HotelSource
  label: string
  url: string
  /** место и даты уже в ссылке */
  prefilled: boolean
  title: string
}

export const hotelSourceLabels: Record<HotelSource, string> = {
  booking: 'Booking',
  trip: 'Trip.com',
  ozon: 'Ozon',
  yandex: 'Яндекс',
}

/** Порядок кнопок и вариантов в селекте. */
export const hotelSourceOrder: HotelSource[] = ['booking', 'trip', 'ozon', 'yandex']

export function isHotelSource(value: unknown): value is HotelSource {
  return typeof value === 'string' && value in hotelSourceLabels
}

export function hotelSourceLabel(source: HotelSource | null | undefined): string {
  return source ? hotelSourceLabels[source] : ''
}

function isoDate(value?: string): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function hasPlace(query: HotelQuery): boolean {
  return Boolean(query.place?.trim())
}

function placeText(query: HotelQuery): string {
  return [query.place?.trim(), query.country?.trim()].filter(Boolean).join(', ')
}

function destinationText(query: HotelQuery): string {
  return [query.hotel?.trim(), placeText(query)].filter(Boolean).join(', ')
}

function guests(value: number): number {
  return Math.max(1, Math.round(value))
}

function rooms(value: number): number {
  return Math.max(1, Math.round(value))
}

/**
 * Booking: ss, checkin, checkout, group_adults, no_rooms, selected_currency.
 * Пример: searchresults.html?ss=Hakuba&checkin=2027-01-23&checkout=2027-02-02&group_adults=2&no_rooms=1
 */
export function bookingUrl(query: HotelQuery): string | null {
  const checkIn = isoDate(query.checkIn)
  const checkOut = isoDate(query.checkOut)
  if (!hasPlace(query) || !checkIn || !checkOut) return null

  const params = new URLSearchParams({
    ss: destinationText(query),
    lang: 'ru',
    sb: '1',
    src_elem: 'sb',
    src: 'searchresults',
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(guests(query.adults)),
    no_rooms: String(rooms(query.rooms)),
    group_children: '0',
    selected_currency: query.currency,
  })
  if (Number.isFinite(query.lat) && Number.isFinite(query.lng)) {
    params.set('dest_id', `${query.lat},${query.lng}`)
    params.set('dest_type', 'city')
  }

  return `https://www.booking.com/searchresults.ru.html?${params.toString()}`
}

/**
 * Trip.com: cityName + searchWord + searchType=CT, даты checkIn/checkOut.
 * Проверено: ссылка с названием курорта и датами открывает выдачу без city id.
 */
export function tripUrl(query: HotelQuery): string | null {
  const checkIn = isoDate(query.checkIn)
  const checkOut = isoDate(query.checkOut)
  if (!hasPlace(query) || !checkIn || !checkOut) return null

  const params = new URLSearchParams({
    cityName: query.place.trim(),
    searchWord: destinationText(query),
    searchType: 'CT',
    checkIn,
    checkOut,
    adult: String(guests(query.adults)),
    children: '0',
    crn: String(rooms(query.rooms)),
    curr: query.currency,
    barCurr: query.currency,
  })

  return `https://www.trip.com/hotels/list?${params.toString()}`
}

/**
 * Ozon Travel: search-new принимает даты и число гостей.
 * Город в ссылке — свободным текстом: если Ozon его не распознает, останутся даты.
 */
export function ozonUrl(query: HotelQuery): string | null {
  const checkIn = isoDate(query.checkIn)
  const checkOut = isoDate(query.checkOut)
  if (!hasPlace(query) || !checkIn || !checkOut) return null

  const params = new URLSearchParams({
    checkIn,
    checkOut,
    Dlts: String(guests(query.adults)),
    text: destinationText(query),
  })

  return `https://www.ozon.ru/travel/hotels/search-new?${params.toString()}`
}

const YANDEX_SLUGS: Record<string, string> = {
  'санкт-петербург': 'saint-petersburg',
  москва: 'moscow',
  сочи: 'sochi',
  'красная поляна': 'krasnaya-polyana',
  'роза хутор': 'roza-khutor',
  кировск: 'kirovsk',
  домбай: 'dombay',
  приэльбрусье: 'prielbrusye',
  манжерок: 'manzherok',
  архыз: 'arkhyz',
  хакуба: 'hakuba',
  нисеко: 'niseko',
  гудаури: 'gudauri',
  местиа: 'mestia',
  шерегеш: 'sheregesh',
  майрхофен: 'mayrhofen',
  фудзикавагутико: 'fujikawaguchiko',
  токио: 'tokyo',
  осака: 'osaka',
  киото: 'kyoto',
  фукуока: 'fukuoka',
  наха: 'naha',
  хиросима: 'hiroshima',
  нагасаки: 'nagasaki',
  саппоро: 'sapporo',
  сендай: 'sendai',
  мюнхен: 'munich',
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

/** Слаг города для travel.yandex.ru/hotels/<slug>/ */
export function yandexPlaceSlug(place: string): string {
  const key = place.trim().toLowerCase().replace(/ё/g, 'е').replace(/[’']/g, '')
  const known = YANDEX_SLUGS[key]
  if (known) return known
  return [...key]
    .map((char) => TRANSLIT[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Яндекс Путешествия: город в пути, даты заезда/выезда и число номеров.
 * Формат повторяет выдачу: /hotels/<city>/?checkinDate=…&checkoutDate=…&roomCount=…
 */
export function yandexHotelsUrl(query: HotelQuery): string | null {
  const checkIn = isoDate(query.checkIn)
  const checkOut = isoDate(query.checkOut)
  if (!hasPlace(query) || !checkIn || !checkOut) return null

  const slug = yandexPlaceSlug(query.place)
  const params = new URLSearchParams({
    adults: String(guests(query.adults)),
    checkinDate: checkIn,
    checkoutDate: checkOut,
    childrenAges: '',
    roomCount: String(rooms(query.rooms)),
  })
  if (!slug) params.set('text', destinationText(query))

  const base = slug
    ? `https://travel.yandex.ru/hotels/${slug}/`
    : 'https://travel.yandex.ru/hotels/search/'
  return `${base}?${params.toString()}`
}

/** Базовые адреса, если место или даты ещё не заданы. */
const PLAIN: Record<HotelSource, string> = {
  booking: 'https://www.booking.com/',
  trip: 'https://www.trip.com/hotels/',
  ozon: 'https://www.ozon.ru/travel/hotels/',
  yandex: 'https://travel.yandex.ru/hotels/',
}

const BUILDERS: Record<HotelSource, (query: HotelQuery) => string | null> = {
  booking: bookingUrl,
  trip: tripUrl,
  ozon: ozonUrl,
  yandex: yandexHotelsUrl,
}

/**
 * Кнопки поиска отелей. Если место и даты есть — ссылки с ними,
 * иначе открывается обычный поиск сервиса.
 */
export function hotelButtons(query: HotelQuery | null): HotelButton[] {
  return hotelSourceOrder.map((id) => {
    const label = hotelSourceLabels[id]
    const built = query ? BUILDERS[id](query) : null
    const prefilled = Boolean(built)

    return {
      id,
      label,
      url: built ?? PLAIN[id],
      prefilled,
      title: prefilled
        ? `${label}: место и даты подставлены`
        : `${label}: выберите место и даты на сайте`,
    }
  })
}

/** Подпись запроса: «Хакуба · 23 янв. — 2 февр. · 2 гостя». */
export function hotelQueryLabel(query: HotelQuery): string {
  const start = shortDate(query.checkIn)
  const end = shortDate(query.checkOut)
  const dates = start && end ? `${start} — ${end}` : start
  const parts = [query.place, dates, `${guests(query.adults)} гост.`]
  if (rooms(query.rooms) > 1) parts.push(`${rooms(query.rooms)} ном.`)
  return parts.filter(Boolean).join(' · ')
}

function shortDate(value: string): string {
  if (!isoDate(value)) return ''
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
