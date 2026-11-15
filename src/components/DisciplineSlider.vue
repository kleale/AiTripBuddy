<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DisciplineMix } from '@/types'
import { normalizeMix } from '@/lib/gear-fit'

const props = defineProps<{ modelValue: DisciplineMix }>()
const emit = defineEmits<{ 'update:modelValue': [value: DisciplineMix] }>()

const bar = ref<HTMLElement | null>(null)
const dragging = ref<0 | 1 | null>(null)

const parts = computed(() => [
  { id: 'trail' as const, label: 'Трасса', value: props.modelValue.trail, color: '#34d399' },
  { id: 'freeride' as const, label: 'Фрирайд', value: props.modelValue.freeride, color: '#38bdf8' },
  { id: 'park' as const, label: 'Парк', value: props.modelValue.park, color: '#fbbf24' },
])

const boundaryA = computed(() => props.modelValue.trail)
const boundaryB = computed(() => props.modelValue.trail + props.modelValue.freeride)

function percentAt(clientX: number): number {
  const rect = bar.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return 0
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
}

function apply(boundary: 0 | 1, value: number): void {
  const mix = props.modelValue
  const percent = Math.round(value)

  if (boundary === 0) {
    const trail = Math.min(100 - mix.park, Math.max(0, percent))
    emit('update:modelValue', normalizeMix({ trail, freeride: 100 - trail - mix.park, park: mix.park }))
    return
  }

  const end = Math.min(100, Math.max(mix.trail, percent))
  const park = 100 - end
  emit('update:modelValue', normalizeMix({ trail: mix.trail, freeride: end - mix.trail, park }))
}

function nearestBoundary(clientX: number): 0 | 1 {
  const percent = percentAt(clientX)
  return Math.abs(percent - boundaryA.value) <= Math.abs(percent - boundaryB.value) ? 0 : 1
}

function onPointerDown(event: PointerEvent): void {
  const boundary = nearestBoundary(event.clientX)
  dragging.value = boundary
  bar.value?.setPointerCapture(event.pointerId)
  apply(boundary, percentAt(event.clientX))
}

function onPointerMove(event: PointerEvent): void {
  if (dragging.value === null) return
  apply(dragging.value, percentAt(event.clientX))
}

function onPointerUp(event: PointerEvent): void {
  if (dragging.value === null) return
  dragging.value = null
  bar.value?.releasePointerCapture(event.pointerId)
}

function nudge(boundary: 0 | 1, direction: number): void {
  const current = boundary === 0 ? boundaryA.value : boundaryB.value
  apply(boundary, current + direction * 5)
}
</script>

<template>
  <div class="discipline-slider">
    <div class="discipline-legend">
      <span v-for="part in parts" :key="part.id">
        <i :style="{ background: part.color }" />{{ part.label }} <b>{{ part.value }}%</b>
      </span>
    </div>

    <div
      ref="bar"
      class="discipline-bar"
      role="group"
      aria-label="Стиль катания: трасса, фрирайд, парк"
      @pointerdown.prevent="onPointerDown"
      @pointermove.prevent="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span
        v-for="part in parts"
        :key="part.id"
        class="discipline-segment"
        :style="{ width: part.value + '%', background: part.color }"
      />

      <button
        type="button"
        class="discipline-handle"
        :style="{ left: boundaryA + '%' }"
        role="slider"
        aria-label="Граница трассы и фрирайда"
        aria-valuemin="0"
        :aria-valuemax="100 - modelValue.park"
        :aria-valuenow="boundaryA"
        @keydown.left.prevent="nudge(0, -1)"
        @keydown.right.prevent="nudge(0, 1)"
      />
      <button
        type="button"
        class="discipline-handle"
        :style="{ left: boundaryB + '%' }"
        role="slider"
        aria-label="Граница фрирайда и парка"
        aria-valuemin="modelValue.trail"
        aria-valuemax="100"
        :aria-valuenow="boundaryB"
        @keydown.left.prevent="nudge(1, -1)"
        @keydown.right.prevent="nudge(1, 1)"
      />
    </div>

    <p class="discipline-hint">Потяните границы цветных сегментов</p>
  </div>
</template>
