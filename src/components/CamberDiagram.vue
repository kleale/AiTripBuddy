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
    <path v-else-if="type === 'hybrid'" d="M10 24 Q38 40 70 32 Q102 40 130 24" class="camber-line" />
    <path v-else-if="type === 'crc'" d="M10 24 Q30 38 50 30 Q70 18 90 30 Q110 38 130 24" class="camber-line" />
    <path v-else-if="type === 'directional'" d="M10 20 Q45 8 70 28 L130 36" class="camber-line" />
    <template v-else-if="type === '3bt'">
      <path d="M10 24 Q70 18 130 24" class="camber-line" />
      <path d="M10 30 Q70 24 130 30" class="camber-line-soft" />
    </template>
    <path v-else-if="type === 'spoon'" d="M10 30 L78 34 Q108 22 130 12" class="camber-line" />
    <path v-else-if="type === 'pow'" d="M10 18 Q55 46 95 34 L130 36" class="camber-line" />
    <circle cx="70" cy="30" r="1.5" class="camber-dot" />
  </svg>
</template>
