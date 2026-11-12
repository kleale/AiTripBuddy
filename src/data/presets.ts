import type { RouteLink, StayStop, Trip } from '@/types'

export interface PresetMeta {
  id: string
  title: string
  subtitle: string
}

const HAKUBA_ID = 'led-hakuba'

function hakubaTrip(): Trip {
  const stays: StayStop = {
    id: 'preset-hakuba-stay',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: 'Petit Hotel Anise Garden',
    lat: 36.7,
    lng: 137.85,
    hotelLat: 36.6975,
    hotelLng: 137.842,
    nights: 10,
    checkIn: '2027-01-23',
    rooms: 1,
    hotelPerNight: 11500,
    hotelStars: 3,
    skipassDays: 10,
    skipassPerDay: 6400,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
  }

  const links: RouteLink[] = [
    {
      kind: 'flight',
      price: 68000,
      hours: 14.5,
      date: '2027-01-22',
      time: '12:40',
      note: 'LED → HND, стыковка в Москве/Стамбуле',
    },
    {
      kind: 'transfer',
      price: 15200,
      hours: 5.5,
      date: '2027-01-23',
      time: '10:30',
      note: 'Nagano Snow Shuttle, HND → Hakuba',
    },
  ]

  return {
    id: HAKUBA_ID,
    name: 'LED → Токио → Хакуба, 10 дней',
    pax: 2,
    currency: 'RUB',
    budget: 620000,
    returnFlight: 68000,
    returnHours: 13.5,
    stops: [
      {
        id: 'preset-led-origin',
        kind: 'origin',
        cityId: 'spb-led',
        city: 'Санкт-Петербург',
        code: 'LED',
        lat: 59.8003,
        lng: 30.2625,
      },
      {
        id: 'preset-hnd-airport',
        kind: 'airport',
        cityId: 'tokyo-hnd',
        city: 'Токио',
        code: 'HND',
        lat: 35.5494,
        lng: 139.7798,
      },
      stays,
    ],
    links,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: '2026-11-12T00:00:00.000Z',
  }
}

const builders: Record<string, () => Trip> = {
  [HAKUBA_ID]: hakubaTrip,
}

export const presetList: PresetMeta[] = [
  {
    id: HAKUBA_ID,
    title: 'LED → Токио → Хакуба',
    subtitle: '2 чел. · 10 ночей · 10 дней катания · 3★ отель · рейсы до 70 000 ₽/чел.',
  },
]

export function buildPreset(id: string): Trip | null {
  const builder = builders[id]
  if (!builder) return null
  return JSON.parse(JSON.stringify(builder())) as Trip
}

export function isPresetId(id: string): boolean {
  return Boolean(builders[id])
}