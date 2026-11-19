import type { Currency, RouteLink, StayStop, Stop } from '@/types'
import { convertAmount } from '@/lib/currency'
import { convertGuideAmount } from '@/lib/currency'
import { distanceKm } from '@/lib/geo'
import { guideFor, guidePassPerDay } from '@/data/resort-guides'
import { defaultTransport, transportFor } from '@/lib/transport'
import { bookingUrl } from '@/lib/hotel-links'
import { stayCheckOut } from '@/lib/schedule'

export interface PriceHistoryPoint {
  month: number
  low: number
  typical: number
  high: number
}

export type PriceHintKind = 'hotel' | 'transfer' | 'skipass' | 'food'

export interface PriceHint {
  kind: PriceHintKind
  low: number
  high: number
  typical: number
  currency: Currency
  unit: string
  source: string
  fetchedAt: string
  confidence: 'low' | 'medium' | 'high'
  rationale: string
  /** ссылка на партнёрский поиск, если её можно построить без догадок */
  providerUrl?: string
  providerLabel?: string
  /** сезонная история из справочника, а не сгенерированные офферы */
  history?: PriceHistoryPoint[]
  /** групповой контекст: цена за номер/день на N гостей */
  pax?: number
  rooms?: number
}

const HOTEL_BY_RESORT: Record<string, number> = {
  'krasnaya-polyana': 12000,
  'rosa-khutor': 13500,
  'sheregesh': 7000,
  'kirovsk': 6000,
  'krasnoe-ozero': 8000,
  'tuutari': 8000,
  'dombay': 6500,
  'elbrus': 6000,
  'manzherok': 6500,
  'arkhyz': 7500,
  'hakuba': 13500,
  'niseko': 19000,
  'gudauri': 7000,
  'mestia': 6000,
  'mayrhofen': 16000,
}

const HOTEL_BY_COUNTRY: Record<string, number> = {
  'Россия': 8000,
  'Япония': 14500,
  'Грузия': 7000,
  'Австрия': 16000,
  'Швейцария': 18000,
  'Франция': 15000,
  'Италия': 14000,
  'США': 16000,
  'Канада': 15000,
  'Казахстан': 9000,
}

const PASS_BY_COUNTRY: Record<string, number> = {
  'Россия': 3000,
  'Япония': 4500,
  'Грузия': 2500,
  'Австрия': 6000,
  'Швейцария': 6500,
  'Франция': 6000,
  'Италия': 5500,
  'США': 7000,
  'Канада': 6500,
  'Казахстан': 3500,
}

function todayIso(): string {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function round100(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100)
}

function fromRub(amount: number, currency: Currency): number {
  return Math.max(0, Math.round(convertAmount(amount, 'RUB', currency)))
}

function seasonFactor(checkIn?: string): number {
  if (!checkIn) return 1
  const month = Number(checkIn.slice(5, 7))
  if (!Number.isFinite(month)) return 1
  if (month === 12 || month <= 2) return 1.15
  if (month === 3) return 1.05
  if (month === 4 || month === 11) return 0.9
  return 0.8
}

function historyFromRub(baseRub: number, currency: Currency): PriceHistoryPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const factor = seasonFactor(`2027-${String(month).padStart(2, '0')}-15`)
    const typical = fromRub(round100(baseRub * factor), currency)
    return {
      month,
      low: fromRub(round100(baseRub * factor * 0.74), currency),
      typical,
      high: fromRub(round100(baseRub * factor * 1.34), currency),
    }
  })
}

/** Оценка цены за номер по курорту, звёздности и сезону. */
export function hotelPriceHint(
  stop: StayStop,
  currency: Currency,
  options: { pax?: number; rooms?: number } = {},
): PriceHint {
  const base = HOTEL_BY_RESORT[stop.resortId] ?? HOTEL_BY_COUNTRY[stop.country ?? ''] ?? 10000
  const starFactor = stop.hotelStars >= 5 ? 2.1 : stop.hotelStars === 4 ? 1.45 : stop.hotelStars === 3 ? 1 : stop.hotelStars === 2 ? 0.75 : stop.hotelStars === 1 ? 0.6 : 1
  const typicalRub = base * starFactor * seasonFactor(stop.checkIn)
  const typical = fromRub(round100(typicalRub), currency)
  const place = stop.resort || stop.city || ''
  const checkOut = stayCheckOut(stop)
  const provider = place && checkOut
    ? bookingUrl({
        hotel: stop.hotel,
        place,
        country: stop.country,
        checkIn: stop.checkIn || '',
        checkOut,
        adults: options.pax ?? 1,
        rooms: options.rooms ?? 1,
        currency,
        lat: stop.hotelLat ?? stop.lat,
        lng: stop.hotelLng ?? stop.lng,
      })
    : null
  return {
    kind: 'hotel',
    low: fromRub(round100(typicalRub * 0.74), currency),
    high: fromRub(round100(typicalRub * 1.34), currency),
    typical,
    currency,
    unit: 'за номер/ночь',
    source: 'Справочник цен + страна/звёзды/сезон',
    fetchedAt: todayIso(),
    confidence: stop.hotelStars > 0 ? 'medium' : 'low',
    rationale: `${stop.country ?? 'страна не указана'}, ${stop.hotelStars || 'звёздность не указана'}, сезон ×${seasonFactor(stop.checkIn).toFixed(2)}`,
    providerUrl: provider ?? undefined,
    providerLabel: provider ? 'Booking' : undefined,
    history: historyFromRub(base * starFactor, currency),
    pax: options.pax,
    rooms: options.rooms,
  }
}

