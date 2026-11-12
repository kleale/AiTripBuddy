import type { GuideCurrency } from '@/data/resort-guides'

export const guideCurrencySymbols: Record<GuideCurrency, string> = {
  JPY: '¥',
  RUB: '₽',
  EUR: '€',
  GEL: '₾',
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 })

/** Цена скипасса в формате «4 250 ₽», «163,5 €», «70 ₾», «9 500 ¥». */
export function formatGuidePrice(value: number, currency: GuideCurrency): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  return `${numberFormat.format(value)} ${guideCurrencySymbols[currency]}`
}

/** Подпись «цена / день». */
export function formatGuideDayPrice(value: number, currency: GuideCurrency): string {
  const price = formatGuidePrice(value, currency)
  return price === '—' ? price : `${price} / день`
}