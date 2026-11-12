import type { GuidePoint } from '@/data/resort-guides'

export interface WeatherDay {
  /** YYYY-MM-DD */
  date: string
  weatherCode: number
  tempMax: number
  tempMin: number
  /** осадки, мм */
  precipitation: number
  /** свежий снег, см — Open-Meteo отдаёт snowfall в см */
  snowfallCm: number
  /** максимальный порыв ветра, км/ч */
  windGustKmh: number
}

export interface WeatherNow {
  temperature: number
  weatherCode: number
  windKmh: number
  /** высота снега по модели, см; null — нет данных */
  snowDepthCm: number | null
  observedAt: string
}

export interface WeatherReport {
  resortId: string
  fetchedAt: string
  now: WeatherNow | null
  days: WeatherDay[]
  /** какие даты поездки не попали в прогноз */
  missingDates: string[]
}

const WEATHER_CODES: Record<number, string> = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь',
  51: 'Слабая морось',
  53: 'Морось',
  55: 'Сильная морось',
  56: 'Ледяная морось',
  57: 'Сильная ледяная морось',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежная крупа',
  80: 'Небольшие ливни',
  81: 'Ливни',
  82: 'Сильные ливни',
  85: 'Снежные заряды',
  86: 'Сильные снежные заряды',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Сильная гроза с градом',
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀',
  1: '🌤',
  2: '⛅',
  3: '☁',
  45: '🌫',
  48: '🌫',
  51: '🌦',
  53: '🌦',
  55: '🌧',
  56: '🌧',
  57: '🌧',
  61: '🌧',
  63: '🌧',
  65: '🌧',
  66: '🌧',
  67: '🌧',
  71: '🌨',
  73: '🌨',
  75: '❄',
  77: '❄',
  80: '🌦',
  81: '🌧',
  82: '⛈',
  85: '🌨',
  86: '❄',
  95: '⛈',
  96: '⛈',
  99: '⛈',
}

export function weatherLabel(code: number): string {
  return WEATHER_CODES[code] ?? 'Погода'
}

export function weatherIcon(code: number): string {
  return WEATHER_ICONS[code] ?? '❔'
}

export interface OpenMeteoResponse {
  current?: {
    time?: string
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    snow_depth?: number | null
  }
  daily?: {
    time?: string[]
    weather_code?: number[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_sum?: number[]
    snowfall_sum?: number[]
    wind_gusts_10m_max?: number[]
  }
}

/** Разбор ответа Open-Meteo в доменную модель. */
export function parseWeather(payload: OpenMeteoResponse, resortId: string): WeatherReport {
  const daily = payload.daily
  const days: WeatherDay[] = []

  if (daily?.time) {
    daily.time.forEach((date, index) => {
      days.push({
        date,
        weatherCode: daily.weather_code?.[index] ?? 0,
        tempMax: Math.round(daily.temperature_2m_max?.[index] ?? 0),
        tempMin: Math.round(daily.temperature_2m_min?.[index] ?? 0),
        precipitation: daily.precipitation_sum?.[index] ?? 0,
        snowfallCm: daily.snowfall_sum?.[index] ?? 0,
        windGustKmh: Math.round(daily.wind_gusts_10m_max?.[index] ?? 0),
      })
    })
  }

  const current = payload.current
  const now: WeatherNow | null = current?.temperature_2m !== undefined
    ? {
        temperature: Math.round(current.temperature_2m),
        weatherCode: current.weather_code ?? 0,
        windKmh: Math.round(current.wind_speed_10m ?? 0),
        snowDepthCm:
          current.snow_depth === null || current.snow_depth === undefined
            ? null
            : Math.round(current.snow_depth * 100),
        observedAt: current.time ?? '',
      }
    : null

  return {
    resortId,
    fetchedAt: new Date().toISOString(),
    now,
    days,
    missingDates: [],
  }
}

/** Даты поездки, попавшие в прогноз — Open-Meteo даёт до 16 дней. */
export function pickTripDays(report: WeatherReport, checkIn?: string, checkOut?: string): WeatherDay[] {
  if (!checkIn || daysBetween(checkIn, checkOut ?? checkIn) < 0) return []
  const end = checkOut ?? checkIn
  return report.days.filter((day) => day.date >= checkIn && day.date <= end)
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return -1
  return Math.round((b - a) / 86_400_000)
}

/** URL Open-Meteo: прогноз на 16 дней от сегодня по координатам курорта. */
export function forecastUrl(point: GuidePoint): string {
  const params = new URLSearchParams({
    latitude: point.lat.toFixed(4),
    longitude: point.lng.toFixed(4),
    current: 'temperature_2m,weather_code,wind_speed_10m,snow_depth',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_gusts_10m_max',
    timezone: 'auto',
    forecast_days: '16',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

/* ---------- Deep links: погода, снег, инфраструктура без бэкенда ---------- */

export interface ForecastLinks {
  windy: string
  snowForecast: string
  osmSki: string
}

/**
 * Ссылки на внешние сервисы по координатам курорта.
 * Никаких API и парсинга: пользователь открывает свою вкладку,
 * приложение не хранит чужие данные.
 */
/**
 * Ссылки на прогноз и карты вокруг точки.
 * snowForecast строится по латинскому id курорта: кириллические названия
 * в slug не годятся, а Snow-forecast использует именно латинский слаг.
 */
export function forecastLinks(point: GuidePoint, resortId: string): ForecastLinks {
  const lat = point.lat.toFixed(4)
  const lng = point.lng.toFixed(4)
  const slug = slugify(resortId) || `${lat},${lng}`

  return {
    windy: `https://www.windy.com/${lat}/${lng}?${lat},${lng},11`,
    snowForecast: `https://www.snow-forecast.com/resorts/${encodeURIComponent(slug)}/6day`,
    osmSki: `https://www.openskimap.org/#15/${lat}/${lng}`,
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Ссылка на Overpass Turbo с готовым запросом POI вокруг точки.
 * Обычная страница OSM не умеет текстовый поиск по amenity, а Overpass умеет.
 */
export function osmPoiQuery(point: GuidePoint, amenity: string, radiusM = 2500): string {
  const query = `[out:json];node(around:${radiusM},${point.lat},${point.lng})[amenity=${amenity}];out;`
  const params = new URLSearchParams({
    Q: query,
    C: `${point.lat};${point.lng};15`,
  })
  return `https://overpass-turbo.eu/?${params.toString()}`
}