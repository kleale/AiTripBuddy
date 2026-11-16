import type { Currency, RouteLink, StayStop } from '@/types'
import { resorts } from '@/data/resorts'
import { guideFor } from '@/data/resort-guides'
import { hotelPriceHint, linkPriceHint, skipassPriceHint, type PriceHint } from '@/lib/price-hints'

export interface ToolResult {
  hint?: PriceHint
  facts?: Record<string, unknown>
  history?: { month: number; low: number; typical: number; high: number }[]
}

export const aiToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'getResortFacts',
      description: 'Факты о курорте: страна, регион, сезон, перепад, подъёмники, скипасс.',
      parameters: {
        type: 'object',
        properties: { place: { type: 'string', description: 'Название курорта или id' } },
        required: ['place'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSkipassPrice',
      description: 'Цена скипасса на день по гиду курорта или стране.',
      parameters: {
        type: 'object',
        properties: {
          resortId: { type: 'string' },
          country: { type: 'string' },
          currency: { type: 'string' },
        },
        required: ['resortId', 'currency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTransferEstimate',
      description: 'Оценка переезда по координатам, виду транспорта и числу людей.',
      parameters: {
        type: 'object',
        properties: {
          fromLat: { type: 'number' },
          fromLng: { type: 'number' },
          toLat: { type: 'number' },
          toLng: { type: 'number' },
          mode: { type: 'string' },
          pax: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['fromLat', 'fromLng', 'toLat', 'toLng', 'mode', 'pax', 'currency'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPriceHistory',
      description: 'Сезонная история цен по месяцам из справочника (не сгенерированные цифры).',
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['hotel', 'skipass'] },
          resortId: { type: 'string' },
          country: { type: 'string' },
          stars: { type: 'number' },
          currency: { type: 'string' },
        },
        required: ['kind', 'currency'],
      },
    },
  },
] as const

function findResort(place: string) {
  const needle = place.trim().toLowerCase()
  return resorts.find((resort) => resort.id === needle || resort.name.toLowerCase() === needle) ??
    resorts.find((resort) => resort.name.toLowerCase().includes(needle) || needle.includes(resort.name.toLowerCase()))
}

function stayStub(input: {
  resortId?: string
  country?: string
  stars?: number
  currency: Currency
  checkIn?: string
}): StayStop {
  return {
    id: 'ai-stay',
    kind: 'stay',
    placeKind: 'resort',
    resortId: input.resortId ?? '',
    resort: '',
    country: input.country,
    hotel: '',
    lat: 0,
    lng: 0,
    nights: 1,
    rooms: 1,
    hotelPerNight: 0,
    hotelSource: null,
    hotelStars: input.stars ?? 0,
    skipassDays: 1,
    skipassPerDay: 0,
    meals: { breakfast: 'cafe', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
    checkIn: input.checkIn,
  } as StayStop
}

export async function runAiTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'getResortFacts') {
    const place = String(args.place ?? '')
    const resort = findResort(place)
    if (!resort) return { facts: { found: false, place } }
    const guide = guideFor(resort.id)
    return {
      facts: {
        found: true,
        id: resort.id,
        name: resort.name,
        country: resort.country,
        region: resort.region,
        season: guide?.season,
        verticalM: guide?.vertical,
        lifts: guide?.lifts,
        trailsKm: guide?.totalTrailsKm,
        passAll: guide?.passAll,
      },
    }
  }

  if (name === 'getSkipassPrice') {
    const currency = String(args.currency ?? 'RUB') as Currency
    const hint = skipassPriceHint(
      stayStub({
        resortId: String(args.resortId ?? ''),
        country: args.country ? String(args.country) : undefined,
        currency,
      }),
      currency,
    )
    return { hint: hint ?? undefined }
  }

  if (name === 'getTransferEstimate') {
    const currency = String(args.currency ?? 'RUB') as Currency
    const link: RouteLink = {
      kind: 'transfer',
      transport: String(args.mode ?? 'bus') as RouteLink['transport'],
      price: 0,
      hours: 0,
    }
    const hint = linkPriceHint(
      link,
      { lat: Number(args.fromLat), lng: Number(args.fromLng) },
      { lat: Number(args.toLat), lng: Number(args.toLng) },
      Number(args.pax) || 1,
      currency,
    )
    return { hint: hint ?? undefined }
  }

  if (name === 'getPriceHistory') {
    const currency = String(args.currency ?? 'RUB') as Currency
    const kind = String(args.kind ?? 'hotel')
    const history: { month: number; low: number; typical: number; high: number }[] = []
    for (let month = 1; month <= 12; month += 1) {
      const checkIn = `2027-${String(month).padStart(2, '0')}-15`
      const hint =
        kind === 'skipass'
          ? skipassPriceHint(
              stayStub({
                resortId: String(args.resortId ?? ''),
                country: args.country ? String(args.country) : undefined,
                currency,
              }),
              currency,
            )
          : hotelPriceHint(
              stayStub({
                resortId: String(args.resortId ?? ''),
                country: args.country ? String(args.country) : undefined,
                stars: Number(args.stars) || 3,
                currency,
                checkIn,
              }),
              currency,
            )
      if (hint) history.push({ month, low: hint.low, typical: hint.typical, high: hint.high })
    }
    return { history }
  }

  return { facts: { error: `unknown tool ${name}` } }
}
