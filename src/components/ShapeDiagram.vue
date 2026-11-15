<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ type: string }>()

/** Контур доски сверху: нос сверху, хвост снизу. */
const outline = computed(() => {
  const cx = 80
  const noseY = 16
  const tailY = 304
  const width = 54
  const waist = 44

  if (props.type === 'powder') {
    return `M${cx} ${noseY} C${cx - 44} ${noseY + 10}, ${cx - 40} ${noseY + 52}, ${cx - 34} ${noseY + 74} L${cx - 28} 210 L${cx - 12} 250 L${cx - 4} ${tailY} L${cx - 2} 250 L${cx + 10} 210 L${cx + 28} 250 L${cx + 34} ${tailY} L${cx + 4} 250 L${cx + 12} 250 L${cx + 28} 210 L${cx + 34} ${noseY + 74} C${cx + 40} ${noseY + 52}, ${cx + 44} ${noseY + 10}, ${cx} ${noseY} Z`
  }

  const noseExtra = props.type === 'directional' ? 18 : props.type === 'directional-twin' ? 8 : 0
  const tailWidth = props.type === 'tapered' ? 34 : props.type === 'directional' ? 44 : width
  const asym = props.type === 'asym' ? 8 : 0
  const noseW = width + 8
  const top = tailY - (tailY - noseY) - noseExtra

  return [
    `M${cx} ${top}`,
    `C${cx - noseW} ${top + 8}, ${cx - width} ${top + 40}, ${cx - width + 4} ${top + 70}`,
    `C${cx - waist + asym / 2} 160, ${cx - waist - asym / 2} 220, ${cx - tailWidth + 4} ${tailY - 34}`,
    `C${cx - tailWidth} ${tailY - 14}, ${cx - tailWidth + 8} ${tailY}, ${cx} ${tailY}`,
    `C${cx + tailWidth - 8} ${tailY}, ${cx + tailWidth} ${tailY - 14}, ${cx + tailWidth - 4} ${tailY - 34}`,
    `C${cx + waist + asym / 2} 220, ${cx + waist - asym / 2} 160, ${cx + width - 4} ${top + 70}`,
    `C${cx + width} ${top + 40}, ${cx + noseW} ${top + 8}, ${cx} ${top}`,
    'Z',
  ].join(' ')
})

const bindings = computed(() => {
  const offset = props.type === 'directional' || props.type === 'tapered' ? 12 : 0
  return [150 - offset, 210 - offset]
})
</script>

<template>
  <svg viewBox="0 0 160 320" class="shape-svg" role="img" :aria-label="`Форма доски ${type}`">
    <path :d="outline" class="shape-board" />
    <line x1="80" y1="28" x2="80" y2="292" class="shape-center" />
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
    <text x="80" y="10" text-anchor="middle" class="shape-label">нос</text>
    <text x="80" y="318" text-anchor="middle" class="shape-label">хвост</text>
  </svg>
</template>
