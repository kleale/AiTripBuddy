import { describe, expect, it } from 'vitest'
import { cities, findCity } from '@/data/cities'
import { resorts, findResort } from '@/data/resorts'
import {
  MAX_TRANSFER_KM,
  airportSuggestions,
  airportsNearCity,
  nearbyAirports,
  resortDistanceFromAirport,
  resortsForAirport,
} from '@/data/resort-airports'
import { foodPerDay, mealOptions } from '@/data/meals'

describe('целостность справочников', () => {
  it('у всех курортов есть хотя бы один аэропорт', () => {
    const missing = resorts.filter((resort) => nearbyAirports(resort.id).length === 0)
    expect(missing.map((r) => r.id)).toEqual([])
  })

  it('все аэропорты в связках существуют', () => {
    const broken: string[] = []
    for (const resort of resorts) {
      for (const item of nearbyAirports(resort.id)) {
        if (!findCity(item.cityId)) broken.push(`${resort.id} → ${item.cityId}`)
      }
    }
    expect(broken).toEqual([])
  })

  it('нет дублей кодов аэропортов', () => {
    const seen = new Map<string, string[]>()
    for (const city of cities) {
      const list = seen.get(city.code) ?? []
      list.push(city.id)
      seen.set(city.code, list)
    }
    const duplicates = [...seen.entries()].filter(([, ids]) => ids.length > 1)
    expect(duplicates).toEqual([])
  })

  it('все ключи связок соответствуют реальным курортам', () => {
    const ids = new Set(resorts.map((r) => r.id))
    const extra: string[] = []
    for (const resort of resorts) {
      if (!ids.has(resort.id)) extra.push(resort.id)
    }
    expect(extra).toEqual([])
  })
})

describe('подбор курортов по аэропорту', () => {
  it('из Токио не предлагает Шерегеш', () => {
    const list = resortsForAirport('tokyo-nrt')
    expect(list.some((item) => item.resortId === 'sheregesh')).toBe(false)
  })

  it('из Инсбрука предлагает Ишгль в пределах трансфера', () => {
    const list = resortsForAirport('innsbruck-inn')
    const ischgl = list.find((item) => item.resortId === 'ischgl')
    expect(ischgl).toBeDefined()
    expect(ischgl?.km).toBe(100)
    expect(ischgl?.access).toBe('transfer')
  })

  it('из Инсбрука видит итальянские курорты как приграничный трансфер', () => {
    const list = resortsForAirport('innsbruck-inn')
    expect(list.some((item) => item.resortId === 'val-gardena')).toBe(true)
  })

  it('дальние хабы помечены как hub', () => {
    const list = resortsForAirport('tokyo-nrt')
    const niseko = list.find((item) => item.resortId === 'niseko')
    expect(niseko?.access).toBe('hub')
  })

  it('не предлагает курорты дальше лимита без явной связки', () => {
    const list = resortsForAirport('dubai-dxb')
    expect(list).toEqual([])
  })

  it('сортирует трансферы перед хабами и по расстоянию', () => {
    const list = resortsForAirport('tokyo-nrt')
    const firstHub = list.findIndex((item) => item.access === 'hub')
    if (firstHub > 0) {
      const before = list.slice(0, firstHub)
      expect(before.every((item) => item.access === 'transfer')).toBe(true)
      expect(before.every((item) => item.km <= MAX_TRANSFER_KM)).toBe(true)
    }
  })
})

describe('расстояния по курортам', () => {
  it('берёт точное расстояние из таблицы', () => {
    const item = resortDistanceFromAirport('ischgl', 'innsbruck-inn')
    expect(item?.exact).toBe(true)
    expect(item?.km).toBe(100)
  })

  it('оценивает расстояние по координатам, если связки нет', () => {
    const item = resortDistanceFromAirport('bad-gastein', 'innsbruck-inn')
    expect(item?.exact).toBe(false)
    expect(item?.km).toBeGreaterThan(0)
  })

  it('возвращает null для неизвестных id', () => {
    expect(resortDistanceFromAirport('nope', 'innsbruck-inn')).toBeNull()
    expect(resortDistanceFromAirport('ischgl', 'nope')).toBeNull()
  })

  it('подсказки аэропортов содержат город и курорт', () => {
    const suggestions = airportSuggestions('ischgl')
    expect(suggestions[0]?.city.code).toBe('INN')
    expect(suggestions[0]?.resortName).toBe('Ишгль')
  })
})

