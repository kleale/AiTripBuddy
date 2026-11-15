import type { Currency, RouteLink, StayStop, Stop } from '@/types'
import { convertAmount } from '@/lib/currency'
import { convertGuideAmount } from '@/lib/currency'
import { distanceKm } from '@/lib/geo'
import { guideFor, guidePassPerDay } from '@/data/resort-guides'
import { defaultTransport, transportFor } from '@/lib/transport'

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

/** Оценка цены за номер по курорту, звёздности и сезону. */
export function hotelPriceHint(stop: StayStop, currency: Currency): PriceHint {
  const base = HOTEL_BY_RESORT[stop.resortId] ?? HOTEL_BY_COUNTRY[stop.country ?? ''] ?? 10000
  const starFactor = stop.hotelStars >= 5 ? 2.1 : stop.hotelStars === 4 ? 1.45 : stop.hotelStars === 3 ? 1 : stop.hotelStars === 2 ? 0.75 : stop.hotelStars === 1 ? 0.6 : 1
  const typicalRub = base * starFactor * seasonFactor(stop.checkIn)
  const typical = fromRub(round100(typicalRub), currency)
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
  }
}

function isPriceHint(value: unknown): value is PriceHint {
  if (!value || typeof value !== 'object') return false
  const hint = value as PriceHint
  return (
    Number.isFinite(hint.low) &&
    Number.isFinite(hint.high) &&
    Number.isFinite(hint.typical) &&
    hint.low <= hint.high &&
    typeof hint.currency === 'string'
  )
}

/**
 * P0: локальная оценка всегда доступна. Если задан VITE_PRICE_AI_URL,
 * пробуем внешний LLM/tools-сервис и откатываемся на локальный расчёт.
 */
export async function askPriceHint(fallback: PriceHint, context: unknown): Promise<PriceHint> {
  const url = (import.meta as { env?: Record<string, string> }).env?.VITE_PRICE_AI_URL
  if (!url) return fallback

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hint: fallback, context }),
      signal: controller.signal,
    })
    if (!response.ok) return fallback
    const data = await response.json()
    if (!isPriceHint(data)) return fallback
    return {
      ...data,
      source: data.source || fallback.source,
      fetchedAt: data.fetchedAt || fallback.fetchedAt,
    }
  } catch {
    return fallback
  } finally {
    clearTimeout(timer)
  }
}
