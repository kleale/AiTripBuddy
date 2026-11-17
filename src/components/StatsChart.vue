<script setup lang="ts">
import { computed } from 'vue'
import type { StatsPoint } from '@/lib/stats'

const props = defineProps<{ points: StatsPoint[] }>()

const width = 640
const height = 260
const padLeft = 34
const padRight = 42
const padTop = 20
const padBottom = 30
const plotW = width - padLeft - padRight
const plotH = height - padTop - padBottom

const maxDaily = computed(() => Math.max(1, ...props.points.map((point) => point.unique + point.returning)))
const maxTotal = computed(() => Math.max(1, ...props.points.map((point) => point.total)))

const barW = computed(() => Math.max(3, Math.min(28, (plotW / Math.max(1, props.points.length)) * 0.55)))
const gap = computed(() => plotW / Math.max(1, props.points.length))
const labelStep = computed(() => Math.max(1, Math.ceil(props.points.length / 10)))

function x(index: number): number {
  return padLeft + gap.value * index + gap.value / 2
}

function yDaily(value: number): number {
  return padTop + plotH - (value / maxDaily.value) * plotH
}

function yTotal(value: number): number {
  return padTop + plotH - (value / maxTotal.value) * plotH
}

const totalPath = computed(() =>
  props.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)} ${yTotal(point.total)}`)
    .join(' '),
)

function ticks(max: number): number[] {
  const step = max <= 4 ? 1 : Math.max(1, Math.ceil(max / 4))
  const result = [0]
  for (let value = step; value < max; value += step) result.push(value)
  result.push(max)
  return result
}

const dailyTicks = computed(() => ticks(maxDaily.value))
const totalTicks = computed(() => ticks(maxTotal.value))
</script>

<template>
  <div class="stats-chart">
    <div v-if="!points.length" class="stats-empty">Пока нет данных о заходах</div>
    <svg v-else :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="График заходов по дням">
      <g v-for="tick in dailyTicks" :key="'tick-' + tick">
        <line
          :x1="padLeft"
          :x2="width - padRight"
          :y1="yDaily(tick)"
          :y2="yDaily(tick)"
          class="stats-grid"
        />
        <text :x="padLeft - 6" :y="yDaily(tick) + 3" text-anchor="end" class="stats-axis">
          {{ tick }}
        </text>
      </g>

      <g v-for="(point, index) in points" :key="point.label + index">
        <rect
          :x="x(index) - barW / 2"
          :y="yDaily(point.unique)"
          :width="barW"
          :height="Math.max(0, yDaily(0) - yDaily(point.unique))"
          rx="2"
          class="stats-bar unique"
        >
          <title>{{ point.label }}: уникальных {{ point.unique }}</title>
        </rect>
        <rect
          :x="x(index) - barW / 2"
          :y="yDaily(point.unique + point.returning)"
          :width="barW"
          :height="Math.max(0, yDaily(point.unique) - yDaily(point.unique + point.returning))"
          rx="2"
          class="stats-bar returning"
        >
          <title>{{ point.label }}: вернувшихся {{ point.returning }}</title>
        </rect>
        <text
          v-if="index % labelStep === 0"
          :x="x(index)"
          :y="height - 8"
          text-anchor="middle"
          class="stats-axis"
        >
          {{ point.label }}
        </text>
      </g>

      <path :d="totalPath" class="stats-total" />
      <text
        v-for="tick in totalTicks"
        :key="'total-' + tick"
        :x="width - padRight + 6"
        :y="yTotal(tick) + 3"
        class="stats-axis total"
      >
        {{ tick }}
      </text>
    </svg>

    <div class="stats-legend">
      <span><i class="unique" />уникальные</span>
      <span><i class="returning" />вернувшиеся</span>
      <span><i class="total" />всего</span>
    </div>
  </div>
</template>
