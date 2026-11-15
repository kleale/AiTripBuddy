import { describe, expect, it } from 'vitest'
import {
  altitudePoints,
  forecastLinks,
  forecastUrl,
  osmPoiQuery,
  parseWeather,
  pickTripDays,
  weatherIcon,
  weatherLabel,
  weekDays,
  type OpenMeteoResponse,
} from '@/lib/weather'
import type { GuideZone } from '@/data/resort-guides'

const payload: OpenMeteoResponse = {
  current: {
    time: '2026-11-12T09:00',
    temperature_2m: -3.4,
    weather_code: 73,
    wind_speed_10m: 12.6,
    snow_depth: 1.45,
  },
  daily: {
    time: ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'],
    weather_code: [73, 3, 0, 71],
    temperature_2m_max: [-1.2, -2.6, 0.4, -4.8],
    temperature_2m_min: [-7.8, -9.1, -6.2, -12.4],
    precipitation_sum: [4.2, 0, 0, 2.1],
    snowfall_sum: [6.5, 0, 0, 3.2],
    wind_gusts_10m_max: [28, 35, 18, 52],
  },
}

describe('погода: разбор ответа Open-Meteo', () => {
  it('читает текущую погоду и высоту снега', () => {
    const report = parseWeather(payload, 'hakuba')
    expect(report.now?.temperature).toBe(-3)
    expect(report.now?.weatherCode).toBe(73)
    expect(report.now?.windKmh).toBe(13)
    expect(report.now?.snowDepthCm).toBe(145)
  })

  it('переводит дневные ряды в дни', () => {
    const report = parseWeather(payload, 'hakuba')
    expect(report.days).toHaveLength(4)
    expect(report.days[0]).toEqual({
      date: '2026-11-12',
      weatherCode: 73,
      tempMax: -1,
      tempMin: -8,
      precipitation: 4.2,
      snowfallCm: 6.5,
      windGustKmh: 28,
    })
  })

  it('не падает на пустом ответе', () => {
    const report = parseWeather({}, 'hakuba')
    expect(report.now).toBeNull()
    expect(report.days).toEqual([])
  })

  it('не выдумывает высоту снега, если её нет', () => {
    const report = parseWeather(
      { current: { temperature_2m: 0, weather_code: 0, wind_speed_10m: 1, snow_depth: null } },
      'hakuba',
    )
    expect(report.now?.snowDepthCm).toBeNull()
  })

  it('сохраняет id курорта', () => {
    expect(parseWeather(payload, 'hakuba').resortId).toBe('hakuba')
  })
})

describe('погода: подписи', () => {
  it('знает основные коды', () => {
    expect(weatherLabel(0)).toBe('Ясно')
    expect(weatherLabel(73)).toBe('Снег')
    expect(weatherLabel(75)).toBe('Сильный снег')
    expect(weatherLabel(95)).toBe('Гроза')
  })

  it('не падает на неизвестном коде', () => {
    expect(weatherLabel(1234)).toBe('Погода')
    expect(weatherIcon(1234)).toBe('❔')
  })

  it('даёт иконку для снега', () => {
    expect(weatherIcon(75)).toBe('❄')
  })
})

describe('погода: даты поездки', () => {
  const report = parseWeather(payload, 'hakuba')

  it('выбирает дни внутри диапазона', () => {
    const days = pickTripDays(report, '2026-11-13', '2026-11-14')
    expect(days.map((day) => day.date)).toEqual(['2026-11-13', '2026-11-14'])
  })

  it('включает границы диапазона', () => {
    expect(pickTripDays(report, '2026-11-12', '2026-11-12')).toHaveLength(1)
  })

  it('возвращает пусто, если даты вне прогноза', () => {
    expect(pickTripDays(report, '2026-12-01', '2026-12-05')).toEqual([])
  })

  it('возвращает пусто без дат', () => {
    expect(pickTripDays(report)).toEqual([])
  })

  it('не падает на невалидных датах', () => {
    expect(pickTripDays(report, 'мусор', 'тоже')).toEqual([])
  })
})

