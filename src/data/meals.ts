import type { Currency, MealKey, Meals } from '@/types'
import { eurRate } from '@/lib/currency'
import { findResort } from './resorts'

export interface MealOption {
  key: MealKey
  label: string
}

export const mealOptions: MealOption[] = [
  { key: 'none', label: 'Не включён' },
  { key: 'hotel', label: 'В отеле' },
  { key: 'cafe', label: 'Кафе рядом' },
  { key: 'slope', label: 'На склоне' },
]

export const defaultMeals: Meals = {
  breakfast: 'hotel',
  lunch: 'cafe',
  dinner: 'cafe',
}

/** Базовая цена приёма пищи на человека в EUR. */
const basePrice: Record<MealKey, Record<keyof Meals, number>> = {
  none: { breakfast: 0, lunch: 0, dinner: 0 },
  hotel: { breakfast: 12, lunch: 18, dinner: 24 },
  cafe: { breakfast: 8, lunch: 14, dinner: 18 },
  slope: { breakfast: 10, lunch: 22, dinner: 26 },
}

/** Множитель уровня цен по стране курорта. */
const countryTier: Record<string, number> = {
  Россия: 1,
  Беларусь: 0.9,
  Казахстан: 0.9,
  Кыргызстан: 0.8,
  Узбекистан: 0.7,
  Грузия: 0.85,
  Армения: 0.85,
  Азербайджан: 0.85,
  Турция: 0.95,
  Франция: 2.1,
  Швейцария: 3.2,
  Австрия: 2.2,
  Италия: 1.8,
  Германия: 2.1,
  Словения: 1.1,
  Словакия: 0.9,
  Польша: 0.9,
  Чехия: 1,
  Болгария: 0.9,
  Румыния: 0.9,
  Хорватия: 1.2,
  Босния: 0.85,
  Черногория: 1,
  Сербия: 0.9,
  Андорра: 1.6,
  Испания: 1.6,
  Норвегия: 2.6,
  Швеция: 2.4,
  Финляндия: 2.5,
  Япония: 2.2,
  'Южная Корея': 1.8,
  США: 3,
  Канада: 2.8,
}

export function mealCountryTier(resortId: string, country?: string): number {
  const name = country || findResort(resortId)?.country
  if (!name) return 1
  return countryTier[name] ?? 1.2
}

/** Цена одного приёма пищи на человека в валюте поездки. */
export function mealPrice(
  resortId: string,
  meal: keyof Meals,
  key: MealKey,
  currency: Currency,
  country?: string,
): number {
  const tier = mealCountryTier(resortId, country)
  return Math.round(basePrice[key][meal] * tier * eurRate[currency])
}

/** Стоимость питания на человека в день. */
export function foodPerDay(
  resortId: string,
  meals: Meals,
  currency: Currency,
  country?: string,
): number {
  return (
    mealPrice(resortId, 'breakfast', meals.breakfast, currency, country) +
    mealPrice(resortId, 'lunch', meals.lunch, currency, country) +
    mealPrice(resortId, 'dinner', meals.dinner, currency, country)
  )
}

export function mealsIncluded(meals: Meals): boolean {
  return meals.breakfast !== 'none' || meals.lunch !== 'none' || meals.dinner !== 'none'
}