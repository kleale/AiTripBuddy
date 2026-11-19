import type { ActivityKind } from '@/types'

const UTM = 'utm_source=aitripbuddy&utm_medium=referral&utm_campaign=activities'

export const activityKindLabels: Record<ActivityKind, string> = {
  spa: 'Спа',
  excursion: 'Экскурсия',
  concert: 'Концерт',
  ride: 'Катание',
  custom: 'Своё',
}

export interface ActivityLink {
  id: 'trip' | 'viator' | 'getyourguide' | 'klook' | 'ozon' | 'yandex'
  label: string
  href: string
  partner: true
}

function encode(value: string): string {
  return encodeURIComponent(value.trim())
}

/** Партнёрские поисковые ссылки: приложение не бронирует и не принимает оплату. */
export function activitySearchLinks(
  query: string,
  place: string,
  country?: string,
): ActivityLink[] {
  const text = [query, place, country].filter(Boolean).join(' ').trim()
  if (!text) return []
  const q = encode(text)
  return [
    {
      id: 'trip',
      label: 'Trip.com',
      href: `https://www.trip.com/things-to-do/search?keyword=${q}&${UTM}`,
      partner: true,
    },
    {
      id: 'viator',
      label: 'Viator',
      href: `https://www.viator.com/searchResults/all?text=${q}&${UTM}`,
      partner: true,
    },
    {
      id: 'getyourguide',
      label: 'GetYourGuide',
      href: `https://www.getyourguide.com/s/?q=${q}&${UTM}`,
      partner: true,
    },
    {
      id: 'klook',
      label: 'Klook',
      href: `https://www.klook.com/search/?query=${q}&${UTM}`,
      partner: true,
    },
    {
      id: 'ozon',
      label: 'Ozon',
      href: `https://www.ozon.ru/search/?text=${q}&${UTM}`,
      partner: true,
    },
    {
      id: 'yandex',
      label: 'Яндекс',
      href: `https://travel.yandex.ru/search/?text=${q}&${UTM}`,
      partner: true,
    },
  ]
}

export function activityMapUrl(activity: {
  lat?: number
  lng?: number
  address?: string
  placeName?: string
  title: string
}): string | null {
  if (Number.isFinite(activity.lat) && Number.isFinite(activity.lng)) {
    return `https://yandex.ru/maps/?pt=${activity.lng},${activity.lat}&z=16&l=map`
  }
  const query = [activity.placeName, activity.address, activity.title].filter(Boolean).join(', ')
  return query ? `https://yandex.ru/maps/?text=${encodeURIComponent(query)}` : null
}
