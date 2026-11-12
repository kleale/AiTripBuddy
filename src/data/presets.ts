import type { RouteLink, StayStop, Trip } from '@/types'

export interface PresetMeta {
  id: string
  title: string
  subtitle: string
}

const HAKUBA_ID = 'led-hakuba'

function hakubaTrip(): Trip {
  const hakuba: StayStop = {
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
    foodPerDayOverride: null,
  }

  const tokyo: StayStop = {
    id: 'preset-tokyo-stay',
    kind: 'stay',
    placeKind: 'city',
    cityId: 'tokyo-hnd',
    city: 'Токио',
    country: 'Япония',
    resortId: '',
    resort: '',
    hotel: 'Hotel MyStays Ueno Iriyaguchi',
    lat: 35.7148,
    lng: 139.7775,
    hotelLat: 35.7143,
    hotelLng: 139.7771,
    nights: 2,
    checkIn: '2027-02-02',
    rooms: 1,
    hotelPerNight: 9800,
    hotelStars: 3,
    skipassDays: 0,
    skipassPerDay: 0,
    meals: { breakfast: 'cafe', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
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
      time: '12:15',
      note: 'Nagano Snow Shuttle, HND → Хакуба',
    },
    {
      kind: 'move',
      price: 15200,
      hours: 5.5,
      date: '2027-02-02',
      time: '10:40',
      note: 'Обратный шаттл Хакуба → Токио',
    },
    {
      kind: 'flight',
      price: 68000,
      hours: 13.5,
      date: '2027-02-04',
      time: '17:05',
      note: 'HND → LED, вылет домой',
    },
  ]

  return {
    id: HAKUBA_ID,
    name: 'LED → Токио → Хакуба → LED, 12 дней',
    pax: 2,
    currency: 'RUB',
    budget: 720000,
    // Обратный перелёт уже заложен отдельным участком HND → LED
    returnFlight: 0,
    returnHours: 0,
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
        id: 'preset-hnd-arrival',
        kind: 'airport',
        cityId: 'tokyo-hnd',
        city: 'Токио',
        code: 'HND',
        lat: 35.5494,
        lng: 139.7798,
      },
      hakuba,
      tokyo,
      {
        id: 'preset-hnd-departure',
        kind: 'airport',
        cityId: 'tokyo-hnd',
        city: 'Токио',
        code: 'HND',
        lat: 35.5494,
        lng: 139.7798,
      },
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
    title: 'LED → Токио → Хакуба → LED',
    subtitle:
      '2 чел. · 10 ночей на курорте + 2 в Токио · 10 дней катания · отели 3★ · рейсы до 70 000 ₽/чел.',
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