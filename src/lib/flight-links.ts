export interface FlightQuery {
  /** IATA вылета */
  from: string
  /** IATA прилёта */
  to: string
  /** YYYY-MM-DD */
  departDate: string
  /** YYYY-MM-DD, если обратный билет известен */
  returnDate?: string
  adults: number
  children?: number
  infants?: number
  currency?: string
  /** багаж включён — не все сервисы умеют это в ссылке */
  baggage?: boolean
}

export interface FlightLink {
  id: 'aviasales' | 'google' | 'yandex' | 'ozon'
  label: string
  url: string
  /** сервис принимает маршрут и даты в ссылке */
  prefilled: boolean
  note?: string
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function splitDate(value: string): { day: string; month: string; iso: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  return { day: match[3] ?? '', month: MONTHS[monthIndex] ?? '', iso: value }
}

/**
 * Aviasales: путь /search/{FROM}{DD}{MMM}{TO}[{DD}{MMM}]{ADULTS}.
 * Формат публичный и используется в шэрах; дети и младенцы — query-параметрами.
 */
export function aviasalesUrl(query: FlightQuery): string | null {
  const from = query.from.toUpperCase()
  const to = query.to.toUpperCase()
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = query.returnDate ? splitDate(query.returnDate) : null
  const adults = Math.max(1, Math.round(query.adults))

  let code = `${from}${depart.day}${depart.month}${to}`
  if (back) code += `${back.day}${back.month}`
  code += String(adults)

  const params = new URLSearchParams()
  if (query.children) params.set('children', String(query.children))
  if (query.infants) params.set('infants', String(query.infants))
  if (query.currency) params.set('currency', query.currency)

  const suffix = params.toString()
  return `https://www.aviasales.ru/search/${code}${suffix ? `?${suffix}` : ''}`
}

/**
 * Google Flights: параметр q с естественным запросом.
 * Работает без ключей и без внутренних id городов.
 */
export function googleFlightsUrl(query: FlightQuery): string | null {
  const from = query.from.toUpperCase()
  const to = query.to.toUpperCase()
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = query.returnDate ? splitDate(query.returnDate) : null
  const parts = [`Flights from ${from} to ${to} on ${depart.iso}`]
  parts.push(back ? `through ${back.iso}` : 'oneway')

  const params = new URLSearchParams({ q: parts.join(' ') })
  if (query.currency) params.set('curr', query.currency.toUpperCase())
  return `https://www.google.com/travel/flights?${params.toString()}`
}

/** Яндекс Путешествия, Ozon Travel: только вход, даты выбираются на сайте. */
export function plainSearchUrl(id: FlightLink['id']): string {
  if (id === 'yandex') return 'https://travel.yandex.ru/avia/'
  return 'https://www.ozon.ru/travel/'
}

/**
 * Все ссылки на поиск билетов для маршрута.
 * prefilled=true — маршрут и даты уже в ссылке; остальные открывают сервис.
 */
export function flightLinks(query: FlightQuery): FlightLink[] {
  const links: FlightLink[] = []

  const aviasales = aviasalesUrl(query)
  if (aviasales) {
    links.push({
      id: 'aviasales',
      label: 'Aviasales',
      url: aviasales,
      prefilled: true,
      note: 'Маршрут, даты и число взрослых в ссылке',
    })
  }

  const google = googleFlightsUrl(query)
  if (google) {
    links.push({
      id: 'google',
      label: 'Google Flights',
      url: google,
      prefilled: true,
      note: 'Маршрут и даты в ссылке',
    })
  }

  links.push({
    id: 'yandex',
    label: 'Яндекс Путешествия',
    url: plainSearchUrl('yandex'),
    prefilled: false,
    note: 'Даты выбрать на сайте',
  })

  links.push({
    id: 'ozon',
    label: 'Ozon Travel',
    url: plainSearchUrl('ozon'),
    prefilled: false,
    note: 'Даты выбрать на сайте',
  })

  return links
}

/** Подпись для кнопки: «SVO → HND · 22 янв · 2 чел.». */
export function flightQueryLabel(query: FlightQuery): string {
  const date = splitDate(query.departDate)
  const day = date
    ? new Date(`${query.departDate}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : ''
  return `${query.from.toUpperCase()} → ${query.to.toUpperCase()}${day ? ` · ${day}` : ''} · ${query.adults} чел.`
}