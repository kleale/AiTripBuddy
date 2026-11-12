import type { TrailDifficulty } from './resort-guides'
import hakubaRaw from './hakuba-trails.json'

export type DataConfidence = 'verified' | 'curated' | 'estimate'

export type LiftType = 'gondola' | 'chair' | 'drag' | 'funicular' | 'surface'

export type LiftStatus = 'open' | 'closed' | 'scheduled' | 'unknown'

export type SnowCondition = 'powder' | 'packed' | 'hard' | 'wet' | 'ice' | 'rocks'

export type AreaKind = 'snowpark' | 'halfpipe' | 'patrolled' | 'backcountry' | 'night'

export type HazardLevel = 'low' | 'moderate' | 'considerable' | 'high'

/** Координата в порядке GeoJSON: [долгота, широта]. */
export type LngLat = [number, number]

export interface TrailLine {
  id: string
  name: string
  zoneId: string
  difficulty: TrailDifficulty
  /** реальная линия спуска из OSM */
  coordinates: LngLat[]
  /** ширина в метрах; null — нет данных */
  widthM: number | null
  /** оценка среднего уклона, % */
  gradientPercent: number | null
  lengthKm: number
  /** оценка перепада, м */
  verticalM: number
  lit: boolean
  groomed: boolean
  /** живой статус курорта; из OSM не выводится */
  status: 'open' | 'closed' | 'unknown'
  confidence: { geometry: DataConfidence; attributes: DataConfidence }
  source: 'openSkiMap' | 'resort' | 'community' | 'editorial'
}

export interface LiftLine {
  id: string
  name: string
  zoneId: string
  type: LiftType
  coordinates: LngLat[]
  lengthM: number
  verticalM: number | null
  capacityPerHour: number | null
  status: LiftStatus
  schedule: { day: string; evening: string | null }
  confidence: DataConfidence
  source: 'openSkiMap' | 'resort' | 'editorial'
}

export interface TrailArea {
  id: string
  name: string
  kind: AreaKind
  coordinates: LngLat[]
  note?: string
  confidence: DataConfidence
}

export interface BackcountryRoute {
  id: string
  name: string
  coordinates: LngLat[]
  verticalM: number
  hazard: HazardLevel
  aspect: string
  note: string
  confidence: DataConfidence
}

export interface ZoneSnowState {
  zoneId: string
  condition: SnowCondition
  freshCm: number
  baseCm: number
  updatedAt: string
  reportedBy: 'resort' | 'community'
  confidence: DataConfidence
}

export interface TrailDataset {
  resortId: string
  updatedAt: string
  /** источник геометрии и лицензия */
  source: string
  license: string
  trails: TrailLine[]
  lifts: LiftLine[]
  areas: TrailArea[]
  backcountry: BackcountryRoute[]
  snow: ZoneSnowState[]
  hours: { day: string; evening: string | null; nightNote?: string }
}

const DAY = '08:00–16:30'
const EVENING = '18:00–21:00'

interface RawTrail {
  id: string
  name: string
  zoneId: string
  difficulty: TrailDifficulty
  coordinates: LngLat[]
  lengthKm: number
  verticalM: number
  gradientPercent: number | null
  widthM: number | null
  lit: boolean
  groomed: boolean
}

interface RawLift {
  id: string
  name: string
  zoneId: string
  type: LiftType
  coordinates: LngLat[]
  lengthM: number
}

interface RawDataset {
  resortId: string
  source: string
  license: string
  fetchedAt: string
  zones: string[]
  trails: RawTrail[]
  lifts: RawLift[]
}

const raw = hakubaRaw as RawDataset

/**
 * Расписание подъёмников по зонам.
 * Взято из режима работы курортов; вечернее катание есть не везде.
 */
const liftSchedules: Record<string, { day: string; evening: string | null }> = {
  happo: { day: DAY, evening: EVENING },
  goryu: { day: DAY, evening: null },
  tsugaike: { day: DAY, evening: EVENING },
  iwatake: { day: DAY, evening: null },
  norikura: { day: DAY, evening: null },
  cortina: { day: DAY, evening: null },
}

/** Зона вокруг базы зоны — для слоя снега и границ патруля. */
function ring(center: { lat: number; lng: number }, rLat: number, rLng: number): LngLat[] {
  const points: LngLat[] = []
  const steps = 18
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    points.push([center.lng + Math.cos(angle) * rLng, center.lat + Math.sin(angle) * rLat])
  }
  return points
}

const zoneCenters: Record<string, { lat: number; lng: number; rLat: number; rLng: number }> = {
  happo: { lat: 36.6945, lng: 137.8325, rLat: 0.0105, rLng: 0.015 },
  goryu: { lat: 36.6795, lng: 137.8285, rLat: 0.0085, rLng: 0.0135 },
  tsugaike: { lat: 36.7345, lng: 137.8445, rLat: 0.0115, rLng: 0.0135 },
  iwatake: { lat: 36.7055, lng: 137.8395, rLat: 0.0065, rLng: 0.0075 },
  norikura: { lat: 36.7575, lng: 137.8555, rLat: 0.0085, rLng: 0.0085 },
  cortina: { lat: 36.7725, lng: 137.8415, rLat: 0.0055, rLng: 0.0055 },
}

const trails: TrailLine[] = raw.trails.map((trail) => ({
  ...trail,
  status: 'unknown',
  confidence: { geometry: 'curated', attributes: 'estimate' },
  source: 'openSkiMap',
}))

