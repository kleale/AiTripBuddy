import type { GearKind, GearOwnership, PrepPlan, SkillLevel } from '@/types'
import { normalizeMix } from '@/lib/gear-fit'

export const skillLevels: { id: SkillLevel; label: string; note: string }[] = [
  { id: 'beginner', label: 'Новичок', note: 'первые сезоны, учебные склоны' },
  { id: 'intermediate', label: 'Уверенный', note: 'трассы любой сложности' },
  { id: 'expert', label: 'Эксперт', note: 'фрирайд, парк, высокая скорость' },
]

export const gearKinds: { id: GearKind; label: string }[] = [
  { id: 'snowboard', label: 'Сноуборд' },
  { id: 'ski', label: 'Лыжи' },
  { id: 'undecided', label: 'Ещё не решил' },
]

export const ownershipOptions: { id: GearOwnership; label: string }[] = [
  { id: 'own', label: 'Своё снаряжение' },
  { id: 'rent', label: 'Всё в аренду' },
  { id: 'mix', label: 'Смешанно' },
]

export const skillLabels: Record<SkillLevel, string> = Object.fromEntries(
  skillLevels.map((item) => [item.id, item.label]),
) as Record<SkillLevel, string>

export const ownershipLabels: Record<GearOwnership, string> = Object.fromEntries(
  ownershipOptions.map((item) => [item.id, item.label]),
) as Record<GearOwnership, string>

export const gearKindLabels: Record<GearKind, string> = Object.fromEntries(
  gearKinds.map((item) => [item.id, item.label]),
) as Record<GearKind, string>

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.round(number)))
}

function isSkill(value: unknown): value is SkillLevel {
  return value === 'beginner' || value === 'intermediate' || value === 'expert'
}

function isOwnership(value: unknown): value is GearOwnership {
  return value === 'own' || value === 'rent' || value === 'mix'
}

function isGearKind(value: unknown): value is GearKind {
  return value === 'snowboard' || value === 'ski' || value === 'undecided'
}

function normalizeChecklist(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object') return {}
  const result: Record<string, boolean> = {}
  for (const [key, done] of Object.entries(value as Record<string, unknown>)) {
    if (done === true) result[key] = true
  }
  return result
}

/** Подготовка по умолчанию: новичок, трасса с небольшим фрирайдом и парком. */
export function defaultPrep(): PrepPlan {
  return {
    enabled: true,
    level: 'beginner',
    mix: normalizeMix({ trail: 60, freeride: 20, park: 20 }),
    ownership: 'mix',
    equipment: 'undecided',
    heightCm: 175,
    weightKg: 75,
    bootSize: 42,
    avalancheAck: false,
    checklist: {},
  }
}

/** Терпимая к старым сохранениям нормализация подготовки. */
export function normalizePrep(value: unknown): PrepPlan | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<PrepPlan>
  const fallback = defaultPrep()
  return {
    enabled: input.enabled !== false,
    level: isSkill(input.level) ? input.level : fallback.level,
    mix: normalizeMix(input.mix),
    ownership: isOwnership(input.ownership) ? input.ownership : fallback.ownership,
    equipment: isGearKind(input.equipment) ? input.equipment : fallback.equipment,
    heightCm: clampInt(input.heightCm, 120, 220, fallback.heightCm),
    weightKg: clampInt(input.weightKg, 30, 160, fallback.weightKg),
    bootSize: clampInt(input.bootSize, 34, 50, fallback.bootSize),
    avalancheAck: input.avalancheAck === true,
    checklist: normalizeChecklist(input.checklist),
  }
}
