import { cities, findCity, type City } from './cities'
import { findResort, resorts } from './resorts'
import { distanceKm } from '@/lib/geo'

export type AirportAccess = 'transfer' | 'hub'

export interface ResortAirport {
  /** id аэропорта из data/cities.ts */
  cityId: string
  /** расстояние по дороге, км */
  km: number
  /** ориентировочное время трансфера, ч */
  hours: number
  /**
   * transfer — прямой наземный трансфер,
   * hub — дальний хаб (нужен ещё один перелёт или поезд), не трансфер.
   */
  access?: AirportAccess
}

/** Дальше этого расстояния курорт не считается прямым трансфером из аэропорта. */
export const MAX_TRANSFER_KM = 400

const flight = (cityId: string, km: number, hours: number): ResortAirport => ({ cityId, km, hours })
const hub = (cityId: string, km: number, hours: number): ResortAirport => ({
  cityId,
  km,
  hours,
  access: 'hub',
})

export const resortAirports: Record<string, ResortAirport[]> = {
  // Россия
  'krasnaya-polyana': [flight('sochi-aer', 45, 1), flight('krasnodar-krr', 280, 4.5)],
  sheregesh: [
    flight('novokuznetsk-noz', 170, 3),
    flight('kemerovo-kej', 200, 3.5),
    flight('abakan-aba', 250, 4.5),
    hub('novosibirsk-ovb', 450, 6.5),
  ],
  dombay: [flight('minvody-mrv', 170, 3), flight('stavropol-stw', 220, 4), flight('krasnodar-krr', 300, 5)],
  elbrus: [flight('nalchik-nal', 120, 2.5), flight('minvody-mrv', 160, 3), flight('krasnodar-krr', 350, 5.5)],
  arkhyz: [flight('minvody-mrv', 180, 3), flight('stavropol-stw', 200, 3.5), flight('krasnodar-krr', 280, 4.5)],
  kirovsk: [flight('murmansk-mmk', 200, 3)],
  abzakovo: [flight('magnitogorsk-mqf', 60, 1.2), flight('ufa-ufa', 250, 4), flight('chelyabinsk-cek', 300, 4.5)],
  'solnechnaya-dolina': [
    flight('chelyabinsk-cek', 120, 2),
    flight('magnitogorsk-mqf', 200, 3.2),
    flight('ufa-ufa', 350, 5),
  ],
  belokurikha: [flight('gorno-altaysk-rgk', 100, 2), flight('barnaul-bax', 120, 2.2), hub('novosibirsk-ovb', 400, 5.5)],
  baikalsk: [flight('irkutsk-ikt', 150, 2.5), flight('ulan-ude-uud', 250, 4)],

  // Кавказ и Закавказье
  gudauri: [flight('tbilisi-tbs', 120, 2), flight('kutaisi-kut', 300, 5.5)],
  bakuriani: [flight('tbilisi-tbs', 180, 3), flight('kutaisi-kut', 200, 3.5)],
  goderzi: [flight('batumi-bus', 100, 2.5), flight('kutaisi-kut', 180, 3.5), flight('tbilisi-tbs', 250, 5)],
  mestia: [flight('kutaisi-kut', 200, 4), hub('tbilisi-tbs', 400, 7)],
  tsakhkadzor: [flight('yerevan-evn', 75, 1.2)],

  // Центральная Азия
  shymbulak: [flight('almaty-ala', 30, 0.8)],
  karakol: [hub('bishkek-fru', 400, 6), hub('osh-oss', 500, 7)],
  chimgan: [flight('tashkent-tas', 80, 1.5)],

  // Турция
  palandoken: [flight('erzurum-erz', 15, 0.4)],
  kartalkaya: [flight('ankara-esb', 150, 2.5), flight('istanbul-ist', 300, 4), flight('kayseri-asr', 300, 4)],
  uludag: [flight('istanbul-ist', 150, 2.5), flight('ankara-esb', 350, 4.5), flight('izmir-adb', 330, 4.5)],
  sarikamis: [flight('kars-ksy', 60, 1.2), flight('erzurum-erz', 200, 3.5)],

  // Франция
  chamonix: [flight('geneva-gva', 90, 1.5), flight('grenoble-gnb', 200, 2.8), flight('lyon-lys', 220, 2.8)],
  'val-thorens': [flight('chambery-cmf', 110, 2), flight('grenoble-gnb', 120, 2.2), flight('lyon-lys', 190, 3)],
  'les-deux-alpes': [flight('grenoble-gnb', 70, 1.3), flight('lyon-lys', 150, 2.3), flight('chambery-cmf', 140, 2.5), flight('marseille-mrs', 260, 3.6)],
  tignes: [flight('chambery-cmf', 140, 2.5), flight('grenoble-gnb', 160, 2.6), flight('lyon-lys', 220, 3.2)],
  'val-disere': [flight('chambery-cmf', 140, 2.5), flight('grenoble-gnb', 160, 2.6), flight('lyon-lys', 220, 3.2)],
  'les-arcs': [flight('chambery-cmf', 110, 2), flight('lyon-lys', 200, 3), flight('grenoble-gnb', 140, 2.4)],
  'la-plagne': [flight('chambery-cmf', 110, 2), flight('lyon-lys', 200, 3), flight('grenoble-gnb', 140, 2.4)],
  meribel: [flight('chambery-cmf', 100, 1.8), flight('lyon-lys', 180, 2.8), flight('grenoble-gnb', 130, 2.2)],
  courchevel: [flight('chambery-cmf', 100, 1.8), flight('lyon-lys', 180, 2.8), flight('grenoble-gnb', 130, 2.2)],
  'grand-massif': [flight('geneva-gva', 65, 1.1), flight('annecy-ncy', 70, 1.2), flight('lyon-lys', 180, 2.6)],
  'les-menuires': [flight('chambery-cmf', 110, 2), flight('lyon-lys', 190, 3), flight('grenoble-gnb', 120, 2.2)],
  'alpe-dhuez': [flight('grenoble-gnb', 70, 1.3), flight('lyon-lys', 150, 2.3), flight('chambery-cmf', 130, 2.4)],
  'serre-chevalier': [flight('turin-trn', 130, 2.2), flight('grenoble-gnb', 110, 2), flight('marseille-mrs', 200, 3), flight('milan-mxp', 230, 3.2)],
  morzine: [flight('geneva-gva', 75, 1.3), flight('lyon-lys', 200, 3), flight('annecy-ncy', 90, 1.6)],
  avoriaz: [flight('geneva-gva', 80, 1.4), flight('lyon-lys', 200, 3), flight('annecy-ncy', 100, 1.8)],

  // Швейцария
  zermatt: [flight('sion-sir', 110, 2), flight('bern-brn', 130, 2.2), flight('geneva-gva', 240, 3.5), flight('zurich-zrh', 200, 3.2)],
  verbier: [flight('sion-sir', 50, 1), flight('geneva-gva', 160, 2.4), flight('bern-brn', 130, 2.2)],
  davos: [flight('zurich-zrh', 150, 2.2), flight('bern-brn', 170, 2.5), flight('stuttgart-str', 230, 3), flight('munich-muc', 280, 3.5)],
  'st-moritz': [flight('samedan-smv', 7, 0.2), flight('lugano-lug', 130, 2.2), flight('zurich-zrh', 200, 3), flight('milan-mxp', 180, 3)],
  grindelwald: [flight('bern-brn', 70, 1.3), flight('zurich-zrh', 120, 1.8), flight('basel-bsl', 160, 2.4)],
  villars: [flight('sion-sir', 90, 1.5), flight('geneva-gva', 110, 1.8), flight('bern-brn', 110, 1.8)],

  // Австрия
  ischgl: [flight('innsbruck-inn', 100, 1.5), flight('friedrichshafen-fdh', 150, 2.2), flight('zurich-zrh', 200, 2.8), flight('stuttgart-str', 280, 3.4), flight('munich-muc', 280, 3.5)],
  solden: [flight('innsbruck-inn', 80, 1.3), flight('bolzano-bzo', 150, 2.5), flight('munich-muc', 220, 3)],
  'st-anton': [flight('innsbruck-inn', 100, 1.5), flight('zurich-zrh', 180, 2.6), flight('munich-muc', 250, 3.2), flight('stuttgart-str', 300, 3.6)],
  mayrhofen: [flight('innsbruck-inn', 70, 1.1), flight('salzburg-szg', 170, 2.4), flight('munich-muc', 200, 2.8)],
  kitzbuhel: [flight('salzburg-szg', 80, 1.2), flight('innsbruck-inn', 100, 1.6), flight('munich-muc', 160, 2.2)],
  schladming: [flight('salzburg-szg', 90, 1.4), flight('linz-lnz', 130, 2), flight('vienna-vie', 250, 3.2)],
  saalbach: [flight('salzburg-szg', 80, 1.3), flight('innsbruck-inn', 150, 2.2), flight('munich-muc', 200, 2.8)],
  hintertux: [flight('innsbruck-inn', 90, 1.4), flight('munich-muc', 190, 2.6), flight('bolzano-bzo', 140, 2.2)],
  'bad-gastein': [flight('salzburg-szg', 100, 1.6), flight('klagenfurt-klu', 120, 1.8), flight('linz-lnz', 160, 2.4)],
  'zell-am-see': [flight('salzburg-szg', 80, 1.3), flight('innsbruck-inn', 140, 2.1), flight('munich-muc', 200, 2.8)],

  // Италия
  cortina: [flight('bolzano-bzo', 130, 2), flight('venice-vce', 160, 2.4), flight('trieste-trs', 170, 2.5), flight('verona-vrn', 200, 2.8)],
  'val-gardena': [flight('bolzano-bzo', 40, 0.8), flight('innsbruck-inn', 120, 2), flight('verona-vrn', 180, 2.5)],
  livigno: [flight('samedan-smv', 60, 1.5), flight('brescia-vbs', 130, 2.2), flight('bolzano-bzo', 140, 2.5), flight('bergamo-bgy', 180, 2.8), flight('milan-mxp', 200, 3), flight('milan-lin', 190, 2.9)],
  bormio: [flight('samedan-smv', 50, 1.2), flight('brescia-vbs', 110, 2), flight('bolzano-bzo', 120, 2.2), flight('bergamo-bgy', 150, 2.5), flight('milan-lin', 160, 2.6)],
  sestriere: [flight('turin-trn', 100, 1.8), flight('cuneo-cuf', 110, 2), flight('milan-mxp', 200, 3)],
  madonna: [flight('verona-vrn', 90, 1.6), flight('brescia-vbs', 110, 2), flight('bolzano-bzo', 120, 2), flight('bergamo-bgy', 150, 2.5)],
  cervinia: [flight('turin-trn', 110, 1.9), flight('geneva-gva', 180, 2.8), flight('milan-mxp', 180, 2.8)],
  'alta-badia': [flight('bolzano-bzo', 70, 1.3), flight('innsbruck-inn', 130, 2.2), flight('verona-vrn', 170, 2.5)],
  'val-di-fassa': [flight('bolzano-bzo', 60, 1.2), flight('verona-vrn', 150, 2.2), flight('innsbruck-inn', 140, 2.3)],
  aprica: [flight('brescia-vbs', 90, 1.6), flight('bergamo-bgy', 100, 1.8), flight('milan-lin', 130, 2.1), flight('milan-mxp', 150, 2.3), flight('bolzano-bzo', 130, 2.2)],

  // Андорра и Испания
  grandvalira: [flight('reus-reu', 175, 2.7), flight('girona-gro', 200, 3), flight('barcelona-bcn', 200, 3), flight('toulouse-tls', 180, 2.8)],
  'pal-arinsal': [flight('girona-gro', 190, 2.9), flight('barcelona-bcn', 190, 2.8), flight('toulouse-tls', 190, 2.9)],
  baqueira: [flight('toulouse-tls', 170, 2.5), flight('pau-puf', 180, 2.6), flight('san-sebastian-eas', 250, 3.5), flight('pamplona-pna', 220, 3.2), flight('santander-sdr', 300, 4), flight('barcelona-bcn', 300, 4)],
  'sierra-nevada': [flight('granada-grx', 50, 1), flight('malaga-agp', 150, 2.2), hub('madrid-mad', 430, 4.5)],
  formigal: [flight('pau-puf', 90, 1.5), flight('vitoria-vit', 140, 2.1), flight('pamplona-pna', 150, 2.2), flight('san-sebastian-eas', 160, 2.4), flight('zaragoza-zaz', 160, 2.3), flight('toulouse-tls', 280, 3.8), flight('barcelona-bcn', 350, 4.5)],

  // Балканы
  bansko: [flight('sofia-sof', 160, 2.5), flight('plovdiv-pdv', 150, 2.4)],
  borovets: [flight('sofia-sof', 70, 1.2), flight('plovdiv-pdv', 140, 2.2)],
  pamporovo: [flight('plovdiv-pdv', 90, 1.5), flight('sofia-sof', 220, 3)],
  jasna: [flight('poprad-tat', 60, 1.1), flight('kosice-ksc', 120, 2)],
  'strbske-pleso': [flight('poprad-tat', 25, 0.5), flight('kosice-ksc', 120, 2)],
  'kranska-gora': [flight('ljubljana-lju', 60, 1), flight('klagenfurt-klu', 60, 1), flight('trieste-trs', 120, 1.8)],
  bovec: [flight('ljubljana-lju', 110, 1.8), flight('trieste-trs', 90, 1.6), flight('klagenfurt-klu', 90, 1.6)],
  zakopane: [flight('krakow-krk', 110, 2), flight('poprad-tat', 60, 1.2), flight('katowice-ktw', 170, 2.8)],

  // Скандинавия
  hemsedal: [flight('oslo-osl', 220, 3), flight('torp-trf', 200, 2.8), flight('bergen-bgo', 250, 3.5)],
  trysil: [flight('scandinavian-mountains-scr', 60, 1), flight('oslo-osl', 230, 3), flight('torp-trf', 200, 2.8)],
  oppdal: [flight('trondheim-trd', 130, 2), flight('molde-mol', 150, 2.5), hub('oslo-osl', 400, 5)],
  are: [flight('ostersund-osd', 100, 1.5), flight('trondheim-trd', 200, 2.8), flight('sundsvall-sdl', 180, 2.5)],
  salen: [flight('scandinavian-mountains-scr', 25, 0.5), flight('oslo-osl', 300, 4)],
  levi: [flight('kittila-ktt', 15, 0.3), flight('rovaniemi-rvn', 170, 2.2)],
  ruka: [flight('kuusamo-kao', 30, 0.5), flight('oulu-oul', 200, 2.8)],
  yllas: [flight('kittila-ktt', 50, 1), flight('rovaniemi-rvn', 120, 1.8)],

  // Азия и Америка
  niseko: [flight('sapporo-cts', 110, 2), hub('tokyo-hnd', 830, 9), hub('tokyo-nrt', 800, 9)],
  hakuba: [flight('matsumoto-mmj', 70, 1.5), flight('toyama-toy', 90, 1.8), flight('niigata-kij', 200, 3), flight('tokyo-hnd', 290, 4), flight('tokyo-nrt', 300, 4), flight('nagoya-ngo', 250, 3.5)],
  nozawa: [flight('niigata-kij', 130, 2.2), flight('matsumoto-mmj', 100, 2), flight('toyama-toy', 130, 2.2), flight('tokyo-hnd', 290, 4), flight('tokyo-nrt', 300, 4), flight('nagoya-ngo', 300, 4)],
  yongpyong: [flight('yangyang-yny', 40, 1), flight('seoul-icn', 200, 3)],
  vail: [flight('vail-ege', 55, 1), flight('denver-den', 190, 2.5)],
  aspen: [flight('aspen-ase', 7, 0.2), flight('vail-ege', 110, 1.8), flight('denver-den', 290, 4)],
  'park-city': [flight('saltlake-slc', 55, 1), hub('denver-den', 700, 7.5)],
  'jackson-hole': [flight('jackson-jac', 20, 0.4), flight('bozeman-bzn', 350, 4.5), hub('saltlake-slc', 450, 5)],
  mammoth: [flight('mammoth-mmh', 12, 0.3), flight('reno-rno', 270, 3.5), flight('sacramento-smf', 350, 4.5)],
  snowbird: [flight('saltlake-slc', 40, 0.8)],
  whistler: [flight('vancouver-yvr', 135, 2.2), flight('kamloops-yka', 300, 4)],
  banff: [flight('calgary-yyc', 130, 2)],
  'mont-tremblant': [flight('montreal-yul', 130, 2), flight('quebec-yqb', 300, 4)],
}

