<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  kind: 'snowboard' | 'ski'
  heightCm: number
  min: number
  max: number
  center: number
}>()

/** Масштаб: силуэт человека 170 px, доска — пропорционально росту. */
const personPx = 170
const scale = computed(() => personPx / Math.max(120, props.heightCm))
const midPx = computed(() => Math.max(40, Math.min(personPx, props.center * scale.value)))
const minPx = computed(() => Math.max(40, Math.min(personPx, props.min * scale.value)))
const maxPx = computed(() => Math.max(40, Math.min(personPx, props.max * scale.value)))

const bottom = 232
const boardX = 158
const rangeTop = computed(() => bottom - maxPx.value)
const rangeBottom = computed(() => bottom - minPx.value)
const boardTop = computed(() => bottom - midPx.value)
</script>

<template>
  <div class="fit-diagram">
    <svg viewBox="0 0 250 270" role="img" :aria-label="`Силуэт человека ${heightCm} см и ${kind === 'ski' ? 'лыж' : 'доски'} ${min}–${max} см`">
      <!-- человек -->
      <circle cx="66" cy="62" r="14" class="fit-person" />
      <path d="M66 78 L66 152 M66 100 L44 128 M66 100 L88 128 M66 152 L50 210 M66 152 L82 210" class="fit-person-stroke" />
      <text x="66" y="250" text-anchor="middle" class="fit-caption">{{ heightCm }} см</text>

      <!-- диапазон длины -->
      <rect
        :x="boardX - 3"
        :y="rangeTop"
        width="30"
        :height="rangeBottom - rangeTop"
        rx="8"
        class="fit-range"
      />
      <line :x1="boardX + 3" :y1="rangeTop" :x2="boardX + 21" :y2="rangeTop" class="fit-tick" />
      <line :x1="boardX + 3" :y1="rangeBottom" :x2="boardX + 21" :y2="rangeBottom" class="fit-tick" />

      <!-- сноуборд -->
      <rect
        v-if="kind === 'snowboard'"
        :x="boardX"
        :y="boardTop"
        width="18"
        :height="midPx"
        rx="9"
        class="fit-board"
      />
      <!-- лыжи -->
      <template v-else>
        <rect :x="boardX - 4" :y="boardTop" width="6" :height="midPx" rx="3" class="fit-board" />
        <rect :x="boardX + 12" :y="boardTop" width="6" :height="midPx" rx="3" class="fit-board" />
      </template>

      <text :x="boardX + 9" :y="rangeTop - 8" text-anchor="middle" class="fit-caption">{{ max }} см</text>
      <text :x="boardX + 9" :y="rangeBottom + 16" text-anchor="middle" class="fit-caption muted">{{ min }} см</text>
      <text :x="boardX + 9" :y="boardTop + midPx / 2 + 4" text-anchor="middle" class="fit-size">{{ center }}</text>
    </svg>
    <div class="fit-legend">
      <div><b>{{ min }}–{{ max }} см</b><span>{{ kind === 'ski' ? 'лыжи' : 'доска' }}</span></div>
      <div><b>{{ heightCm }} см</b><span>рост</span></div>
      <div><b>{{ center }} см</b><span>центр диапазона</span></div>
    </div>
  </div>
</template>
