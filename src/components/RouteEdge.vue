<script setup lang="ts">
import { computed } from 'vue'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'
import type { LinkKind, RouteLink } from '@/types'
import { formatHours, formatMoney } from '@/lib/format'
import { openLinkEditor, trip } from '@/stores/trip'

const props = defineProps<EdgeProps>()

const kindMeta: Record<LinkKind, { label: string; color: string }> = {
  flight: { label: 'Перелёт', color: '#38bdf8' },
  transfer: { label: 'Трансфер', color: '#fbbf24' },
  move: { label: 'Переезд', color: '#34d399' },
}

const link = computed<RouteLink>(
  () => (props.data?.link as RouteLink | undefined) ?? { kind: 'flight', price: 0, hours: 0 },
)
const index = computed(() => Number(props.data?.index ?? 0))
const currency = computed(() => trip.value?.currency ?? 'RUB')
const meta = computed(() => kindMeta[link.value.kind] ?? kindMeta.flight)

const geometry = computed(() =>
  getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.25,
  }),
)

const path = computed(() => geometry.value[0])
const labelX = computed(() => geometry.value[1])
const labelY = computed(() => geometry.value[2])

const dateLabel = computed(() => {
  const date = link.value.date
  if (!date) return ''
  const parsed = new Date(`${date}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''
  const day = parsed.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
  return link.value.time ? `${day} ${link.value.time}` : day
})
</script>

<template>
  <path
    :d="path"
    fill="none"
    :stroke="meta.color"
    stroke-width="2"
    :stroke-dasharray="link.kind === 'flight' ? '7 6' : undefined"
    :class="['route-edge', link.kind]"
  />

  <EdgeLabelRenderer>
    <button
      type="button"
      class="edge-label"
      :title="dateLabel ? `${meta.label} · ${dateLabel}` : meta.label"
      :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }"
      @click="openLinkEditor(index)"
    >
      <span class="edge-dot" :style="{ background: meta.color }" />
      <span v-if="dateLabel" class="edge-date">{{ dateLabel }}</span>
      <span class="edge-price">{{ formatMoney(link.price, currency) }}</span>
      <span v-if="link.hours > 0" class="edge-hours">{{ formatHours(link.hours) }}</span>
    </button>
  </EdgeLabelRenderer>
</template>
