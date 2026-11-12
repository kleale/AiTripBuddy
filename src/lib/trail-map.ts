import type {
  AreaKind,
  BackcountryRoute,
  DataConfidence,
  HazardLevel,
  LiftLine,
  LiftType,
  SnowCondition,
  TrailDataset,
  TrailLine,
} from '@/data/trail-maps'
import type { TrailDifficulty } from '@/data/resort-guides'

export const trailColors: Record<TrailDifficulty, string> = {
  green: '#2fbf71',
  blue: '#2f8fe0',
  red: '#e05252',
  black: '#1b2433',
}

export const trailLabels: Record<TrailDifficulty, string> = {
  green: 'Зелёные',
  blue: 'Синие',
  red: 'Красные',
  black: 'Чёрные',
}

export const liftLabels: Record<LiftType, string> = {
  gondola: 'Гондола',
  chair: 'Кресло',
  drag: 'Бугель',
  funicular: 'Фуникулёр',
  surface: 'Ленточный',
}

export const liftColors: Record<LiftType, string> = {
  gondola: '#a5b4fc',
  chair: '#fbbf24',
  drag: '#f472b6',
  funicular: '#22d3ee',
  surface: '#94a3b8',
}

export const snowLabels: Record<SnowCondition, string> = {
  powder: 'Свежий порошок',
  packed: 'Укатанный',
  hard: 'Жёсткий',
  wet: 'Мокрый',
  ice: 'Лёд',
  rocks: 'Камни',
}

export const snowColors: Record<SnowCondition, string> = {
  powder: '#7dd3fc',
  packed: '#a3e635',
  hard: '#fbbf24',
  wet: '#38bdf8',
  ice: '#93c5fd',
  rocks: '#a16207',
}

export const confidenceLabels: Record<DataConfidence, string> = {
  verified: 'проверено',
  curated: 'выверено',
  estimate: 'оценка',
}

export const confidenceHints: Record<DataConfidence, string> = {
  verified: 'Данные от курорта или из официального паспорта трасс',
  curated: 'Проверено редакцией по картам и отчётам, но не курортом',
  estimate: 'Расчёт или приблизительная геометрия, требует проверки',
}

export const hazardLabels: Record<HazardLevel, string> = {
  low: 'низкая',
  moderate: 'умеренная',
  considerable: 'значительная',
  high: 'высокая',
}

export const hazardColors: Record<HazardLevel, string> = {
  low: '#34d399',
  moderate: '#fbbf24',
  considerable: '#fb923c',
  high: '#fb7185',
}

export const areaLabels: Record<AreaKind, string> = {
  snowpark: 'Сноупарк',
  halfpipe: 'Хафпайп',
  patrolled: 'Зона патруля',
  backcountry: 'Backcountry',
  night: 'Ночное катание',
}

export interface TrailStats {
  total: number
  open: number
  lit: number
  groomed: number
  lengthKm: number
  verticalM: number
  byDifficulty: Record<TrailDifficulty, { count: number; lengthKm: number }>
  /** средняя ширина по трассам, где она известна */
  avgWidthM: number | null
  liftsOpen: number
  liftsTotal: number
  eveningLifts: number
}

const emptyByDifficulty = (): Record<TrailDifficulty, { count: number; lengthKm: number }> => ({
  green: { count: 0, lengthKm: 0 },
  blue: { count: 0, lengthKm: 0 },
  red: { count: 0, lengthKm: 0 },
  black: { count: 0, lengthKm: 0 },
})

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Сводка по набору трасс: сколько открыто, освещено, по сложностям. */
export function trailStats(dataset: TrailDataset): TrailStats {
  const byDifficulty = emptyByDifficulty()
  let widthSum = 0
  let widthCount = 0
  let lengthKm = 0
  let verticalM = 0

  for (const trail of dataset.trails) {
    byDifficulty[trail.difficulty].count += 1
    byDifficulty[trail.difficulty].lengthKm = round(
      byDifficulty[trail.difficulty].lengthKm + trail.lengthKm,
    )
    lengthKm += trail.lengthKm
    verticalM = Math.max(verticalM, trail.verticalM)
    if (trail.widthM !== null) {
      widthSum += trail.widthM
      widthCount += 1
    }
  }

  return {
    total: dataset.trails.length,
    open: dataset.trails.filter((trail) => trail.status === 'open').length,
    lit: dataset.trails.filter((trail) => trail.lit).length,
    groomed: dataset.trails.filter((trail) => trail.groomed).length,
    lengthKm: round(lengthKm),
    verticalM,
    byDifficulty,
    avgWidthM: widthCount > 0 ? Math.round(widthSum / widthCount) : null,
    liftsOpen: dataset.lifts.filter((lift) => lift.status === 'open').length,
    liftsTotal: dataset.lifts.length,
    eveningLifts: dataset.lifts.filter((lift) => Boolean(lift.schedule.evening)).length,
  }
}

