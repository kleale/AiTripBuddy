import type { Resort } from '@/data/resorts'
import { resorts } from '@/data/resorts'
import { hasGuide } from '@/data/resort-guides'
import { resortSeason } from '@/data/resort-season'

export interface CatalogFilters {
  query: string
  country: string
  month: number | null
  guideOnly: boolean
}

export const emptyFilters: CatalogFilters = {
  query: '',
  country: '',
  month: null,
  guideOnly: false,
}

/** Поиск по названию/региону/стране + страна, месяц сезона и «только с гидом». */
export function filterResorts(filters: CatalogFilters, source: Resort[] = resorts): Resort[] {
  const query = filters.query.trim().toLowerCase()

  return source
    .filter((resort) => {
      if (query) {
        const haystack = `${resort.name} ${resort.region} ${resort.country}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      if (filters.country && resort.country !== filters.country) return false
      if (filters.guideOnly && !hasGuide(resort.id)) return false
      if (filters.month !== null) {
        const season = resortSeason(resort)
        if (!season.months.includes(filters.month)) return false
      }
      return true
    })
    .sort((a, b) => {
      const guideA = hasGuide(a.id) ? 0 : 1
      const guideB = hasGuide(b.id) ? 0 : 1
      if (guideA !== guideB) return guideA - guideB
      return a.name.localeCompare(b.name, 'ru')
    })
}

export function catalogCountries(source: Resort[] = resorts): string[] {
  return [...new Set(source.map((resort) => resort.country))].sort((a, b) => a.localeCompare(b, 'ru'))
}