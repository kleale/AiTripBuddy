import type { Currency } from '@/types'

export const currencySymbols: Record<Currency, string> = {
  RUB: '₽',
  EUR: '€',
  USD: '$',
  GEL: '₾',
  KZT: '₸',
}

export const currencyLabels: Record<Currency, string> = {
  RUB: 'RUB · ₽',
  EUR: 'EUR · €',
  USD: 'USD · $',
  GEL: 'GEL · ₾',
  KZT: 'KZT · ₸',
}

const numberFormat = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return numberFormat.format(Math.round(value))
}

export function formatMoney(value: number, currency: Currency): string {
  return `${formatNumber(value)} ${currencySymbols[currency]}`
}

export function formatHours(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—'
  const totalMinutes = Math.round(value * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} мин`
  return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`
}
