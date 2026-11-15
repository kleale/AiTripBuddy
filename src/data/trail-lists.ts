import type { DataConfidence, LiftType } from './trail-maps'
import type { TrailDifficulty } from './resort-guides'

export interface ListedTrail {
  id: string
  name: string
  zoneId: string
  difficulty: TrailDifficulty
  lengthKm: number
  verticalM: number
  widthM: number | null
  gradientPercent: number | null
  lit: boolean
  groomed: boolean
  note?: string
}

export interface ListedLift {
  id: string
  name: string
  zoneId: string
  type: LiftType
  lengthM: number
  verticalM: number | null
  hours: { day: string; evening: string | null }
  note?: string
}

export interface TrailList {
  resortId: string
  /** что важно знать про трассы курорта */
  summary: string
  /** часы работы курорта в целом */
  hours: { day: string; evening: string | null; nightNote?: string }
  confidence: DataConfidence
  source: string
  trails: ListedTrail[]
  lifts: ListedLift[]
}

const DAY = '09:00–17:00'
const EVENING = '18:00–22:00'

const trail = (
  id: string,
  name: string,
  zoneId: string,
  difficulty: TrailDifficulty,
  lengthKm: number,
  verticalM: number,
  extra: Partial<ListedTrail> = {},
): ListedTrail => ({
  id,
  name,
  zoneId,
  difficulty,
  lengthKm,
  verticalM,
  widthM: null,
  gradientPercent: Math.round((verticalM / (lengthKm * 1000)) * 100),
  lit: false,
  groomed: true,
  ...extra,
})

const lift = (
  id: string,
  name: string,
  zoneId: string,
  type: LiftType,
  lengthM: number,
  verticalM: number | null,
  evening: string | null = null,
  note?: string,
): ListedLift => ({
  id,
  name,
  zoneId,
  type,
  lengthM,
  verticalM,
  hours: { day: DAY, evening },
  note,
})

/**
 * Списки трасс и подъёмников по описаниям курортов.
 * Геометрии здесь нет: на карте эти курорты пока не размечаются,
 * а длины и уклоны — ориентировочные, поэтому confidence = estimate.
 */
