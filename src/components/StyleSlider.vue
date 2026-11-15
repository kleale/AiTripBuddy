<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{
  modelValue: Record<string, number>
  parts: { id: string; label: string; color: string }[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, number>] }>()

const bar = ref<HTMLElement | null>(null)
const dragging = ref<number | null>(null)

const values = computed(() => props.parts.map((part) => Math.max(0, Math.round(props.modelValue[part.id] ?? 0))))
const bounds = computed(() => {
  const result: number[] = []
  let sum = 0
  for (let i = 0; i < values.value.length - 1; i += 1) {
    sum += values.value[i] ?? 0
    result.push(sum)
  }
  return result
})

function percentAt(clientX: number): number {
  const rect = bar.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return 0
  return Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
}

function apply(boundary: number, value: number): void {
  const next = [...values.value]
  const prefix = next.slice(0, boundary).reduce((sum, item) => sum + item, 0)
  const combined = (next[boundary] ?? 0) + (next[boundary + 1] ?? 0)
  const left = Math.min(combined, Math.max(0, Math.round(value - prefix)))
  next[boundary] = left
  next[boundary + 1] = combined - left

  const result: Record<string, number> = {}
  props.parts.forEach((part, index) => {
    result[part.id] = next[index] ?? 0
  })
  emit('update:modelValue', result)
}

function nearestBoundary(clientX: number): number {
  const percent = percentAt(clientX)
  let best = 0
  let distance = Number.POSITIVE_INFINITY
  bounds.value.forEach((bound, index) => {
    const diff = Math.abs(percent - bound)
    if (diff < distance) {
      distance = diff
      best = index
    }
  })
  return best
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

function nudge(boundary: number, direction: number): void {
  apply(boundary, (bounds.value[boundary] ?? 0) + direction * 5)
}
</script>

<template>
  <div class="discipline-slider">
    <div class="discipline-legend">
      <span v-for="(part, index) in parts" :key="part.id">
        <i :style="{ background: part.color }" />{{ part.label }} <b>{{ values[index] }}%</b>
      </span>
    </div>

    <div
      ref="bar"
      class="discipline-bar"
      role="group"
      :aria-label="parts.map((part) => part.label).join(', ')"
      @pointerdown.prevent="onPointerDown"
      @pointermove.prevent="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <span
        v-for="(part, index) in parts"
        :key="part.id"
        class="discipline-segment"
        :style="{ width: (values[index] ?? 0) + '%', background: part.color }"
      />
      <button
        v-for="(bound, index) in bounds"
        :key="'handle-' + index"
        type="button"
        class="discipline-handle"
        :style="{ left: bound + '%' }"
        role="slider"
        :aria-label="`Граница ${parts[index]?.label} и ${parts[index + 1]?.label}`"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="bound"
        @keydown.left.prevent="nudge(index, -1)"
        @keydown.right.prevent="nudge(index, 1)"
      />
    </div>

    <p class="discipline-hint">Потяните границы цветных сегментов</p>
  </div>
</template>
