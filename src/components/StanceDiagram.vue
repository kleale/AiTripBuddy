<script setup lang="ts">
import { computed } from 'vue'
import type { SkillLevel, StanceSetup, StyleMix } from '@/types'
import { stanceAdvice } from '@/lib/gear-fit'

const props = defineProps<{
  modelValue: StanceSetup
  style: StyleMix
  level: SkillLevel
}>()
const emit = defineEmits<{ 'update:modelValue': [value: StanceSetup] }>()

const advice = computed(() => stanceAdvice(props.style, props.level))
const presets = [
  { id: 'carving', label: 'Карвинг', setup: { widthCm: 50, frontAngle: 18, backAngle: 6, setbackMm: 0, switch: false } },
  { id: 'duck', label: 'Дак', setup: { widthCm: 54, frontAngle: 12, backAngle: -9, setbackMm: 0, switch: true } },
  { id: 'freeride', label: 'Фрирайд', setup: { widthCm: 52, frontAngle: 18, backAngle: 0, setbackMm: -25, switch: false } },
  { id: 'flat', label: 'Флэт', setup: { widthCm: 52, frontAngle: 15, backAngle: -3, setbackMm: -10, switch: false } },
]

const stancePx = computed(() => 70 + ((props.modelValue.widthCm - 40) / 30) * 70)
const centerY = 115
const frontY = computed(() => centerY - stancePx.value / 2 + props.modelValue.setbackMm / 8)
const backY = computed(() => centerY + stancePx.value / 2 + props.modelValue.setbackMm / 8)
const frontAngle = computed(() => props.modelValue.frontAngle)
const backAngle = computed(() => props.modelValue.backAngle)

function update(patch: Partial<StanceSetup>): void {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function onNumber(key: keyof StanceSetup, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  update({ [key]: value } as Partial<StanceSetup>)
}

function applyAdvice(): void {
  update(advice.value.setup)
}
</script>

<template>
  <div class="stance">
    <div class="stance-svg-wrap">
      <svg viewBox="0 0 160 240" class="stance-svg" role="img" aria-label="Схема стойки на доске">
        <rect x="54" y="8" width="52" height="224" rx="26" class="stance-board" />
        <rect
          x="38"
          :y="frontY - 11"
          width="84"
          height="22"
          rx="6"
          class="stance-binding"
          :transform="`rotate(${frontAngle} 80 ${frontY})`"
        />
        <rect
          x="38"
          :y="backY - 11"
          width="84"
          height="22"
          rx="6"
          class="stance-binding"
          :transform="`rotate(${backAngle} 80 ${backY})`"
        />
        <line x1="80" :y1="frontY" x2="80" :y2="backY" class="stance-measure" />
        <text x="80" :y="centerY + 4" text-anchor="middle" class="stance-label">{{ modelValue.widthCm }} см</text>
        <text x="80" y="30" text-anchor="middle" class="stance-caption">перед {{ frontAngle }}°</text>
        <text x="80" y="230" text-anchor="middle" class="stance-caption">зад {{ backAngle }}°</text>
      </svg>
    </div>

    <div class="stance-controls">
      <label class="stance-row">
        <span>Ширина стойки</span>
        <input type="range" min="40" max="64" :value="modelValue.widthCm" @input="onNumber('widthCm', $event)" />
        <b>{{ modelValue.widthCm }} см</b>
      </label>
      <label class="stance-row">
        <span>Передний угол</span>
        <input type="range" min="0" max="30" :value="modelValue.frontAngle" @input="onNumber('frontAngle', $event)" />
        <b>+{{ modelValue.frontAngle }}°</b>
      </label>
      <label class="stance-row">
        <span>Задний угол</span>
        <input type="range" min="-20" max="30" :value="modelValue.backAngle" @input="onNumber('backAngle', $event)" />
        <b>{{ modelValue.backAngle }}°</b>
      </label>
      <label class="stance-row">
        <span>Сдвиг креплений</span>
        <input type="range" min="-60" max="40" :value="modelValue.setbackMm" @input="onNumber('setbackMm', $event)" />
        <b>{{ modelValue.setbackMm }} мм</b>
      </label>
      <label class="stance-check">
        <input type="checkbox" :checked="modelValue.switch" @change="update({ switch: ($event.target as HTMLInputElement).checked })" />
        <span>Свитч: зеркальная стойка</span>
      </label>
    </div>

    <div class="stance-presets">
      <span>Типы стоек:</span>
      <button v-for="preset in presets" :key="preset.id" type="button" @click="update(preset.setup)">
        {{ preset.label }}
      </button>
    </div>

    <div class="stance-advice">
      <p>{{ advice.note }}</p>
      <div class="stance-rec">
        <span>{{ advice.setup.widthCm }} см · +{{ advice.setup.frontAngle }}° / {{ advice.setup.backAngle }}° · сдвиг {{ advice.setup.setbackMm }} мм</span>
        <button type="button" class="mini-btn" @click="applyAdvice">Применить рекомендацию</button>
      </div>
    </div>
  </div>
</template>
