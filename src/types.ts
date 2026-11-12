export type Currency = 'RUB' | 'EUR' | 'USD' | 'GEL' | 'KZT'

export type StopKind = 'origin' | 'airport' | 'stay'

export type LinkKind = 'flight' | 'transfer' | 'move'

export type MealKey = 'none' | 'hotel' | 'cafe' | 'slope'

export interface Meals {
  breakfast: MealKey
  lunch: MealKey
  dinner: MealKey
}

export interface StopBase {
  id: string
}

export interface OriginStop extends StopBase {
  kind: 'origin'
  cityId: string
  city: string
  code: string
  lat: number
  lng: number
}

export interface AirportStop extends StopBase {
  kind: 'airport'
  cityId: string
  city: string
  code: string
  lat: number
  lng: number
}

export type PlaceKind = 'resort' | 'city'

export interface StayStop extends StopBase {
  kind: 'stay'
  /** Курорт или город: город нужен для возврата с курорта в город. */
  placeKind: PlaceKind
  resortId: string
  resort: string
  cityId?: string
  city?: string
  /** Страна курорта или города — для цен питания и сравнения. */
  country?: string
  hotel: string
  lat: number
  lng: number
  hotelLat?: number
  hotelLng?: number
  nights: number
  /** Дата заезда в формате YYYY-MM-DD. */
  checkIn?: string
  /** Количество номеров: цена отеля задаётся за номер. */
  rooms: number
  hotelPerNight: number
  /** Уровень отеля: 0 — не указан, иначе 1–5 звёзд. */
  hotelStars: number
  skipassDays: number
  skipassPerDay: number
  meals: Meals
}

export type Stop = OriginStop | AirportStop | StayStop

export interface RouteLink {
  kind: LinkKind
  price: number
  hours: number
  /** Дата вылета или начала трансфера, YYYY-MM-DD. */
  date?: string
  /** Время вылета или начала трансфера, HH:MM. */
  time?: string
  note?: string
}

export interface Trip {
  id: string
  name: string
  pax: number
  currency: Currency
  budget: number | null
  returnFlight: number
  returnHours: number
  stops: Stop[]
  links: RouteLink[]
  createdAt: string
  updatedAt?: string
}

export interface PlaceOption {
  id: string
  label: string
  sublabel?: string
}