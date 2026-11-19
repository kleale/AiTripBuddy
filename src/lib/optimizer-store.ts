import { ref } from 'vue'

export const optimizerOpen = ref(false)

export function openOptimizer(): void {
  optimizerOpen.value = true
}

export function closeOptimizer(): void {
  optimizerOpen.value = false
}