export interface TrailFilter {
  difficulty: TrailDifficulty | null
  litOnly: boolean
  openOnly: boolean
}

export function filterTrails(dataset: TrailDataset, filter: TrailFilter): TrailLine[] {
  return dataset.trails.filter((trail) => {
    if (filter.difficulty && trail.difficulty !== filter.difficulty) return false
    if (filter.litOnly && !trail.lit) return false
    if (filter.openOnly && trail.status !== 'open') return false
    return true
  })
}

/** Трассы выбранной зоны. */
export function trailsByZone(dataset: TrailDataset, zoneId: string | null): TrailLine[] {
  if (!zoneId) return dataset.trails
  return dataset.trails.filter((trail) => trail.zoneId === zoneId)
}

export function liftsByZone(dataset: TrailDataset, zoneId: string | null): LiftLine[] {
  if (!zoneId) return dataset.lifts
  return dataset.lifts.filter((lift) => lift.zoneId === zoneId)
}

/** Свежесть данных в часах относительно указанного момента. */
export function snowAgeHours(updatedAt: string, now = Date.now()): number {
  const time = new Date(updatedAt).getTime()
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.round((now - time) / 3_600_000))
}

/** Самая свежая сводка снега — для бейджа в гиде. */
export function freshestSnow(dataset: TrailDataset, now = Date.now()): { ageHours: number } | null {
  if (dataset.snow.length === 0) return null
  const ages = dataset.snow.map((item) => snowAgeHours(item.updatedAt, now))
  return { ageHours: Math.min(...ages) }
}

/** Доля полей с подтверждённым или выверенным уровнем доверия. */
export function confidenceCoverage(dataset: TrailDataset): number {
  const fields: DataConfidence[] = []

  for (const trail of dataset.trails) {
    fields.push(trail.confidence.geometry, trail.confidence.attributes)
  }
  for (const lift of dataset.lifts) fields.push(lift.confidence)
  for (const area of dataset.areas) fields.push(area.confidence)
  for (const route of dataset.backcountry) fields.push(route.confidence)
  for (const state of dataset.snow) fields.push(state.confidence)

  if (fields.length === 0) return 0
  const known = fields.filter((value) => value !== 'estimate').length
  return Math.round((known / fields.length) * 100)
}

/** Backcountry с наибольшей опасностью — для предупреждения. */
export function highestHazard(routes: BackcountryRoute[]): BackcountryRoute | null {
  const order: HazardLevel[] = ['low', 'moderate', 'considerable', 'high']
  const sorted = [...routes].sort((a, b) => order.indexOf(b.hazard) - order.indexOf(a.hazard))
  return sorted[0] ?? null
}

/** Ближайшая к зоне сводка снега. */
export function snowForZone(dataset: TrailDataset, zoneId: string | null) {
  if (!zoneId) return null
  return dataset.snow.find((item) => item.zoneId === zoneId) ?? null
}

/** Подпись расписания: «дневное 08:00–16:30 · вечернее 18:00–21:00». */
export function scheduleLabel(hours: TrailDataset['hours']): string {
  const parts = [`дневное ${hours.day}`]
  if (hours.evening) parts.push(`вечернее ${hours.evening}`)
  return parts.join(' · ')
}