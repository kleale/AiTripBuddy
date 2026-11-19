export type PartnerRegion = 'RU' | 'EU' | 'US' | 'JP'

export interface PartnerOffer {
  id: string
  name: string
  region: PartnerRegion
  kind: 'hotel' | 'flight' | 'gear' | 'rental' | 'school'
  url: string
  note: string
}

const utm = '?utm_source=aitripbuddy&utm_medium=referral'

export const partnerOffers: PartnerOffer[] = [
  { id: 'ozon', name: 'Ozon Travel', region: 'RU', kind: 'hotel', url: `https://www.ozon.ru/travel/${utm}`, note: 'отели и билеты, оплата на Ozon' },
  { id: 'yandex-travel', name: 'Яндекс Путешествия', region: 'RU', kind: 'hotel', url: `https://travel.yandex.ru/${utm}`, note: 'отели, билеты, аренда авто' },
  { id: 'aviasales', name: 'Aviasales', region: 'RU', kind: 'flight', url: `https://www.aviasales.ru/${utm}`, note: 'поиск билетов по датам и городу' },
  { id: 'sportmaster', name: 'Спортмастер', region: 'RU', kind: 'gear', url: `https://www.sportmaster.ru/${utm}`, note: 'экипировка и одежда' },
  { id: 'kant', name: 'Кант', region: 'RU', kind: 'gear', url: `https://www.kant.ru/${utm}`, note: 'горные лыжи, сноуборды, ботинки' },
  { id: 'traektoria', name: 'Траектория', region: 'RU', kind: 'gear', url: `https://traektoria.com/${utm}`, note: 'снаряжение и сервис' },
  { id: 'booking', name: 'Booking', region: 'EU', kind: 'hotel', url: `https://www.booking.com/${utm}`, note: 'отели и апартаменты в Европе' },
  { id: 'trip', name: 'Trip.com', region: 'EU', kind: 'hotel', url: `https://www.trip.com/${utm}`, note: 'отели и билеты в Азии и Европе' },
  { id: 'skyscanner', name: 'Skyscanner', region: 'EU', kind: 'flight', url: `https://www.skyscanner.net/${utm}`, note: 'сравнение билетов' },
  { id: 'decathlon', name: 'Decathlon', region: 'EU', kind: 'gear', url: `https://www.decathlon.com/${utm}`, note: 'бюджетная экипировка Wedze' },
  { id: 'rei', name: 'REI', region: 'US', kind: 'gear', url: `https://www.rei.com/${utm}`, note: 'экипировка и прокат в США' },
  { id: 'evo', name: 'evo', region: 'US', kind: 'gear', url: `https://www.evo.com/${utm}`, note: 'лыжи, сноуборды, одежда' },
  { id: 'backcountry', name: 'Backcountry', region: 'US', kind: 'gear', url: `https://www.backcountry.com/${utm}`, note: 'фрирайд и аутдор' },
  { id: 'montbell', name: 'Montbell', region: 'JP', kind: 'gear', url: `https://www.montbell.jp/${utm}`, note: 'японская экипировка и пух' },
  { id: 'rakuten', name: 'Rakuten', region: 'JP', kind: 'gear', url: `https://www.rakuten.co.jp/${utm}`, note: 'японский маркетплейс снаряжения' },
  { id: 'booking-jp', name: 'Booking', region: 'JP', kind: 'hotel', url: `https://www.booking.com/${utm}`, note: 'отели и апартаменты в Японии' },
]

export const partnerRegions: { id: PartnerRegion; label: string }[] = [
  { id: 'RU', label: 'Россия' },
  { id: 'EU', label: 'Европа' },
  { id: 'US', label: 'США' },
  { id: 'JP', label: 'Япония' },
]

export function partnersFor(region: PartnerRegion): PartnerOffer[] {
  return partnerOffers.filter((offer) => offer.region === region)
}
