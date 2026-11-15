import type { LinkKind, RouteLink, TransportMode } from '@/types'

export interface TransportMeta {
  id: TransportMode
  label: string
  color: string
  /** штрих линии: перелёт и паром — пунктиром */
  dash?: string
}

/** Единый источник цветов и подписей транспорта. */
export const transportModes: TransportMeta[] = [
  { id: 'plane', label: 'Самолёт', color: '#38bdf8', dash: '7 6' },
  { id: 'train', label: 'Поезд', color: '#a78bfa', dash: '10 4' },
  { id: 'bus', label: 'Автобус', color: '#fbbf24', dash: '2 4' },
  { id: 'taxi', label: 'Такси', color: '#fb7185', dash: '6 3' },
  { id: 'car', label: 'Автомобиль', color: '#34d399' },
  { id: 'ferry', label: 'Паром', color: '#22d3ee', dash: '12 5' },
]

export const transportById: Record<TransportMode, TransportMeta> = Object.fromEntries(
  transportModes.map((mode) => [mode.id, mode]),
) as Record<TransportMode, TransportMeta>

/** Транспорт по умолчанию: перелёт — самолёт, переезд — авто, трансфер — автобус. */
export function defaultTransport(kind: LinkKind): TransportMode {
  if (kind === 'flight') return 'plane'
  if (kind === 'move') return 'car'
  return 'bus'
}

export function isTransportMode(value: unknown): value is TransportMode {
  return typeof value === 'string' && value in transportById
}

export function transportFor(link: Pick<RouteLink, 'kind' | 'transport'>): TransportMeta {
  const mode = isTransportMode(link.transport) ? link.transport : defaultTransport(link.kind)
  return transportById[mode]
}

/** Цвет ребра — по транспорту, а не по типу участка. */
export function transportColor(link: Pick<RouteLink, 'kind' | 'transport'>): string {
  return transportFor(link).color
}