export const trailLists: Record<string, TrailList> = {
  'krasnaya-polyana': {
    resortId: 'krasnaya-polyana',
    summary:
      'Кластер из четырёх курортов с общей долиной и разными скипассами. Нижние станции на 540 м, верхние — 2320 м. Синие и красные трассы широкие и подготовленные, чёрные — короткие и крутые. Ветреные дни закрывают верхние очереди.',
    hours: {
      day: DAY,
      evening: EVENING,
      nightNote: 'Вечернее катание на нижних склонах Горки Город и Газпрома, уточняйте даты сезона',
    },
    confidence: 'estimate',
    source: 'Описания курортов кластера, собственные наблюдения редакции',
    trails: [
      trail('kp-gorki-1', 'Цирк-1', 'gorki', 'blue', 3.4, 620, { widthM: 55, lit: true }),
      trail('kp-gorki-2', 'Цирк-2', 'gorki', 'red', 2.8, 540, { widthM: 45 }),
      trail('kp-gorki-3', 'Цирк-3', 'gorki', 'blue', 3.1, 500, { widthM: 60, lit: true }),
      trail('kp-gorki-obzor', 'Обзорная', 'gorki', 'green', 4.2, 480, { widthM: 80, lit: true }),
      trail('kp-gorki-chernaya', 'Чёрная', 'gorki', 'black', 1.6, 420, { widthM: 28, groomed: false }),
      trail('kp-rosa-ober', 'Обер-Хутор', 'rosa', 'red', 2.2, 380, { widthM: 40 }),
      trail('kp-rosa-severnaya', 'Северная', 'rosa', 'red', 3.6, 560, { widthM: 35, lit: false }),
      trail('kp-rosa-vstrechnaya', 'Встречная', 'rosa', 'blue', 3.2, 420, { widthM: 50 }),
      trail('kp-rosa-panorama', 'Панорама', 'rosa', 'blue', 2.6, 360, { widthM: 55 }),
      trail('kp-gazprom-1', 'Лаура 1', 'gazprom', 'blue', 3.0, 480, { widthM: 60 }),
      trail('kp-gazprom-2', 'Лаура 2', 'gazprom', 'red', 2.4, 440, { widthM: 38 }),
      trail('kp-gazprom-3', 'Лаура 3', 'gazprom', 'green', 3.8, 400, { widthM: 90 }),
      trail('kp-alpika-1', 'Альпика 1', 'alpika', 'blue', 2.2, 320, { widthM: 50 }),
      trail('kp-alpika-2', 'Альпика 2', 'alpika', 'red', 1.8, 300, { widthM: 32 }),
      trail('kp-alpika-les', 'Лесная', 'alpika', 'green', 2.6, 260, { widthM: 70 }),
    ],
    lifts: [
      lift('kp-gorki-g1', 'Горки Город · гондола 1-я очередь', 'gorki', 'gondola', 1900, 420, EVENING, '540 → 960 м'),
      lift('kp-gorki-g2', 'Горки Город · гондола 2-я очередь', 'gorki', 'gondola', 2100, 560, null, '960 → 1500 м'),
      lift('kp-gorki-g3', 'Горки Город · гондола 3-я очередь', 'gorki', 'gondola', 2200, 700, null, '1500 → 2320 м'),
      lift('kp-gorki-k1', 'Горки Город · кресельный, верхняя зона', 'gorki', 'chair', 900, 260),
      lift('kp-rosa-g1', 'Роза Хутор · гондола, нижняя очередь', 'rosa', 'gondola', 1800, 380, EVENING),
      lift('kp-rosa-g2', 'Роза Хутор · гондола, средняя очередь', 'rosa', 'gondola', 2000, 520),
      lift('kp-rosa-k1', 'Роза Хутор · кресельный, северный склон', 'rosa', 'chair', 1100, 300),
      lift('kp-gazprom-g1', 'Газпром · гондола 1-я очередь', 'gazprom', 'gondola', 1900, 460, EVENING),
      lift('kp-gazprom-g2', 'Газпром · гондола 2-я очередь', 'gazprom', 'gondola', 1800, 500),
      lift('kp-gazprom-k1', 'Газпром · кресельный, учебный склон', 'gazprom', 'chair', 700, 150),
      lift('kp-alpika-g1', 'Альпика · гондола', 'alpika', 'gondola', 1600, 380),
      lift('kp-alpika-k1', 'Альпика · кресельный', 'alpika', 'chair', 800, 220),
    ],
  },

  'rosa-khutor': {
    resortId: 'rosa-khutor',
    summary:
      'Олимпийский курорт с двумя склонами и тремя очередями до 2320 м. Южный склон солнечный и длинный, северный — холоднее, снег держится дольше, спортивные трассы круче. Перепад 1534 м — самый большой на кластере.',
    hours: {
      day: DAY,
      evening: EVENING,
      nightNote: 'Вечернее катание на нижних очередях в сезон; верхние станции закрываются раньше',
    },
    confidence: 'estimate',
    source: 'Описание курорта и схема склонов, собственные наблюдения редакции',
    trails: [
      trail('rh-south-1', 'Южная панорама', 'south', 'blue', 3.8, 640, { widthM: 55, lit: true }),
      trail('rh-south-2', 'Солнечная', 'south', 'green', 4.4, 520, { widthM: 85, lit: true }),
      trail('rh-south-3', 'Триумф', 'south', 'red', 3.0, 620, { widthM: 40 }),
      trail('rh-south-4', 'Крокус', 'south', 'red', 2.6, 560, { widthM: 36 }),
      trail('rh-north-1', 'Северная', 'north', 'red', 3.6, 700, { widthM: 38 }),
      trail('rh-north-2', 'Спортивная', 'north', 'black', 2.4, 620, { widthM: 28, groomed: false }),
      trail('rh-north-3', 'Млечный путь', 'north', 'blue', 3.2, 520, { widthM: 48 }),
      trail('rh-north-4', 'Змейка', 'north', 'blue', 2.8, 460, { widthM: 44 }),
    ],
    lifts: [
      lift('rh-g1', 'Гондола · 1-я очередь', 'south', 'gondola', 1800, 380, EVENING, '540 → 960 м'),
      lift('rh-g2', 'Гондола · 2-я очередь', 'south', 'gondola', 2000, 520, null, '960 → 1500 м'),
      lift('rh-g3', 'Гондола · 3-я очередь', 'south', 'gondola', 2100, 700, null, '1500 → 2320 м'),
      lift('rh-k1', 'Кресельный, южный склон', 'south', 'chair', 1100, 320),
      lift('rh-g4', 'Гондола, северный склон', 'north', 'gondola', 1900, 600),
      lift('rh-k2', 'Кресельный, северный склон', 'north', 'chair', 1000, 300),
      lift('rh-b1', 'Бугельный, учебная зона', 'south', 'drag', 600, 140),
    ],
  },
}

export function trailListFor(resortId: string): TrailList | undefined {
  return trailLists[resortId]
}

export function hasTrailList(resortId: string): boolean {
  return Boolean(trailLists[resortId])
}