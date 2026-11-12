import type { Currency } from '@/types'

/**
 * Курс EUR → валюта. Единственный источник правды для цен питания
 * и для конвертации сумм при смене валюты поездки.
 */
export const eurRate: Record<Currency, number> = {
  RUB: 100,
  EUR: 1,
  USD: 1.1,
  GEL: 2.8,
  KZT: 550,
}

/** Сколько рублей стоит одна единица валюты. */
export const rubRate: Record<Currency, number> = {
  RUB: 1,
  EUR: eurRate.RUB / eurRate.EUR,
  USD: eurRate.RUB / eurRate.USD,
  GEL: eurRate.RUB / eurRate.GEL,
  KZT: eurRate.RUB / eurRate.KZT,
}

/** Пересчёт денежной суммы из одной валюты в другую (до копеек). */
export function convertAmount(amount: number, from: Currency, to: Currency): number {
  if (!Number.isFinite(amount) || from === to) return amount
  const converted = (amount * rubRate[from]) / rubRate[to]
  return Math.round(converted * 100) / 100
}