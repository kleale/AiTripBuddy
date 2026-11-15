import type { DisciplineMix, GearKind, SkillLevel } from '@/types'

export interface SizeRange {
  min: number
  max: number
  center: number
}

export interface FlexExample {
  label: string
  query: string
}

export interface FlexAdvice {
  score: number
  label: 'мягкая' | 'средняя' | 'жёсткая'
  bootFlex: string
  bindingNote: string
  boots: FlexExample[]
  bindings: FlexExample[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Приводит проценты к сумме 100; нулевой набор заменяется на 60/20/20. */
export function normalizeMix(input?: Partial<DisciplineMix> | null): DisciplineMix {
  const raw = {
    trail: clamp(Number(input?.trail) || 0, 0, 100),
    freeride: clamp(Number(input?.freeride) || 0, 0, 100),
    park: clamp(Number(input?.park) || 0, 0, 100),
  }
  const sum = raw.trail + raw.freeride + raw.park
  if (sum <= 0) return { trail: 60, freeride: 20, park: 20 }

  const trail = Math.min(100, Math.floor((raw.trail / sum) * 100))
  const freeride = Math.min(100 - trail, Math.floor((raw.freeride / sum) * 100))
  return { trail, freeride, park: 100 - trail - freeride }
}

/** Длина сноуборда: рост, вес и стиль катания. */
export function snowboardRange(
  heightCm: number,
  weightKg: number,
  mix: DisciplineMix,
  level: SkillLevel,
): SizeRange {
  const levelAdj = level === 'beginner' ? -2 : level === 'expert' ? 2 : 0
  const center = clamp(
    Math.round(
      heightCm - 20 + (weightKg - 75) * 0.6 + (mix.freeride - mix.park) * 0.06 + levelAdj,
    ),
    125,
    172,
  )
  const half = mix.freeride >= 50 ? 4 : 3
  return { min: Math.max(125, center - half), max: Math.min(172, center + half), center }
}

/** Длина горных лыж: рост минус 10 см с поправкой на вес и стиль. */
export function skiRange(
  heightCm: number,
  weightKg: number,
  mix: DisciplineMix,
  level: SkillLevel,
): SizeRange {
  const levelAdj = level === 'beginner' ? -3 : level === 'expert' ? 3 : 0
  const center = clamp(
    Math.round(
      heightCm - 10 + (weightKg - 75) * 0.7 + (mix.freeride - mix.park) * 0.07 + levelAdj,
    ),
    140,
    195,
  )
  return { min: Math.max(140, center - 5), max: Math.min(195, center + 5), center }
}

/** Ширина талии лыж под стиль: трасса/парк/фрирайд. */
export function skiWaist(mix: DisciplineMix): SizeRange {
  if (mix.freeride >= 50) return { min: 100, max: 115, center: 108 }
  if (mix.park >= 40) return { min: 84, max: 94, center: 89 }
  return { min: 78, max: 88, center: 83 }
}

/** Жёсткость 1–10: опыт, вес и стиль. */
export function flexScore(weightKg: number, mix: DisciplineMix, level: SkillLevel): number {
  let score = 4
  if (level === 'beginner') score -= 2
  if (level === 'expert') score += 2
  if (weightKg >= 85) score += 1
  if (weightKg < 65) score -= 1
  if (mix.freeride >= 40) score += 1
  if (mix.park >= 40) score -= 1
  return clamp(Math.round(score), 1, 10)
}

const snowboardBoots: Record<'мягкая' | 'средняя' | 'жёсткая', FlexExample[]> = {
  мягкая: [
    { label: 'Burton Moto', query: 'Burton Moto сноубордические ботинки купить' },
    { label: 'Salomon Faction', query: 'Salomon Faction сноубордические ботинки купить' },
  ],
  средняя: [
    { label: 'Burton Ruler', query: 'Burton Ruler сноубордические ботинки купить' },
    { label: 'ThirtyTwo TM-2', query: 'ThirtyTwo TM-2 сноубордические ботинки купить' },
  ],
  жёсткая: [
    { label: 'Burton Ion', query: 'Burton Ion сноубордические ботинки купить' },
    { label: 'Deeluxe Deemon', query: 'Deeluxe Deemon сноубордические ботинки купить' },
  ],
}

const snowboardBindings: Record<'мягкая' | 'средняя' | 'жёсткая', FlexExample[]> = {
  мягкая: [
    { label: 'Union Flite Pro', query: 'Union Flite Pro сноубордические крепления купить' },
    { label: 'Burton Mission', query: 'Burton Mission сноубордические крепления купить' },
  ],
  средняя: [
    { label: 'Union Strata', query: 'Union Strata сноубордические крепления купить' },
    { label: 'Burton Cartel', query: 'Burton Cartel сноубордические крепления купить' },
  ],
  жёсткая: [
    { label: 'Union Atlas', query: 'Union Atlas сноубордические крепления купить' },
    { label: 'Burton Genesis', query: 'Burton Genesis сноубордические крепления купить' },
  ],
}

const skiBoots: Record<'мягкая' | 'средняя' | 'жёсткая', FlexExample[]> = {
  мягкая: [
    { label: 'Salomon S/Pro 90', query: 'Salomon S/Pro 90 горнолыжные ботинки купить' },
    { label: 'Atomic Hawx Magna 90', query: 'Atomic Hawx Magna 90 горнолыжные ботинки купить' },
  ],
  средняя: [
    { label: 'Tecnica Mach1 100', query: 'Tecnica Mach1 100 горнолыжные ботинки купить' },
    { label: 'Lange Shadow 100', query: 'Lange Shadow 100 горнолыжные ботинки купить' },
  ],
  жёсткая: [
    { label: 'Tecnica Mach1 130', query: 'Tecnica Mach1 130 горнолыжные ботинки купить' },
    { label: 'Lange RS 130', query: 'Lange RS 130 горнолыжные ботинки купить' },
  ],
}

const skiBindings: Record<'мягкая' | 'средняя' | 'жёсткая', FlexExample[]> = {
  мягкая: [
    { label: 'Marker Squire 11', query: 'Marker Squire 11 горнолыжные крепления купить' },
    { label: 'Tyrolia Attack 11', query: 'Tyrolia Attack 11 горнолыжные крепления купить' },
  ],
  средняя: [
    { label: 'Marker Griffon 13', query: 'Marker Griffon 13 горнолыжные крепления купить' },
    { label: 'Tyrolia Attack 14', query: 'Tyrolia Attack 14 горнолыжные крепления купить' },
  ],
  жёсткая: [
    { label: 'Marker Jester 16', query: 'Marker Jester 16 горнолыжные крепления купить' },
    { label: 'Look Pivot 15', query: 'Look Pivot 15 горнолыжные крепления купить' },
  ],
}

/** Рекомендации по жёсткости ботинок и креплений под стиль. */
export function flexAdvice(
  kind: GearKind,
  level: SkillLevel,
  mix: DisciplineMix,
  weightKg: number,
): FlexAdvice {
  const score = flexScore(weightKg, mix, level)
  const label = score <= 3 ? 'мягкая' : score >= 7 ? 'жёсткая' : 'средняя'

  if (kind === 'ski') {
    const bootFlex =
      label === 'мягкая' ? '70–90' : label === 'жёсткая' ? '110–130' : '90–110'
    return {
      score,
      label,
      bootFlex,
      bindingNote: 'DIN подбирается по весу и уровню, выставляйте в сервисе',
      boots: skiBoots[label],
      bindings: skiBindings[label],
    }
  }

  const bootFlex = label === 'мягкая' ? '3–4 / 10' : label === 'жёсткая' ? '7–9 / 10' : '5–6 / 10'
  return {
    score,
    label,
    bootFlex,
    bindingNote: 'крепления под жёсткость ботинка и вес райдера',
    boots: snowboardBoots[label],
    bindings: snowboardBindings[label],
  }
}

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}