/** Оценка стоимости переезда по расстоянию, виду транспорта и числу людей. */
export function linkPriceHint(
  link: RouteLink,
  from: Pick<Stop, 'lat' | 'lng'> | null,
  to: Pick<Stop, 'lat' | 'lng'> | null,
  pax: number,
  currency: Currency,
): PriceHint | null {
  if (!from || !to) return null
  const km = distanceKm(from, to)
  if (!Number.isFinite(km) || km < 1) return null

  const mode = link.kind === 'flight' ? 'plane' : (link.transport ?? defaultTransport(link.kind))
  const meta = transportFor({ kind: link.kind, transport: mode })
  let rub = 0
  let perCar = false

  switch (mode) {
    case 'plane':
      rub = Math.max(5000, km * 8 + 3500) * Math.max(1, pax)
      break
    case 'train':
      rub = (km * 2.5 + 500) * Math.max(1, pax)
      break
    case 'bus':
      rub = (km * 1.8 + 300) * Math.max(1, pax)
      break
    case 'ferry':
      rub = (km * 5 + 800) * Math.max(1, pax)
      break
    case 'taxi':
      rub = km * 30
      perCar = true
      break
    case 'car':
      rub = km * 12 + 800
      perCar = true
      break
  }

  const typical = fromRub(round100(rub), currency)
  return {
    kind: 'transfer',
    low: fromRub(round100(rub * 0.75), currency),
    high: fromRub(round100(rub * 1.3), currency),
    typical,
    currency,
    unit: perCar ? 'на машину' : 'на группу',
    source: `Расстояние ${Math.round(km)} км · ${meta.label.toLowerCase()}`,
    fetchedAt: todayIso(),
    confidence: km > 30 ? 'medium' : 'low',
    rationale: `${Math.round(km)} км, ${Math.max(1, pax)} чел., ${perCar ? 'за машину' : 'на группу'}`,
    providerUrl: `https://yandex.ru/maps/?rtext=${from.lat},${from.lng}~${to.lat},${to.lng}&rtt=auto`,
    providerLabel: 'Маршрут',
    pax: Math.max(1, pax),
  }
}

/** Цена скипасса на день: из гида, иначе по стране. */
export function skipassPriceHint(stop: StayStop, currency: Currency): PriceHint | null {
  if (stop.placeKind === 'city') return null
  const guide = guideFor(stop.resortId)
  const pass = guide ? guidePassPerDay(guide) : null
  const rub = pass ? convertGuideAmount(pass.amount, pass.currency, 'RUB') : PASS_BY_COUNTRY[stop.country ?? ''] ?? 3000
  if (rub <= 0) return null
  const typical = fromRub(round100(rub), currency)
  return {
    kind: 'skipass',
    low: fromRub(round100(rub * 0.85), currency),
    high: fromRub(round100(rub * 1.2), currency),
    typical,
    currency,
    unit: 'за день',
    source: pass ? 'Скипасс из гида курорта' : 'Средняя цена по стране',
    fetchedAt: todayIso(),
    confidence: pass ? 'high' : 'low',
    rationale: pass ? `${stop.resort || 'курорт'} · ${pass.label}` : 'Оценка по стране',
    history: historyFromRub(rub, currency),
  }
}

/**
 * P0: локальная оценка всегда доступна. Если в настройках AI задан ключ
 * OpenRouter, вызываем LLM с tools и структурированным ответом; иначе fallback.
 */
export async function askPriceHint(fallback: PriceHint, context: unknown): Promise<PriceHint> {
  try {
    const { llmPriceHint } = await import('@/lib/ai/agent')
    return await llmPriceHint(fallback, (context ?? {}) as Record<string, unknown>)
  } catch {
    return fallback
  }
}