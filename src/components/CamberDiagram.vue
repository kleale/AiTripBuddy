<script setup lang="ts">
import type { CamberProfile } from '@/data/board-info'

defineProps<{ type: CamberProfile }>()
</script>

<template>
  <svg viewBox="0 0 140 54" class="camber-svg" role="img" :aria-label="`Профиль ${type}`">
    <line x1="8" y1="44" x2="132" y2="44" class="camber-snow" />
    <path v-if="type === 'camber'" d="M10 38 Q70 10 130 38" class="camber-line" />
    <path v-else-if="type === 'rocker'" d="M10 26 Q70 48 130 26" class="camber-line" />
    <path v-else-if="type === 'flat'" d="M10 36 L130 36" class="camber-line" />
    <path v-else d="M10 24 Q38 40 70 32 Q102 40 130 24" class="camber-line" />
    <circle cx="70" cy="30" r="1.5" class="camber-dot" />
  </svg>
</template>
