<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ type: string }>()

/** Чёткие контуры под каждый тип: нос сверху, хвост снизу. */
const outlines: Record<string, string> = {
  twin: 'M80 14 C48 22 44 54 44 84 L44 232 C44 268 52 298 80 306 C108 298 116 268 116 232 L116 84 C116 54 112 22 80 14 Z',
  'directional-twin':
    'M80 8 C34 18 28 56 30 92 L34 212 C38 252 46 292 80 300 C112 292 118 254 120 214 L122 92 C124 56 118 18 80 8 Z',
  directional:
    'M80 10 C42 22 38 56 38 88 L38 236 C38 272 48 302 80 310 C106 302 110 274 110 244 L110 88 C110 54 108 22 80 10 Z',
  tapered:
    'M80 14 C42 24 38 58 38 90 L38 228 C38 264 48 294 80 300 C108 294 116 266 116 232 L116 90 C116 58 114 24 80 14 Z',
  asym:
    'M80 14 C44 24 38 70 40 116 C31 176 45 246 80 306 C112 246 122 176 118 116 C118 70 114 24 80 14 Z',
  powder:
    'M80 10 C36 22 32 62 34 96 L36 208 L50 240 L54 306 L70 260 L80 236 L90 260 L106 306 L110 240 L124 208 L126 96 C128 62 124 22 80 10 Z',
}

const bindings = computed(() => {
  if (props.type === 'directional') return [172, 232]
  if (props.type === 'tapered' || props.type === 'powder') return [168, 228]
  if (props.type === 'directional-twin') return [164, 224]
  return [160, 220]
})

const outline = computed(() => outlines[props.type] ?? outlines.twin)
</script>

<template>
  <svg viewBox="0 0 160 320" class="shape-svg" role="img" :aria-label="`Форма доски ${type}`">
    <path :d="outline" class="shape-board" />
    <line x1="80" y1="26" x2="80" y2="294" class="shape-center" />
    <rect
      v-for="(y, index) in bindings"
      :key="index"
      x="48"
      :y="y - 12"
      width="64"
      height="20"
      rx="5"
      class="shape-binding"
    />

    <line v-if="type === 'tapered'" x1="50" y1="286" x2="110" y2="286" class="shape-mark" />
    <line v-if="type === 'asym'" x1="28" y1="180" x2="28" y2="230" class="shape-mark" />
    <line v-if="type === 'powder'" x1="80" y1="236" x2="80" y2="282" class="shape-mark" />

    <text x="80" y="8" text-anchor="middle" class="shape-label">нос</text>
    <text x="80" y="318" text-anchor="middle" class="shape-label">хвост</text>
  </svg>
</template>