describe('погода: запрос и ссылки', () => {
  it('строит URL Open-Meteo с координатами и 16 днями', () => {
    const url = forecastUrl({ lat: 36.6945, lng: 137.8325 })
    expect(url).toContain('api.open-meteo.com')
    expect(url).toContain('latitude=36.6945')
    expect(url).toContain('longitude=137.8325')
    expect(url).toContain('forecast_days=16')
    expect(url).toContain('snow_depth')
    expect(url).toContain('timezone=auto')
  })

  it('ссылки содержат координаты курорта', () => {
    const links = forecastLinks({ lat: 36.6945, lng: 137.8325 }, 'hakuba')
    expect(links.windy).toContain('36.6945')
    expect(links.windy).toContain('137.8325')
    expect(links.osmSki).toMatch(/^https:\/\//)
  })

  it('snow-forecast строится по латинскому id, а не по кириллическому названию', () => {
    const links = forecastLinks({ lat: 36.6945, lng: 137.8325 }, 'hakuba')
    expect(links.snowForecast).toContain('/resorts/hakuba/')
  })

  it('кириллический id не превращается в пустой slug', () => {
    const links = forecastLinks({ lat: 36.6945, lng: 137.8325 }, 'Долина Хакуба')
    expect(links.snowForecast).not.toContain('/resorts//')
    expect(links.snowForecast).toContain('36.6945')
  })

  it('POI-ссылка ведёт на Overpass Turbo с запросом amenity', () => {
    const url = osmPoiQuery({ lat: 36.6945, lng: 137.8325 }, 'cafe')
    expect(url).toContain('overpass-turbo.eu')
    expect(url).toContain('amenity%3Dcafe')
    expect(url).toContain('around')
  })
})

describe('прогноз по высотам', () => {
  const zone: GuideZone = {
    id: 'main',
    name: 'Горки Город',
    baseAltitude: 540,
    topAltitude: 2320,
    lifts: 18,
    trailsKm: { green: 0, blue: 0, red: 0, black: 0 },
    passPrice: 4900,
    passCurrency: 'RUB',
    base: { lat: 43.585, lng: 40.25 },
    summit: { lat: 43.565, lng: 40.265 },
  }

  it('строит три варианта: база, середина, вершина', () => {
    const points = altitudePoints(zone)
    expect(points.map((point) => point.id)).toEqual(['base', 'mid', 'summit'])
    expect(points.map((point) => point.altitude)).toEqual([540, 1430, 2320])
    expect(points[0]?.label).toBe('База')
    expect(points[2]?.label).toBe('Вершина')
  })

  it('координаты середины — среднее между базой и вершиной', () => {
    const mid = altitudePoints(zone)[1]
    expect(mid?.point.lat).toBeCloseTo(43.575)
    expect(mid?.point.lng).toBeCloseTo(40.2575)
  })

  it('передаёт высоту в Open-Meteo, чтобы температура считалась для склона', () => {
    const url = forecastUrl(zone.base, zone.baseAltitude)
    expect(url).toContain('elevation=540')
    expect(forecastUrl(zone.base)).not.toContain('elevation=')
  })

  it('неделя — первые семь дней прогноза', () => {
    const report = parseWeather(payload, 'hakuba')
    report.days = Array.from({ length: 10 }, (_, index) => ({
      ...(report.days[0] as (typeof report.days)[number]),
      date: `2027-01-${String(index + 1).padStart(2, '0')}`,
    }))
    const days = weekDays(report)
    expect(days).toHaveLength(7)
    expect(days[0]?.date).toBe('2027-01-01')
    expect(days[6]?.date).toBe('2027-01-07')
  })

  it('короткий прогноз не добивается пустыми днями', () => {
    expect(weekDays(parseWeather(payload, 'hakuba'))).toHaveLength(4)
  })
})