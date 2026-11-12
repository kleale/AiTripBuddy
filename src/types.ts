export type Currency = 'RUB' | 'EUR' | 'USD' | 'GEL' | 'KZT'

export type StopKind = 'origin' | 'airport' | 'stay'

export type LinkKind = 'flight' | 'transfer' | 'move'

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

export interface StayStop extends StopBase {
  kind: 'stay'
  resortId: string
  resort: string
  hotel: string
  lat: number
  lng: number
  nights: number
  hotelPerNight: number
  skipassDays: number
  skipassPerDay: number
  foodPerDay: number
}

export type Stop = OriginStop | AirportStop | StayStop

export interface RouteLink {
  kind: LinkKind
  price: number
  hours: number
  note?: string
}

export interface Trip {
  id: string
  name: string
  pax: number
  currency: Currency
  budget: number | null
  returnFlight: number
  stops: Stop[]
  links: RouteLink[]
  createdAt: string
}

export interface PlaceOption {
  id: string
  label: string
  sublabel?: string
}
