import { z } from 'zod'
import type { Trip } from '@/types'
import { computeCosts } from '@/lib/costs'
import { convertGuideAmount } from '@/lib/currency'
import { guideFor, guidePassPerDay } from '@/data/resort-guides'
import { findResort } from '@/data/resorts'
import { hotelsFor, hotelOfferCoords } from '@/data/hotels'
import { hotelNightly } from '@/lib/hotel-search'
import { cheapestNearby, nearbyDates, seasonRange } from '@/lib/season'
import { aiSettings, deepseekAvailable } from '@/lib/ai/settings'

export type AuditKind = 'dates' | 'hotel' | 'skipass' | 'budget'

export interface AuditApplyDates {
  type: 'shift-dates'
  days: number
}

export interface AuditApplyHotel {
  type: 'hotel'
  stopId: string
  hotel: string
  stars: number
  price: number
  lat: number
  lng: number
}

export interface AuditApplySkipass {
  type: 'skipass'
  stopId: string
  pricePerDay: number
}

export type AuditApply = AuditApplyDates | AuditApplyHotel | AuditApplySkipass

export interface AuditSuggestion {
  id: string
  kind: AuditKind
  title: string
  detail: string
  savings: number
  /** null — предложение без прямой экономии */
  apply: AuditApply | null
}

export interface TripAudit {
  summary: string
  notes: string[]
  suggestions: AuditSuggestion[]
  provider: 'local' | 'deepseek'
}

function round(value: number): number {
  return Math.max(0, Math.round(value))
}

function seasonHint(factor: number): string {
  if (factor >= 1.3) return 'пик сезона'
  if (factor >= 1.1) return 'высокий сезон'
  if (factor <= 0.9) return 'низкий сезон'
  return 'средний сезон'
}

/** Локальный аудит: все числа считаются по справочникам и текущей смете. */
export function localTripAudit(trip: Trip): TripAudit {
  const costs = computeCosts(trip)
  const suggestions: AuditSuggestion[] = []
  const stays = trip.stops.filter((stop) => stop.kind === 'stay')

  for (const stay of stays) {
    if (stay.kind !== 'stay') continue
    const resort = findResort(stay.resortId)
    if (!resort) continue
    const season = seasonRange(stay.checkIn, stay.nights, resort)
    const factor = season?.factor || 1
    const rooms = Math.max(1, stay.rooms)
    const nights = Math.max(1, stay.nights)

    if (stay.checkIn && season) {
      const base = stay.hotelPerNight > 0 ? stay.hotelPerNight / factor : 0
      if (base > 0) {
        const options = nearbyDates(stay.checkIn, nights, resort, base)
        const cheaper = cheapestNearby(options)
        if (cheaper && cheaper.deltaTotal < -1000) {
          suggestions.push({
            id: `dates-${stay.id}`,
            kind: 'dates',
            title: `Сдвинуть даты в ${stay.resort} на ${Math.abs(cheaper.shift)} дн.`,
            detail: `Сейчас ${seasonHint(factor)}; рядом дешевле. Ориентир по отелю — без билетов.`,
            savings: round(Math.abs(cheaper.deltaTotal) * rooms),
            apply: { type: 'shift-dates', days: cheaper.shift },
          })
        }
      }
    }

    if (stay.hotelPerNight > 0 && nights > 0) {
      const alternatives = hotelsFor(stay.resortId)
        .filter((offer) => offer.name !== stay.hotel)
        .map((offer) => ({
          offer,
          nightly: hotelNightly(offer, trip.currency, factor),
          coords: hotelOfferCoords(offer),
        }))
        .filter((item) => item.coords && item.nightly > 0)
        .map((item) => ({
          ...item,
          saving: (stay.hotelPerNight - item.nightly) * nights * rooms,
        }))
        .filter((item) => item.saving > 1000)
        .sort((a, b) => b.saving - a.saving)

      const best = alternatives[0]
      if (best?.coords) {
        suggestions.push({
          id: `hotel-${stay.id}`,
          kind: 'hotel',
          title: `Заменить отель в ${stay.resort}`,
          detail: `${best.offer.name} · ${best.offer.stars}★ · ${best.offer.liftKm.toFixed(2)} км до станции, ориентир ${best.nightly} ${trip.currency}/ночь.`,
          savings: round(best.saving),
          apply: {
            type: 'hotel',
            stopId: stay.id,
            hotel: best.offer.name,
            stars: best.offer.stars,
            price: best.nightly,
            lat: best.coords.lat,
            lng: best.coords.lng,
          },
        })
      }
    }

    const guide = guideFor(stay.resortId)
    const guidePass = guide ? guidePassPerDay(guide) : null
    if (guidePass && stay.skipassDays > 0) {
      const price = convertGuideAmount(guidePass.amount, guidePass.currency, trip.currency)
      const saving = (stay.skipassPerDay - price) * stay.skipassDays * Math.max(1, trip.pax)
      if (price > 0 && saving > 500) {
        suggestions.push({
          id: `pass-${stay.id}`,
          kind: 'skipass',
          title: `Скипасс по гиду в ${stay.resort}`,
          detail: `${guidePass.label}: ${price} ${trip.currency}/день вместо ${stay.skipassPerDay}.`,
          savings: round(saving),
          apply: { type: 'skipass', stopId: stay.id, pricePerDay: price },
        })
      }
    }
  }

  const totalSavings = suggestions.reduce((sum, item) => sum + item.savings, 0)
  const budget = trip.budget && trip.budget > 0 ? trip.budget : null
  const pieces = [
    `Итого ${costs.total} ${trip.currency} на ${Math.max(1, trip.pax)} чел.`,
    `Найдено ${suggestions.length} вариантов на ${totalSavings} ${trip.currency}.`,
  ]
  if (budget) {
    pieces.push(
      costs.total > budget
        ? `Бюджет превышен на ${costs.total - budget} ${trip.currency}.`
        : `В бюджете остаётся ${budget - costs.total} ${trip.currency}.`,
    )
  }

  return {
    summary: pieces.join(' '),
    notes: [],
    suggestions: suggestions.sort((a, b) => b.savings - a.savings),
    provider: 'local',
  }
}