export function nearbyAirports(resortId: string): ResortAirport[] {
  return resortAirports[resortId] ?? []
}

export interface AirportSuggestion extends ResortAirport {
  city: City
  resortName: string
}

/** Аэропорты рядом с курортом, уже обогащённые названием города и курорта */
export function airportSuggestions(resortId: string): AirportSuggestion[] {
  const resort = findResort(resortId)
  if (!resort) return []
  return nearbyAirports(resortId)
    .map((item) => {
      const city = findCity(item.cityId)
      return city ? { ...item, city, resortName: resort.name } : null
    })
    .filter((item): item is AirportSuggestion => item !== null)
}

export interface ResortFromAirport {
  resortId: string
  km: number
  hours: number
  /** true, если расстояние взято из таблицы трансферов, false — оценка по координатам */
  exact: boolean
  access: AirportAccess
}

/**
 * Расстояние от аэропорта до курорта: сначала таблица трансферов,
 * иначе оценка по координатам с коэффициентом дороги 1.25.
 */
export function resortDistanceFromAirport(resortId: string, cityId: string): ResortFromAirport | null {
  const resort = findResort(resortId)
  const city = findCity(cityId)
  if (!resort || !city) return null

  const mapped = nearbyAirports(resortId).find((item) => item.cityId === cityId)
  if (mapped) {
    return {
      resortId,
      km: mapped.km,
      hours: mapped.hours,
      exact: true,
      access: mapped.access ?? 'transfer',
    }
  }

  const straight = distanceKm({ lat: city.lat, lng: city.lng }, { lat: resort.lat, lng: resort.lng })
  const km = Math.round(straight * 1.25)
  return {
    resortId,
    km,
    hours: Math.round((km / 70) * 10) / 10,
    exact: false,
    access: km > MAX_TRANSFER_KM ? 'hub' : 'transfer',
  }
}

