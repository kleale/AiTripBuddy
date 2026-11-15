export type Currency = 'RUB' | 'EUR' | 'USD' | 'GEL' | 'KZT'

export type StopKind = 'origin' | 'airport' | 'stay'

export type LinkKind = 'flight' | 'transfer' | 'move'

/** Вид транспорта на участке: задаёт подпись и цвет ребра. */
export type TransportMode = 'plane' | 'train' | 'bus' | 'taxi' | 'car' | 'ferry'

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

/** Сайт, к которому привязана цена за номер. */
export type HotelSource = 'booking' | 'trip' | 'ozon' | 'yandex'

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
  /** Сайт, где бронируется номер: цена за ночь привязана к нему. */
  hotelSource: HotelSource | null
  /** Дата фиксации цены за номер, YYYY-MM-DD. */
  hotelPriceAt?: string
  /** Уровень отеля: 0 — не указан, иначе 1–5 звёзд. */
  hotelStars: number
  skipassDays: number
  skipassPerDay: number
  meals: Meals
  /**
   * Ручная цена питания на человека в день.
   * null — считается автоматически по составу приёмов пищи и стране курорта.
   */
  foodPerDayOverride: number | null
}

export type Stop = OriginStop | AirportStop | StayStop

export interface RouteLink {
  kind: LinkKind
  /** Транспорт участка; у перелёта всегда самолёт. */
  transport?: TransportMode
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
  /** Необязательная подготовка к поездке: уровень, снаряжение и чек-лист. */
  prep?: PrepPlan
  createdAt: string
  updatedAt?: string
}

export type SkillLevel = 'beginner' | 'intermediate' | 'expert'

export type GearKind = 'snowboard' | 'ski' | 'undecided'

export type GearOwnership = 'own' | 'rent' | 'mix'

export interface DisciplineMix {
  /** проценты, в сумме 100 */
  trail: number
  freeride: number
  park: number
}

export interface PrepPlan {
  enabled: boolean
  level: SkillLevel
  mix: DisciplineMix
  ownership: GearOwnership
  equipment: GearKind
  heightCm: number
  weightKg: number
  bootSize: number
  /** подтверждено, что фрирайд только с бипером, щупом и лопатой */
  avalancheAck: boolean
  /** id пункта чек-листа → куплено/собрано */
  checklist: Record<string, boolean>
}

export interface PlaceOption {
  id: string
  label: string
  sublabel?: string
}