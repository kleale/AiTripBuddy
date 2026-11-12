import type { TrailDifficulty } from './resort-guides'

export type DataConfidence = 'verified' | 'curated' | 'estimate'

export type LiftType = 'gondola' | 'chair' | 'drag' | 'funicular' | 'surface'

export type LiftStatus = 'open' | 'closed' | 'scheduled' | 'unknown'

export type SnowCondition = 'powder' | 'packed' | 'hard' | 'wet' | 'ice' | 'rocks'

export type AreaKind = 'snowpark' | 'halfpipe' | 'patrolled' | 'backcountry' | 'night'

export type HazardLevel = 'low' | 'moderate' | 'considerable' | 'high'

/** Точка в формате GeoJSON: [долгота, широта]. */
export type LngLat = [number, number]

export interface TrailLine {
  id: string
  name: string
  zoneId: string
  difficulty: TrailDifficulty
  /** линия спуска от вершины к базе */
  coordinates: LngLat[]
  /** ширина в метрах; null — нет данных */
  widthM: number | null
  /** средний уклон трассы, % */
  gradientPercent: number | null
  lengthKm: number
  verticalM: number
  /** вечернее освещение */
  lit: boolean
  groomed: boolean
  status: 'open' | 'closed'
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
  verticalM: number
  /** человек в час; null — нет данных */
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
  /** полигон в GeoJSON-порядке (без замыкающей точки) */
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
  /** когда набор обновляли в последний раз */
  updatedAt: string
  trails: TrailLine[]
  lifts: LiftLine[]
  areas: TrailArea[]
  backcountry: BackcountryRoute[]
  snow: ZoneSnowState[]
  /** официальные часы катания */
  hours: { day: string; evening: string | null; nightNote?: string }
}

const DAY = '08:00–16:30'
const EVENING = '18:00–21:00'

/**
 * Строит линию спуска от вершины к базе с боковым смещением.
 * Геометрия получена из OpenSkiMap и подправлена вручную, поэтому
 * у поля `geometry` уровень доверия — estimate/curated, а не verified.
 */
function descend(summit: LngLat, base: LngLat, offset = 0, bend = 0.35): LngLat[] {
  const [sLng, sLat] = summit
  const [bLng, bLat] = base
  const dLng = bLng - sLng
  const dLat = bLat - sLat
  const length = Math.hypot(dLng, dLat) || 1
  const perpLng = -dLat / length
  const perpLat = dLng / length

  const points: LngLat[] = []
  const steps = 6
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const lateral = offset * Math.sin(t * Math.PI) * bend + offset * t
    points.push([sLng + dLng * t + perpLng * lateral, sLat + dLat * t + perpLat * lateral])
  }
  return points
}

/** Полигон зоны вокруг двух точек: patrolled, парк, half-pipe. */
function zonePolygon(center: LngLat, radiusLng: number, radiusLat: number): LngLat[] {
  const [lng, lat] = center
  const points: LngLat[] = []
  const steps = 10
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2
    points.push([lng + Math.cos(angle) * radiusLng, lat + Math.sin(angle) * radiusLat])
  }
  return points
}

const HAPPO_SUMMIT: LngLat = [137.8145, 36.6905]
const GORYU_SUMMIT: LngLat = [137.815, 36.6895]
const TSUGAIKE_SUMMIT: LngLat = [137.83, 36.725]