export const DeepSeekAuditSchema = z.object({
  summary: z.string().min(1).max(600),
  rankedIds: z.array(z.string()).max(12).default([]),
  notes: z.array(z.string().min(1).max(220)).max(6).default([]),
})

export type DeepSeekAudit = z.infer<typeof DeepSeekAuditSchema>

const ENDPOINT = 'https://api.deepseek.com/chat/completions'
const AUDIT_LIMIT_KEY = 'atd.ai.audit.limit.v1'
const AUDIT_DAILY_LIMIT = 10

function auditQuotaLeft(): number {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(AUDIT_LIMIT_KEY)
    if (!raw) return AUDIT_DAILY_LIMIT
    const parsed = JSON.parse(raw) as { date?: string; count?: number }
    if (parsed.date !== today) return AUDIT_DAILY_LIMIT
    return Math.max(0, AUDIT_DAILY_LIMIT - (Number(parsed.count) || 0))
  } catch {
    return AUDIT_DAILY_LIMIT
  }
}

function markAuditRequest(): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(AUDIT_LIMIT_KEY)
    const parsed = raw ? (JSON.parse(raw) as { date?: string; count?: number }) : null
    const count = parsed?.date === today ? (Number(parsed.count) || 0) + 1 : 1
    localStorage.setItem(AUDIT_LIMIT_KEY, JSON.stringify({ date: today, count }))
  } catch {
    // ignore
  }
}

function contextFor(trip: Trip, local: TripAudit): Record<string, unknown> {
  const costs = computeCosts(trip)
  return {
    trip: {
      name: trip.name,
      currency: trip.currency,
      pax: trip.pax,
      budget: trip.budget,
      total: costs.total,
      perPerson: costs.perPerson,
      nights: costs.nights,
      rideDays: costs.rideDays,
      resorts: trip.stops
        .filter((stop) => stop.kind === 'stay')
        .map((stop) => (stop.kind === 'stay' ? stop.resort || stop.city : stop.kind)),
    },
    suggestions: local.suggestions,
    rules: [
      'Не придумывай числа: savings и цены уже посчитаны.',
      'Верни только summary, rankedIds и notes.',
      'rankedIds — только id из suggestions; notes — короткие советы без цен.',
    ],
  }
}

/** DeepSeek ранжирует готовые варианты и пишет пояснение; цифры остаются локальными. */
export async function llmTripAudit(trip: Trip): Promise<TripAudit> {
  const local = localTripAudit(trip)
  if (!deepseekAvailable.value || auditQuotaLeft() <= 0) return local
  markAuditRequest()

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiSettings.value.deepseekKey.trim()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: aiSettings.value.deepseekModel || 'deepseek-chat',
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Ты аудитор горнолыжной поездки. Все суммы уже посчитаны приложением. ' +
              'Не меняй числа и не выдумывай новые. Верни JSON: summary, rankedIds, notes.',
          },
          { role: 'user', content: JSON.stringify(contextFor(trip, local)) },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) return local
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) return local
    const parsed = DeepSeekAuditSchema.safeParse(JSON.parse(content.slice(start, end + 1)))
    if (!parsed.success) return local

    const rank = new Map(parsed.data.rankedIds.map((id, index) => [id, index]))
    const suggestions = [...local.suggestions].sort((a, b) => {
      const ai = rank.get(a.id) ?? 99
      const bi = rank.get(b.id) ?? 99
      if (ai !== bi) return ai - bi
      return b.savings - a.savings
    })
    return {
      summary: parsed.data.summary,
      notes: parsed.data.notes,
      suggestions,
      provider: 'deepseek',
    }
  } catch {
    return local
  } finally {
    clearTimeout(timer)
  }
}
