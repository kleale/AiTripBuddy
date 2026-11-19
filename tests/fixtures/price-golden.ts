import { resorts } from '@/data/resorts'
import type { Currency } from '@/types'
import type { PriceHintKind } from '@/lib/price-hints'

export interface PriceGoldenCase {
  id: string
  kind: PriceHintKind
  resortId: string
  country: string
  stars: number
  checkIn: string
  currency: Currency
}

const currencies: Currency[] = ['RUB', 'EUR', 'USD', 'KZT']
const dates = ['2027-01-15', '2027-02-20', '2027-03-10', '2027-12-28']

const generated: PriceGoldenCase[] = resorts.slice(0, 15).flatMap((resort, index) => {
  const currency = currencies[index % currencies.length] ?? 'RUB'
  const checkIn = dates[index % dates.length] ?? '2027-01-15'
  return [
    {
      id: `hotel-${resort.id}`,
      kind: 'hotel' as const,
      resortId: resort.id,
      country: resort.country,
      stars: 2 + (index % 4),
      checkIn,
      currency,
    },
    {
      id: `skipass-${resort.id}`,
      kind: 'skipass' as const,
      resortId: resort.id,
      country: resort.country,
      stars: 3,
      checkIn,
      currency,
    },
    {
      id: `hotel-alt-${resort.id}`,
      kind: 'hotel' as const,
      resortId: resort.id,
      country: resort.country,
      stars: 3 + (index % 3),
      checkIn: dates[(index + 1) % dates.length] ?? '2027-02-20',
      currency: currencies[(index + 2) % currencies.length] ?? 'RUB',
    },
    {
      id: `pass-alt-${resort.id}`,
      kind: 'skipass' as const,
      resortId: resort.id,
      country: resort.country,
      stars: 3,
      checkIn: dates[(index + 2) % dates.length] ?? '2027-03-10',
      currency: currencies[(index + 1) % currencies.length] ?? 'EUR',
    },
  ]
})

/** 50 запросов: 15 курортов × 4 сценария минус лишние. */
export const priceGoldenSet: PriceGoldenCase[] = generated.slice(0, 50)
