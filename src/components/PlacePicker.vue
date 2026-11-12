<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { PlaceOption } from '@/types'

const props = defineProps<{
  options: PlaceOption[]
  modelLabel: string
  placeholder?: string
  emptyLabel?: string
  /** Сколько вариантов показывать без ввода */
  initialCount?: number
}>()

const emit = defineEmits<{ select: [id: string] }>()

const open = ref(false)
const active = ref(0)
const text = ref(props.modelLabel)
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.modelLabel,
  (value) => {
    text.value = value
  },
)

const filtered = computed(() => {
  const query = text.value.trim().toLowerCase()
  if (!query) return props.options.slice(0, props.initialCount ?? 12)
  return props.options
    .filter((option) => `${option.label} ${option.sublabel ?? ''}`.toLowerCase().includes(query))
    .slice(0, 20)
})

function onFocus(): void {
  open.value = true
  active.value = 0
  text.value = ''
}

function onInput(): void {
  open.value = true
  active.value = 0
}

function onBlur(): void {
  open.value = false
  text.value = props.modelLabel
}

function pick(option: PlaceOption): void {
  text.value = option.label
  emit('select', option.id)
  open.value = false
  inputRef.value?.blur()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    open.value = true
    active.value = (active.value + 1) % Math.max(1, filtered.value.length)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    open.value = true
    active.value = (active.value - 1 + filtered.value.length) % Math.max(1, filtered.value.length)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const option = filtered.value[active.value]
    if (option) pick(option)
  } else if (event.key === 'Escape') {
    open.value = false
    inputRef.value?.blur()
  }
}
</script>

<template>
  <div class="picker">
    <input
      ref="inputRef"
      v-model="text"
      class="text-input"
      type="text"
      autocomplete="off"
      :placeholder="placeholder ?? 'Начните вводить'"
      @focus="onFocus"
      @input="onInput"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div v-if="open && (filtered.length || emptyLabel)" class="picker-list nodrag nowheel">
      <div v-if="!filtered.length" class="picker-empty">{{ emptyLabel }}</div>
      <button
        v-for="(option, index) in filtered"
        :key="option.id"
        type="button"
        class="picker-item"
        :class="{ active: index === active }"
        @mousedown.prevent
        @mouseenter="active = index"
        @click="pick(option)"
      >
        <span class="picker-label">{{ option.label }}</span>
        <span v-if="option.sublabel" class="picker-sub">{{ option.sublabel }}</span>
      </button>
    </div>
  </div>
</template>
