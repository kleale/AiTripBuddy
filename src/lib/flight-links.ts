export interface FlightQuery {
  /** IATA вылета */
  from: string
  /** IATA прилёта */
  to: string
  /** YYYY-MM-DD */
  departDate: string
  /** YYYY-MM-DD, если известна обратная дата */
  returnDate?: string
  adults: number
  children?: number
  infants?: number
  /** багаж включён: поддерживает Ozon */
  baggage?: boolean
}

export interface FlightButton {
  id: 'aviasales' | 'google' | 'ozon' | 'yandex'
  label: string
  url: string
  /** маршрут и даты уже в ссылке */
  prefilled: boolean
  title: string
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

interface Parts {
  day: string
  month: string
  /** DDMM для Aviasales */
  ddmm: string
  iso: string
}

function splitDate(value?: string): Parts | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  const day = match[3] ?? ''
  const month = `${match[2] ?? ''}`
  return { day, month: MONTHS[monthIndex] ?? '', ddmm: day + month, iso: value }
}

function code(value: string): string {
  return value.trim().toUpperCase().slice(0, 3)
}

/**
 * Aviasales: params = {FROM}{DDMM}{TO}{DDMM}c{ADULTS}.
 * Пример рабочей ссылки: params=LED1811HND2811c2 — LED → HND, 18 и 28 ноября, 2 взрослых.
 */
export function aviasalesUrl(query: FlightQuery): string | null {
  const from = code(query.from)
  const to = code(query.to)
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = splitDate(query.returnDate)
  let params = `${from}${depart.ddmm}${to}`
  if (back) params += back.ddmm
  params += `c${Math.max(1, Math.round(query.adults))}`

  return `https://www.aviasales.ru/?destination_airports=0&departure_offset=12&params=${params}&origin_airports=1&return_offset=11`
}

/**
 * Ozon Travel: route = {from}{to}[{to}{from}], dates = d{из}d{в}.
 * Пример: route=ledaeraerled&dates=d2026-11-13d2026-11-27 — LED ↔ AER.
 * Единственный из сервисов, который принимает багаж в ссылке.
 */
export function ozonUrl(query: FlightQuery): string | null {
  const from = code(query.from).toLowerCase()
  const to = code(query.to).toLowerCase()
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = splitDate(query.returnDate)
  const route = back ? `${from}${to}${to}${from}` : `${from}${to}`
  const dates = back ? `d${depart.iso}d${back.iso}` : `d${depart.iso}`

  const params = new URLSearchParams({
    Children: String(query.children ?? 0),
    Dlts: String(Math.max(1, Math.round(query.adults))),
    Infants: String(query.infants ?? 0),
    ServiceClass: 'ECONOMY',
    dates,
    direct: 'true',
    luggage: String(Boolean(query.baggage)),
    route,
  })

  return `https://www.ozon.ru/travel/flight/search?${params.toString()}`
}

/**
 * Яндекс Путешествия: fromId/toId, when/return_date, seats, oneway.
 * В ссылке примера внутренние id городов (c10393, c202); мы передаём IATA —
 * Яндекс обычно распознаёт коды, иначе город выбирается на странице.
 */
export function yandexUrl(query: FlightQuery): string | null {
  const from = code(query.from)
  const to = code(query.to)
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = splitDate(query.returnDate)
  const params = new URLSearchParams({
    adult_seats: String(Math.max(1, Math.round(query.adults))),
    children_seats: String(query.children ?? 0),
    infant_seats: String(query.infants ?? 0),
    fromId: from,
    toId: to,
    klass: 'economy',
    oneway: back ? '2' : '1',
    salesChannel: 'B2C',
    when: depart.iso,
  })
  if (back) params.set('return_date', back.iso)

  return `https://travel.yandex.ru/avia/search/result/?${params.toString()}`
}

/**
 * Google Flights: естественный запрос строкой.
 * Проверено: ссылка открывает конкретный маршрут и дату.
 */
export function googleFlightsUrl(query: FlightQuery): string | null {
  const from = code(query.from)
  const to = code(query.to)
  const depart = splitDate(query.departDate)
  if (!from || !to || !depart) return null

  const back = splitDate(query.returnDate)
  const text = `Flights from ${from} to ${to} on ${depart.iso} ${back ? `through ${back.iso}` : 'oneway'}`
  return `https://www.google.com/travel/flights?${new URLSearchParams({ q: text }).toString()}`
}

/** Базовые адреса, если дата ещё не задана. */
const PLAIN: Record<FlightButton['id'], { label: string; url: string }> = {
  aviasales: { label: 'Aviasales', url: 'https://www.aviasales.ru/' },
  google: { label: 'Google', url: 'https://www.google.com/travel/flights' },
  ozon: { label: 'Ozon', url: 'https://www.ozon.ru/travel/' },
  yandex: { label: 'Яндекс', url: 'https://travel.yandex.ru/avia/' },
}

const BUILDERS: Record<FlightButton['id'], (query: FlightQuery) => string | null> = {
  aviasales: aviasalesUrl,
  google: googleFlightsUrl,
  ozon: ozonUrl,
  yandex: yandexUrl,
}

/**
 * Кнопки поиска билетов. Если дата и коды есть — ссылки с маршрутом,
 * иначе открывается обычный поиск сервиса.
 */
export function flightButtons(query: FlightQuery | null): FlightButton[] {
  const order: FlightButton['id'][] = ['aviasales', 'ozon', 'yandex', 'google']

  return order.map((id) => {
    const plain = PLAIN[id]
    const built = query ? BUILDERS[id](query) : null
    const prefilled = Boolean(built)

    return {
      id,
      label: plain.label,
      url: built ?? plain.url,
      prefilled,
      title: prefilled
        ? `${plain.label}: маршрут и даты подставлены`
        : `${plain.label}: выберите даты на сайте`,
    }
  })
}

/** Подпись запроса: «LED → HND · 18 ноя · 2 чел.». */
export function flightQueryLabel(query: FlightQuery): string {
  const date = splitDate(query.departDate)
  const day = date
    ? new Date(`${query.departDate}T00:00:00`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : ''
  return `${code(query.from)} → ${code(query.to)}${day ? ` · ${day}` : ''} · ${query.adults} чел.`
}