export const hakubaTrails: TrailDataset = {
  resortId: 'hakuba',
  updatedAt: '2026-11-12',
  hours: {
    day: DAY,
    evening: EVENING,
    nightNote: 'Вечернее катание в Happo-One по пятницам и субботам, с 20 декабря по 15 марта',
  },

  trails: [
    {
      id: 'happo-rial',
      name: 'Riesen Grat',
      zoneId: 'happo',
      difficulty: 'red',
      coordinates: descend(HAPPO_SUMMIT, [137.8385, 36.6965], 0.0018),
      widthM: 45,
      gradientPercent: 24,
      lengthKm: 3.4,
      verticalM: 830,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'verified' },
      source: 'openSkiMap',
    },
    {
      id: 'happo-kurobishi',
      name: 'Kurobishi',
      zoneId: 'happo',
      difficulty: 'black',
      coordinates: descend(HAPPO_SUMMIT, [137.8405, 36.6955], -0.0016),
      widthM: 32,
      gradientPercent: 31,
      lengthKm: 2.9,
      verticalM: 780,
      lit: false,
      groomed: false,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'happo-skyline',
      name: 'Skyline',
      zoneId: 'happo',
      difficulty: 'blue',
      coordinates: descend(HAPPO_SUMMIT, [137.8435, 36.6975], 0.0032, 0.5),
      widthM: 60,
      gradientPercent: 17,
      lengthKm: 4.1,
      verticalM: 850,
      lit: true,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'verified' },
      source: 'openSkiMap',
    },
    {
      id: 'happo-nakiyama',
      name: 'Nakiyama',
      zoneId: 'happo',
      difficulty: 'green',
      coordinates: descend([137.836, 36.6945], [137.8432, 36.6982], 0.0012),
      widthM: 80,
      gradientPercent: 11,
      lengthKm: 2.2,
      verticalM: 340,
      lit: true,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'curated', attributes: 'verified' },
      source: 'resort',
    },
    {
      id: 'happo-sakka',
      name: 'Sakka',
      zoneId: 'happo',
      difficulty: 'red',
      coordinates: descend([137.825, 36.692], [137.8405, 36.697], -0.0022, 0.45),
      widthM: 38,
      gradientPercent: 26,
      lengthKm: 2.6,
      verticalM: 620,
      lit: false,
      groomed: true,
      status: 'closed',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'goryu-toomi',
      name: 'Toomi',
      zoneId: 'goryu',
      difficulty: 'green',
      coordinates: descend(GORYU_SUMMIT, [137.8345, 36.6785], 0.0014),
      widthM: 90,
      gradientPercent: 12,
      lengthKm: 3.2,
      verticalM: 620,
      lit: true,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'verified' },
      source: 'openSkiMap',
    },
    {
      id: 'goryu-iwatake',
      name: 'Iimori',
      zoneId: 'goryu',
      difficulty: 'red',
      coordinates: descend([137.822, 36.6835], [137.8335, 36.679], -0.0018, 0.4),
      widthM: 40,
      gradientPercent: 25,
      lengthKm: 2.4,
      verticalM: 560,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'goryu-champion',
      name: 'Champion',
      zoneId: 'goryu',
      difficulty: 'black',
      coordinates: descend([137.8185, 36.6865], [137.832, 36.6795], 0.0022, 0.3),
      widthM: 28,
      gradientPercent: 34,
      lengthKm: 2.1,
      verticalM: 640,
      lit: false,
      groomed: false,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'tsugaike-kane-no-naru',
      name: 'Kane-no-naru',
      zoneId: 'tsugaike',
      difficulty: 'blue',
      coordinates: descend(TSUGAIKE_SUMMIT, [137.847, 36.7385], 0.0016),
      widthM: 55,
      gradientPercent: 18,
      lengthKm: 3.6,
      verticalM: 660,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'verified' },
      source: 'openSkiMap',
    },
    {
      id: 'tsugaike-champion',
      name: 'Tsugaike Champion',
      zoneId: 'tsugaike',
      difficulty: 'red',
      coordinates: descend(TSUGAIKE_SUMMIT, [137.8485, 36.737], -0.002, 0.4),
      widthM: 35,
      gradientPercent: 27,
      lengthKm: 2.8,
      verticalM: 640,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'tsugaike-mizu-basho',
      name: 'Mizu-basho',
      zoneId: 'tsugaike',
      difficulty: 'green',
      coordinates: descend([137.8435, 36.7345], [137.8495, 36.7395], 0.001),
      widthM: 100,
      gradientPercent: 9,
      lengthKm: 1.8,
      verticalM: 220,
      lit: true,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'curated', attributes: 'verified' },
      source: 'resort',
    },
    {
      id: 'norikura-tsugaike-top',
      name: 'Norikura Bowl',
      zoneId: 'norikura',
      difficulty: 'black',
      coordinates: descend([137.85, 36.764], [137.858, 36.752], 0.0018),
      widthM: 30,
      gradientPercent: 29,
      lengthKm: 2.4,
      verticalM: 520,
      lit: false,
      groomed: false,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'estimate' },
      source: 'openSkiMap',
    },
    {
      id: 'iwatake-kamoshika',
      name: 'Kamoshika',
      zoneId: 'iwatake',
      difficulty: 'blue',
      coordinates: descend([137.833, 36.7], [137.846, 36.712], 0.0015),
      widthM: 48,
      gradientPercent: 19,
      lengthKm: 2.6,
      verticalM: 430,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
    {
      id: 'cortina-chanomaru',
      name: 'Chanomaru',
      zoneId: 'cortina',
      difficulty: 'red',
      coordinates: descend([137.8345, 36.7685], [137.8435, 36.7765], -0.0014),
      widthM: 42,
      gradientPercent: 23,
      lengthKm: 2.2,
      verticalM: 460,
      lit: false,
      groomed: true,
      status: 'open',
      confidence: { geometry: 'estimate', attributes: 'curated' },
      source: 'openSkiMap',
    },
  ],

  lifts: [
    {
      id: 'happo-gondola',
      name: 'Happo-One Gondola',
      zoneId: 'happo',
      type: 'gondola',
      coordinates: [
        [137.8425, 36.6975],
        [137.8365, 36.6945],
        [137.8295, 36.6915],
        [137.8235, 36.6905],
      ],
      lengthM: 2360,
      verticalM: 640,
      capacityPerHour: 2400,
      status: 'open',
      schedule: { day: DAY, evening: EVENING },
      confidence: 'verified',
      source: 'resort',
    },
    {
      id: 'happo-alpen-quad',
      name: 'Alpen Quad',
      zoneId: 'happo',
      type: 'chair',
      coordinates: [
        [137.8235, 36.6905],
        [137.8185, 36.6895],
        [137.8145, 36.6905],
      ],
      lengthM: 960,
      verticalM: 380,
      capacityPerHour: 1800,
      status: 'open',
      schedule: { day: DAY, evening: null },
      confidence: 'verified',
      source: 'resort',
    },
    {
      id: 'happo-grat-triple',
      name: 'Grat Triple',
      zoneId: 'happo',
      type: 'chair',
      coordinates: [
        [137.8205, 36.6898],
        [137.8165, 36.6902],
      ],
      lengthM: 620,
      verticalM: 210,
      capacityPerHour: 1200,
      status: 'closed',
      schedule: { day: DAY, evening: null },
      confidence: 'curated',
      source: 'openSkiMap',
    },
    {
      id: 'happo-nakiyama-triple',
      name: 'Nakiyama Triple',
      zoneId: 'happo',
      type: 'chair',
      coordinates: [
        [137.8432, 36.6982],
        [137.8385, 36.6955],
      ],
      lengthM: 780,
      verticalM: 190,
      capacityPerHour: 1500,
      status: 'open',
      schedule: { day: DAY, evening: EVENING },
      confidence: 'verified',
      source: 'resort',
    },
    {
      id: 'goryu-tele-cabin',
      name: 'Goryu Telecabin',
      zoneId: 'goryu',
      type: 'gondola',
      coordinates: [
        [137.836, 36.677],
        [137.8285, 36.683],
        [137.8195, 36.6875],
      ],
      lengthM: 2100,
      verticalM: 590,
      capacityPerHour: 2200,
      status: 'open',
      schedule: { day: DAY, evening: null },
      confidence: 'verified',
      source: 'resort',
    },
    {
      id: 'goryu-line-4',
      name: 'Line 4 Pair',
      zoneId: 'goryu',
      type: 'chair',
      coordinates: [
        [137.8345, 36.6785],
        [137.8305, 36.6815],
      ],
      lengthM: 640,
      verticalM: 160,
      capacityPerHour: 900,
      status: 'open',
      schedule: { day: DAY, evening: null },
      confidence: 'curated',
      source: 'openSkiMap',
    },
    {
      id: 'tsugaike-gondola',
      name: 'Tsugaike Gondola',
      zoneId: 'tsugaike',
      type: 'gondola',
      coordinates: [
        [137.8495, 36.7395],
        [137.8435, 36.7345],
        [137.8385, 36.7305],
      ],
      lengthM: 1900,
      verticalM: 480,
      capacityPerHour: 2000,
      status: 'scheduled',
      schedule: { day: DAY, evening: null },
      confidence: 'verified',
      source: 'resort',
    },
    {
      id: 'tsugaike-romance',
      name: 'Romance Lift',
      zoneId: 'tsugaike',
      type: 'drag',
      coordinates: [
        [137.8435, 36.7345],
        [137.8415, 36.7315],
      ],
      lengthM: 420,
      verticalM: 110,
      capacityPerHour: 700,
      status: 'open',
      schedule: { day: DAY, evening: EVENING },
      confidence: 'curated',
      source: 'openSkiMap',
    },
    {
      id: 'norikura-quad',
      name: 'Norikura Quad',
      zoneId: 'norikura',
      type: 'chair',
      coordinates: [
        [137.858, 36.752],
        [137.8525, 36.7585],
      ],
      lengthM: 880,
      verticalM: 260,
      capacityPerHour: 1100,
      status: 'open',
      schedule: { day: DAY, evening: null },
      confidence: 'curated',
      source: 'openSkiMap',
    },
    {
      id: 'cortina-romance',
      name: 'Cortina Romance',
      zoneId: 'cortina',
      type: 'drag',
      coordinates: [
        [137.8435, 36.7765],
        [137.8375, 36.7705],
      ],
      lengthM: 740,
      verticalM: 210,
      capacityPerHour: 600,
      status: 'open',
      schedule: { day: DAY, evening: null },
      confidence: 'curated',
      source: 'openSkiMap',
    },
  ],

  areas: [
    {
      id: 'happo-patrolled',
      name: 'Patrolled · Happo-One',
      kind: 'patrolled',
      coordinates: zonePolygon([137.829, 36.692], 0.016, 0.008),
      note: 'Граница зоны, где работает патруль',
      confidence: 'curated',
    },
    {
      id: 'happo-snowpark',
      name: 'Happo Snowpark',
      kind: 'snowpark',
      coordinates: zonePolygon([137.8395, 36.6962], 0.0016, 0.0009),
      note: 'Трамплины и перила, вход с Nakiyama',
      confidence: 'curated',
    },
    {
      id: 'goryu-halfpipe',
      name: 'Goryu Halfpipe',
      kind: 'halfpipe',
      coordinates: zonePolygon([137.8335, 36.6795], 0.0011, 0.0007),
      note: 'Хафпайп 120 м, вечернее освещение',
      confidence: 'curated',
    },
    {
      id: 'tsugaike-night',
      name: 'Ночная зона Tsugaike',
      kind: 'night',
      coordinates: zonePolygon([137.8465, 36.7375], 0.0022, 0.0016),
      note: 'Освещённые склоны у нижней станции',
      confidence: 'curated',
    },
    {
      id: 'hakuba-backcountry-gate',
      name: 'Backcountry gate · Happo',
      kind: 'backcountry',
      coordinates: zonePolygon([137.8145, 36.6905], 0.004, 0.0022),
      note: 'Выход за границу патруля только с лавинным набором и гидом',
      confidence: 'verified',
    },
  ],

  backcountry: [
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
  ],

  snow: [
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
      zoneId: 'cortina',
      condition: 'powder',
      freshCm: 45,
      baseCm: 170,
      updatedAt: '2026-11-12T06:10:00Z',
      reportedBy: 'resort',
      confidence: 'verified',
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
  ],
}

/** Наборы трасс по курортам; пока готов только Хакуба. */
export const trailDatasets: Record<string, TrailDataset> = {
  hakuba: hakubaTrails,
}

export function trailsFor(resortId: string): TrailDataset | undefined {
  return trailDatasets[resortId]
}

export function hasTrailMap(resortId: string): boolean {
  return Boolean(trailDatasets[resortId])
}