describe('питание', () => {
  it('дороже в Швейцарии, чем в России', () => {
    const meals = { breakfast: 'hotel', lunch: 'cafe', dinner: 'slope' } as const
    const swiss = foodPerDay('zermatt', meals, 'EUR')
    const russian = foodPerDay('sheregesh', meals, 'EUR')
    expect(swiss).toBeGreaterThan(russian)
  })

  it('нулевое питание при всех none', () => {
    const meals = { breakfast: 'none', lunch: 'none', dinner: 'none' } as const
    expect(foodPerDay('zermatt', meals, 'RUB')).toBe(0)
  })

  it('пересчитывает цену в валюту поездки', () => {
    const meals = { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' } as const
    expect(foodPerDay('ischgl', meals, 'RUB')).toBeGreaterThan(foodPerDay('ischgl', meals, 'EUR'))
  })

  it('содержит четыре варианта питания', () => {
    expect(mealOptions.map((o) => o.key)).toEqual(['none', 'hotel', 'cafe', 'slope'])
  })
})

describe('справочник курортов', () => {
  it('находит известный курорт', () => {
    expect(findResort('niseko')?.country).toBe('Япония')
  })
})

describe('аэропорты: полнота и корректность', () => {
  const countryBox: Record<string, [number, number, number, number]> = {
    'Россия': [41, 82, 19, 180],
    'Беларусь': [51, 57, 23, 33],
    'Казахстан': [40, 56, 46, 88],
    'Грузия': [41, 44, 40, 47],
    'Армения': [38, 42, 43, 47],
    'Азербайджан': [38, 42, 44, 51],
    'Узбекистан': [37, 46, 55, 74],
    'Кыргызстан': [39, 44, 69, 81],
    'Турция': [35, 43, 25, 45],
    'ОАЭ': [22, 27, 51, 57],
    'Катар': [24, 27, 50, 52],
    'Израиль': [29, 34, 34, 36],
    'Польша': [49, 55, 14, 25],
    'Литва': [53, 57, 20, 27],
    'Латвия': [55, 59, 20, 29],
    'Эстония': [57, 60, 21, 29],
    'Финляндия': [59, 71, 19, 32],
    'Чехия': [48, 52, 12, 19],
    'Венгрия': [45, 49, 16, 23],
    'Австрия': [46, 50, 9, 18],
    'Германия': [47, 56, 5, 16],
    'Швейцария': [45, 48, 5, 11],
    'Италия': [36, 48, 6, 19],
    'Франция': [41, 52, -6, 10],
    'Болгария': [41, 45, 22, 29],
    'Румыния': [43, 49, 20, 30],
    'Сербия': [42, 47, 18, 24],
    'Хорватия': [42, 47, 13, 20],
    'Словения': [45, 47, 13, 17],
    'Босния': [42, 46, 15, 20],
    'Македония': [40, 43, 20, 24],
    'Албания': [39, 43, 19, 21],
    'Черногория': [41, 44, 18, 21],
    'Испания': [35, 44, -10, 5],
    'Великобритания': [49, 61, -9, 2],
    'Нидерланды': [50, 54, 3, 8],
    'Норвегия': [57, 72, 4, 32],
    'Швеция': [55, 70, 10, 25],
    'Япония': [24, 46, 122, 146],
    'Южная Корея': [33, 39, 124, 132],
    'США': [24, 50, -125, -66],
    'Канада': [41, 84, -142, -52],
    'Словакия': [47, 50, 16, 23],
  }

  it('все аэропорты лежат внутри границ своей страны', () => {
    const outside = cities.filter((city) => {
      const box = countryBox[city.country]
      if (!box) return false
      const [minLat, maxLat, minLng, maxLng] = box
      return city.lat < minLat || city.lat > maxLat || city.lng < minLng || city.lng > maxLng
    })
    expect(outside.map((city) => `${city.code} ${city.city} ${city.lat},${city.lng}`)).toEqual([])
  })

  it('у всех аэропортов корректный IATA и координаты', () => {
    const bad = cities.filter(
      (city) =>
        !/^[A-Z]{3}$/.test(city.code) ||
        !Number.isFinite(city.lat) ||
        !Number.isFinite(city.lng) ||
        Math.abs(city.lat) > 90 ||
        Math.abs(city.lng) > 180,
    )
    expect(bad.map((city) => city.id)).toEqual([])
  })

  it('есть Ханэда (HND) и Нарита (NRT) в Токио', () => {
    const haneda = cities.find((city) => city.code === 'HND')
    const narita = cities.find((city) => city.code === 'NRT')
    expect(haneda?.city).toBe('Токио')
    expect(haneda?.airport).toBe('Ханэда')
    expect(narita?.city).toBe('Токио')
    expect(haneda?.lat).toBeCloseTo(35.55, 1)
    expect(haneda?.lng).toBeCloseTo(139.78, 1)
  })

  it('ключевые горнолыжные аэропорты на месте', () => {
    const expected = ['SVO', 'LED', 'AER', 'MRV', 'INN', 'SZG', 'MUC', 'ZRH', 'GVA', 'CMF', 'GNB', 'LYS', 'TRN', 'VRN', 'BZO', 'BCN', 'TLS', 'OSL', 'ARN', 'KTT', 'RVN', 'CTS', 'HND', 'NRT', 'ICN', 'DEN', 'SLC', 'EGE', 'YVR', 'YYC']
    const codes = new Set(cities.map((city) => city.code))
    expect(expected.filter((code) => !codes.has(code))).toEqual([])
  })

  it('новые аэропорты привязаны к курортам', () => {
    expect(nearbyAirports('niseko').some((item) => item.cityId === 'tokyo-hnd')).toBe(true)
    expect(nearbyAirports('nozawa').some((item) => item.cityId === 'niigata-kij')).toBe(true)
    expect(nearbyAirports('livigno').some((item) => item.cityId === 'brescia-vbs')).toBe(true)
    expect(nearbyAirports('grandvalira').some((item) => item.cityId === 'girona-gro')).toBe(true)
    expect(nearbyAirports('formigal').some((item) => item.cityId === 'pamplona-pna')).toBe(true)
    expect(nearbyAirports('mammoth').some((item) => item.cityId === 'mammoth-mmh')).toBe(true)
  })

  it('из Ханэды можно добраться до японских курортов', () => {
    const list = resortsForAirport('tokyo-hnd')
    expect(list.some((item) => item.resortId === 'hakuba')).toBe(true)
    expect(list.some((item) => item.resortId === 'nozawa')).toBe(true)
  })
})

describe('аэропорты рядом с городом', () => {
  it('возвращает аэропорты страны по расстоянию', () => {
    const list = airportsNearCity('innsbruck-inn', 5)
    expect(list.length).toBeGreaterThan(1)
    expect(list[0]?.city.id).toBe('innsbruck-inn')
    expect(list.every((item, index) => index === 0 || item.km >= (list[index - 1]?.km ?? 0))).toBe(true)
  })

  it('для неизвестного города — пусто', () => {
    expect(airportsNearCity('nope')).toEqual([])
  })
})


describe('горнолыжные курорты Японии', () => {
  const japan = resorts.filter((resort) => resort.country === 'Япония')

  it('в базе не меньше 25 курортов Японии', () => {
    expect(japan.length).toBeGreaterThanOrEqual(25)
  })

  it('у каждого японского курорта есть аэропорт', () => {
    expect(japan.filter((resort) => nearbyAirports(resort.id).length === 0).map((r) => r.id)).toEqual([])
  })

  it('Хоккайдо добирается из Саппоро или Асахикавы', () => {
    const hokkaido = japan.filter((resort) => resort.region === 'Хоккайдо')
    const broken = hokkaido.filter(
      (resort) =>
        !nearbyAirports(resort.id).some((item) => item.cityId === 'sapporo-cts') &&
        !nearbyAirports(resort.id).some((item) => item.cityId === 'asahikawa-akj'),
    )
    expect(broken.map((r) => r.id)).toEqual([])
  })

  it('новые курорты Тохоку доступны из Сендая', () => {
    const tohoku = ['zao', 'appi', 'geto', 'shizukuishi', 'tazawako', 'onikoube', 'alts-bandai', 'grandeco']
    for (const id of tohoku) {
      expect(nearbyAirports(id).some((item) => item.cityId === 'sendai-sdj')).toBe(true)
    }
  })

  it('новые аэропорты Хоккайдо и Тохоку в справочнике', () => {
    const codes = new Set(cities.map((city) => city.code))
    expect(['AKJ', 'OBO', 'HKD', 'AOJ', 'AXT', 'SDJ', 'HNA', 'GAJ', 'FKS', 'KMQ'].filter((code) => !codes.has(code))).toEqual([])
  })

  it('из Токио виден весь Нагано и Ниигата', () => {
    const list = resortsForAirport('tokyo-hnd')
    const ids = new Set(list.map((item) => item.resortId))
    for (const id of ['hakuba', 'nozawa', 'shiga-kogen', 'myoko', 'naeba', 'yuzawa', 'madarao']) {
      expect(ids.has(id)).toBe(true)
    }
  })
})


describe('курорты России', () => {
  const russia = resorts.filter((resort) => resort.country === 'Россия')

  it('в базе не меньше 24 курортов России', () => {
    expect(russia.length).toBeGreaterThanOrEqual(24)
  })

  it('у каждого российского курорта есть аэропорт', () => {
    expect(russia.filter((resort) => nearbyAirports(resort.id).length === 0).map((r) => r.id)).toEqual([])
  })

  it('все координаты внутри границ России', () => {
    const outside = russia.filter(
      (resort) => resort.lat < 41 || resort.lat > 82 || resort.lng < 19 || resort.lng > 180,
    )
    expect(outside.map((r) => r.id)).toEqual([])
  })

  it('новые курорты доступны из своих аэропортов', () => {
    expect(nearbyAirports('manzherok')[0]?.cityId).toBe('gorno-altaysk-rgk')
    expect(nearbyAirports('volchikha')[0]?.cityId).toBe('ekb-svx')
    expect(nearbyAirports('tsey')[0]?.cityId).toBe('vladikavkaz-ogz')
    expect(nearbyAirports('veduchi')[0]?.cityId).toBe('grozny-grv')
    expect(nearbyAirports('gorny-vozdukh')[0]?.cityId).toBe('yuzhno-sakhalinsk-uus')
    expect(nearbyAirports('igora')[0]?.cityId).toBe('spb-led')
    expect(nearbyAirports('sorochany')[0]?.cityId).toBe('moscow-svo')
  })

  it('новые аэропорты в справочнике', () => {
    const codes = new Set(cities.map((city) => city.code))
    expect(['OGZ', 'GRV', 'UUS'].filter((code) => !codes.has(code))).toEqual([])
  })

  it('из Сочи не видно курортов Кавказа другой страны', () => {
    expect(resortsForAirport('sochi-aer').some((item) => item.km > 400)).toBe(false)
  })
})

describe('курорты Грузии', () => {
  const georgia = resorts.filter((resort) => resort.country === 'Грузия')

  it('в базе 5 курортов Грузии', () => {
    expect(georgia.length).toBe(5)
  })

  it('у каждого грузинского курорта есть аэропорт', () => {
    expect(georgia.filter((resort) => nearbyAirports(resort.id).length === 0).map((r) => r.id)).toEqual([])
  })

  it('все координаты внутри Грузии', () => {
    const outside = georgia.filter(
      (resort) => resort.lat < 41 || resort.lat > 44 || resort.lng < 40 || resort.lng > 47,
    )
    expect(outside.map((r) => r.id)).toEqual([])
  })

  it('Гудаури, Бакуриани и Хацвали доступны из Тбилиси или Кутаиси', () => {
    for (const id of ['gudauri', 'bakuriani', 'hatsvali']) {
      const has = nearbyAirports(id).some(
        (item) => item.cityId === 'tbilisi-tbs' || item.cityId === 'kutaisi-kut',
      )
      expect(has).toBe(true)
    }
  })

  it('из Тбилиси видны все грузинские курорты', () => {
    const ids = new Set(resortsForAirport('tbilisi-tbs').map((item) => item.resortId))
    for (const id of ['gudauri', 'bakuriani', 'goderzi', 'mestia', 'hatsvali']) {
      expect(ids.has(id)).toBe(true)
    }
  })
})

describe('города Японии и России', () => {
  it('Фудзикавагутико есть в справочнике', () => {
    const city = findCity('fujikawaguchiko-fsz')
    expect(city?.city).toBe('Фудзикавагутико')
    expect(city?.country).toBe('Япония')
    expect(city?.code).toBe('FSZ')
  })

  it('крупные города Японии добавлены', () => {
    for (const code of ['KIX', 'UKY', 'FUK', 'OKA', 'HIJ', 'NGS', 'KMJ', 'KOJ', 'KMI', 'OKJ', 'TAK', 'MYJ', 'KCZ']) {
      expect(cities.some((city) => city.code === code)).toBe(true)
    }
    expect(cities.filter((city) => city.country === 'Япония').length).toBeGreaterThanOrEqual(30)
  })

  it('крупные города России добавлены', () => {
    for (const code of ['VOZ', 'ROV', 'GSV', 'TOF', 'REN', 'IJK', 'BZK', 'EGO', 'IAR', 'CEE', 'KYZ', 'LPK', 'PKV', 'PES', 'SCW', 'HTA', 'BQS', 'MCX', 'ASF', 'URS', 'TBW', 'NSK', 'HMA', 'NJC', 'NUX', 'SLY', 'GDX', 'DYR', 'MJZ']) {
      expect(cities.some((city) => city.code === code)).toBe(true)
    }
    expect(cities.filter((city) => city.country === 'Россия').length).toBeGreaterThanOrEqual(60)
  })
})
