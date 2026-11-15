<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  kind: 'snowboard' | 'ski'
  heightCm: number
  min: number
  max: number
  center: number
}>()

/** Крупный силуэт: человек 300 px, снаряд — пропорционально росту. */
const personPx = 300
const bottom = 400
const scale = computed(() => personPx / Math.max(120, props.heightCm))
const midPx = computed(() => Math.max(80, Math.min(personPx, props.center * scale.value)))
const minPx = computed(() => Math.max(80, Math.min(personPx, props.min * scale.value)))
const maxPx = computed(() => Math.max(80, Math.min(personPx, props.max * scale.value)))

const rangeTop = computed(() => bottom - maxPx.value)
const rangeBottom = computed(() => bottom - minPx.value)
const boardTop = computed(() => bottom - midPx.value)
const boardMid = computed(() => (boardTop.value + bottom) / 2)
const boardX = 240
const boardW = 30

const boardPath = computed(() => {
  const x = boardX
  const top = boardTop.value
  const mid = boardMid.value
  const b = bottom
  const w = boardW
  const waist = 20
  return [
    `M${x} ${top}`,
    `C${x - w} ${top}, ${x - w} ${top + 16}, ${x - w + 4} ${top + 30}`,
    `C${x - waist} ${mid - 34}, ${x - waist} ${mid + 34}, ${x - w + 4} ${b - 30}`,
    `C${x - w} ${b - 16}, ${x - w} ${b}, ${x} ${b}`,
    `C${x + w} ${b}, ${x + w} ${b - 16}, ${x + w - 4} ${b - 30}`,
    `C${x + waist} ${mid + 34}, ${x + waist} ${mid - 34}, ${x + w - 4} ${top + 30}`,
    `C${x + w} ${top + 16}, ${x + w} ${top}, ${x} ${top}`,
    'Z',
  ].join(' ')
})

function skiPath(cx: number): string {
  const top = boardTop.value
  const mid = boardMid.value
  const b = bottom
  return [
    `M${cx} ${top}`,
    `C${cx - 8} ${top + 10}, ${cx - 7} ${mid}, ${cx - 5} ${b}`,
    `L${cx + 5} ${b}`,
    `C${cx + 7} ${mid}, ${cx + 8} ${top + 10}, ${cx} ${top}`,
    'Z',
  ].join(' ')
}
</script>

<template>
  <div class="fit-diagram">
    <svg viewBox="0 0 360 450" role="img" :aria-label="`Силуэт человека ${heightCm} см и ${kind === 'ski' ? 'лыж' : 'доски'} ${min}–${max} см`">
      <!-- контур человека -->
      <circle cx="95" cy="62" r="22" class="fit-person-line" />
      <path
        d="M95 84 C80 84 70 96 68 112 L50 200 C48 208 53 213 58 210 L72 152 L70 232 L58 388 C57 398 66 402 70 394 L96 260 L122 394 C126 402 135 398 134 388 L122 232 L120 152 L134 210 C139 213 144 208 142 200 L124 112 C122 96 110 84 95 84 Z"
        class="fit-person-line"
      />
      <path d="M72 232 L118 232" class="fit-person-detail" />
      <path d="M96 260 L96 390" class="fit-person-detail" />
      <text x="95" y="434" text-anchor="middle" class="fit-caption">{{ heightCm }} см · рост</text>

      <!-- диапазон длины -->
      <rect
        :x="boardX - 40"
        :y="rangeTop"
        width="80"
        :height="rangeBottom - rangeTop"
        rx="14"
        class="fit-range"
      />
      <line :x1="boardX - 34" :y1="rangeTop" :x2="boardX + 34" :y2="rangeTop" class="fit-tick" />
      <line :x1="boardX - 34" :y1="rangeBottom" :x2="boardX + 34" :y2="rangeBottom" class="fit-tick" />

      <!-- приталенный контур доски -->
      <path v-if="kind === 'snowboard'" :d="boardPath" class="fit-board-outline" />
      <path v-if="kind === 'snowboard'" :d="`M${boardX} ${boardTop + 22} L${boardX} ${bottom - 22}`" class="fit-board-line" />
      <!-- контуры лыж -->
      <template v-else>
        <path :d="skiPath(224)" class="fit-board-outline" />
        <path :d="skiPath(256)" class="fit-board-outline" />
      </template>

      <text :x="boardX + 44" :y="rangeTop + 4" class="fit-caption">{{ max }} см</text>
      <text :x="boardX + 44" :y="rangeBottom + 4" class="fit-caption muted">{{ min }} см</text>
      <text :x="boardX + 44" :y="boardMid + 4" class="fit-size">{{ center }} см</text>
    </svg>

    <div class="fit-legend">
      <div><b>{{ min }}–{{ max }} см</b><span>{{ kind === 'ski' ? 'лыжи' : 'доска' }}</span></div>
      <div><b>{{ heightCm }} см</b><span>рост</span></div>
      <div><b>{{ center }} см</b><span>центр диапазона</span></div>
    </div>
  </div>
</template>
