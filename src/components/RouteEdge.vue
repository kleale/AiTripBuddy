<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@vue-flow/core'
import type { RouteLink } from '@/types'
import { formatHours, formatMoney } from '@/lib/format'
import { transportFor } from '@/lib/transport'
import { insertStayAfter, openLinkEditor, trip } from '@/stores/trip'

const props = defineProps<EdgeProps>()

const link = computed<RouteLink>(
  () => (props.data?.link as RouteLink | undefined) ?? { kind: 'flight', price: 0, hours: 0 },
)
const index = computed(() => Number(props.data?.index ?? 0))
const currency = computed(() => trip.value?.currency ?? 'RUB')
const meta = computed(() => transportFor(link.value))

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

const menuOpen = ref(false)
let closeTimer: number | undefined

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value
  window.clearTimeout(closeTimer)
  if (menuOpen.value) {
    closeTimer = window.setTimeout(() => (menuOpen.value = false), 6000)
  }
}

function insert(placeKind: 'resort' | 'city'): void {
  insertStayAfter(index.value, placeKind)
  menuOpen.value = false
}

onBeforeUnmount(() => window.clearTimeout(closeTimer))
</script>

<template>
  <path
    :d="path"
    fill="none"
    :stroke="meta.color"
    stroke-width="2"
    :stroke-dasharray="meta.dash"
    :class="['route-edge', link.kind, meta.id]"
  />

  <EdgeLabelRenderer>
    <button
      type="button"
      class="edge-insert"
      :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 30}px)` }"
      title="Вставить город или курорт между точками"
      @click.stop="toggleMenu"
    >
      +
    </button>

    <div
      v-if="menuOpen"
      class="edge-insert-menu"
      :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + 22}px)` }"
    >
      <button type="button" @click.stop="insert('resort')">Курорт</button>
      <button type="button" @click.stop="insert('city')">Город</button>
    </div>

    <button
      type="button"
      class="edge-label"
      :title="dateLabel ? `${meta.label} · ${dateLabel}` : meta.label"
      :style="{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }"
      @click="openLinkEditor(index)"
    >
      <span class="edge-dot" :style="{ background: meta.color }" />
      <span class="edge-mode">{{ meta.label }}</span>
      <span v-if="dateLabel" class="edge-date">{{ dateLabel }}</span>
      <span class="edge-price">{{ formatMoney(link.price, currency) }}</span>
      <span v-if="link.hours > 0" class="edge-hours">{{ formatHours(link.hours) }}</span>
    </button>
  </EdgeLabelRenderer>
</template>
