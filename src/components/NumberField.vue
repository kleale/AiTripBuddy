<script setup lang="ts">
defineProps<{
  modelValue: number
  label?: string
  suffix?: string
  step?: number
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const parsed = raw === '' ? 0 : Number(raw)
  emit('update:modelValue', Number.isFinite(parsed) ? parsed : 0)
}
</script>

<template>
  <label class="num-field">
    <span v-if="label" class="num-label">{{ label }}</span>
    <span class="num-box">
      <input
        type="number"
        inputmode="decimal"
        min="0"
        :step="step ?? 1"
        :placeholder="placeholder ?? '0'"
        :value="modelValue === 0 ? '' : modelValue"
        @input="onInput"
      />
      <span v-if="suffix" class="num-suffix">{{ suffix }}</span>
    </span>
  </label>
</template>