/**
 * Курорты, доступные из аэропорта:
 * — явная связка в таблице трансферов (в т.ч. приграничные курорты другой страны);
 * — курорты той же страны в пределах MAX_TRANSFER_KM.
 * Дальние хабы (например, Нисеко из Токио) попадают в список с access = 'hub'.
 */
export function resortsForAirport(cityId: string): ResortFromAirport[] {
  const city = findCity(cityId)
  if (!city) return []

  return resorts
    .filter((resort) => {
      const mapped = nearbyAirports(resort.id).some((item) => item.cityId === cityId)
      if (mapped) return true
      if (resort.country !== city.country) return false
      const straight = distanceKm({ lat: city.lat, lng: city.lng }, { lat: resort.lat, lng: resort.lng })
      return Math.round(straight * 1.25) <= MAX_TRANSFER_KM
    })
    .map((resort) => resortDistanceFromAirport(resort.id, cityId))
    .filter((item): item is ResortFromAirport => item !== null)
    .sort((a, b) => {
      if (a.access !== b.access) return a.access === 'transfer' ? -1 : 1
      return a.km - b.km
    })
}
export interface CityAirport {
  city: City
  km: number
  hours: number
}

/**
 * Аэропорты рядом с городом: все аэропорты той же страны
 * в пределах MAX_TRANSFER_KM, отсортированные по расстоянию.
 * Нужно для ночёвки в городе (возврат с курорта перед вылетом).
 */
export function airportsNearCity(cityId: string, limit = 8): CityAirport[] {
  const origin = findCity(cityId)
  if (!origin) return []

  const result: CityAirport[] = []
  for (const city of cities) {
    if (city.id === origin.id) continue
    if (city.country !== origin.country) continue
    const km = Math.round(distanceKm({ lat: origin.lat, lng: origin.lng }, { lat: city.lat, lng: city.lng }) * 1.25)
    if (km > MAX_TRANSFER_KM) continue
    result.push({ city, km, hours: Math.round((km / 70) * 10) / 10 })
  }

  // Сам город тоже аэропорт, если это аэропорт-город
  if (!result.some((item) => item.city.id === origin.id)) {
    result.unshift({ city: origin, km: 0, hours: 0 })
  }

  return result.sort((a, b) => a.km - b.km).slice(0, limit)
}