const lifts: LiftLine[] = raw.lifts.map((lift) => ({
  ...lift,
  verticalM: null,
  capacityPerHour: null,
  status: 'unknown',
  schedule: liftSchedules[lift.zoneId] ?? { day: DAY, evening: null },
  confidence: 'curated',
  source: 'openSkiMap',
}))

const areas: TrailArea[] = [
  ...Object.entries(zoneCenters).map(([zoneId, center]) => ({
    id: 'patrolled-' + zoneId,
    name: 'Зона патруля · ' + zoneId,
    kind: 'patrolled' as AreaKind,
    coordinates: ring(center, center.rLat, center.rLng),
    note: 'Приблизительная граница освещённой и патрулируемой зоны',
    confidence: 'estimate' as DataConfidence,
  })),
  {
    id: 'happo-snowpark',
    name: 'Happo Snowpark',
    kind: 'snowpark',
    coordinates: ring({ lat: 36.6962, lng: 137.8395 }, 0.0009, 0.0016),
    note: 'Трамплины и перила у Nakiyama',
    confidence: 'estimate',
  },
  {
    id: 'goryu-halfpipe',
    name: 'Goryu Halfpipe',
    kind: 'halfpipe',
    coordinates: ring({ lat: 36.6795, lng: 137.8335 }, 0.0007, 0.0011),
    note: 'Хафпайп у нижней станции',
    confidence: 'estimate',
  },
  {
    id: 'tsugaike-night',
    name: 'Ночная зона Tsugaike',
    kind: 'night',
    coordinates: ring({ lat: 36.7375, lng: 137.8465 }, 0.0016, 0.0022),
    note: 'Освещённые склоны у нижней станции',
    confidence: 'curated',
  },
]

const backcountry: BackcountryRoute[] = [
  {
    id: 'happo-tsugaike-traverse',
    name: 'Happo → Tsugaike traverse',
    coordinates: [
      [137.8145, 36.6905],
      [137.8165, 36.6975],
      [137.8215, 36.7055],
      [137.8275, 36.7145],
    ],
    verticalM: -420,
    hazard: 'considerable',
    aspect: 'север',
    note: 'Классический траверс через перевал, требует знания рельефа',
    confidence: 'curated',
  },
  {
    id: 'happo-ober',
    name: 'Ober-grat',
    coordinates: [
      [137.8125, 36.6895],
      [137.8085, 36.6905],
      [137.8045, 36.6935],
    ],
    verticalM: -680,
    hazard: 'high',
    aspect: 'северо-восток',
    note: 'Крутой северный склон, лавинные доски, только с гидом',
    confidence: 'estimate',
  },
  {
    id: 'goryu-korengi',
    name: 'Korengi',
    coordinates: [
      [137.8155, 36.6875],
      [137.8115, 36.6855],
      [137.8075, 36.6835],
    ],
    verticalM: -540,
    hazard: 'moderate',
    aspect: 'восток',
    note: 'Популярный спуск, выходит к дороге у Goryu',
    confidence: 'curated',
  },
  {
    id: 'tsugaike-norikura',
    name: 'Norikura bowl exit',
    coordinates: [
      [137.8555, 36.7545],
      [137.8605, 36.7585],
      [137.8655, 36.7615],
    ],
    verticalM: -380,
    hazard: 'moderate',
    aspect: 'северо-запад',
    note: 'Выход из чаши, следите за камнями в малоснежные годы',
    confidence: 'estimate',
  },
]

const snow: ZoneSnowState[] = [
  {
    zoneId: 'happo',
    condition: 'powder',
    freshCm: 35,
    baseCm: 145,
    updatedAt: '2026-11-12T06:00:00Z',
    reportedBy: 'resort',
    confidence: 'verified',
  },
  {
    zoneId: 'goryu',
    condition: 'packed',
    freshCm: 20,
    baseCm: 120,
    updatedAt: '2026-11-12T06:00:00Z',
    reportedBy: 'resort',
    confidence: 'verified',
  },
  {
    zoneId: 'tsugaike',
    condition: 'powder',
    freshCm: 40,
    baseCm: 160,
    updatedAt: '2026-11-12T05:30:00Z',
    reportedBy: 'community',
    confidence: 'curated',
  },
  {
    zoneId: 'iwatake',
    condition: 'hard',
    freshCm: 5,
    baseCm: 90,
    updatedAt: '2026-11-11T16:00:00Z',
    reportedBy: 'community',
    confidence: 'estimate',
  },
  {
    zoneId: 'norikura',
    condition: 'ice',
    freshCm: 10,
    baseCm: 110,
    updatedAt: '2026-11-11T15:00:00Z',
    reportedBy: 'community',
    confidence: 'estimate',
  },
]

export const hakubaTrails: TrailDataset = {
  resortId: raw.resortId,
  updatedAt: raw.fetchedAt,
  source: raw.source,
  license: raw.license,
  trails,
  lifts,
  areas,
  backcountry,
  snow,
  hours: {
    day: DAY,
    evening: EVENING,
    nightNote: 'Вечернее катание в Happo-One по пятницам и субботам, с 20 декабря по 15 марта',
  },
}

export const trailDatasets: Record<string, TrailDataset> = {
  hakuba: hakubaTrails,
}

export function trailsFor(resortId: string): TrailDataset | undefined {
  return trailDatasets[resortId]
}

export function hasTrailMap(resortId: string): boolean {
  return Boolean(trailDatasets[resortId])
}