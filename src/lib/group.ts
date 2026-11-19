import type { Trip } from '@/types'

export interface GroupSeats {
  capacity: number
  taken: number
  free: number
  joinCode: string
}

export function makeJoinCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function groupSeats(trip: Trip): GroupSeats {
  const capacity = Math.min(30, Math.max(1, Math.round(trip.group?.capacity ?? trip.pax)))
  return {
    capacity,
    taken: trip.pax,
    free: Math.max(0, capacity - trip.pax),
    joinCode: trip.group?.joinCode || '',
  }
}

export function setGroupCapacity(trip: Trip, capacity: number): void {
  const next = Math.min(30, Math.max(1, Math.round(capacity)))
  trip.group = {
    capacity: next,
    joinCode: trip.group?.joinCode || makeJoinCode(),
  }
}
