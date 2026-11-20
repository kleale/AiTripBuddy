<script setup lang="ts">
import { computed } from 'vue'
import type { OptimizerVariant } from '@/lib/optimizer'
import { findResort } from '@/data/resorts'

const props = defineProps<{ variant: OptimizerVariant }>()

const points = computed(() => {
  const coords = props.variant.stays
    .map((stay) => findResort(stay.resortId))
    .filter((resort): resort is NonNullable<typeof resort> => Boolean(resort))
  if (coords.length < 2) return []
  const lats = coords.map((resort) => resort.lat)
  const lngs = coords.map((resort) => resort.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  return coords.map((resort, index) => ({
    x: 14 + ((resort.lng - minLng) / (maxLng - minLng || 1)) * 232,
    y: 38 - ((resort.lat - minLat) / (maxLat - minLat || 1)) * 26,
    name: props.variant.stays[index]?.name ?? resort.name,
  }))
})

const path = computed(() => points.value.map((point) => `${point.x},${point.y}`).join(' '))
</script>

<template>
  <svg class="opt-route" viewBox="0 0 260 52" role="img" aria-label="Схема маршрута">
    <polyline v-if="points.length" :points="path" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3" />
    <g v-for="(point, index) in points" :key="point.name">
      <circle :cx="point.x" :cy="point.y" r="4" fill="currentColor" />
      <text :x="point.x" :y="point.y - 8" text-anchor="middle">{{ index + 1 }}</text>
    </g>
  </svg>
</template>
