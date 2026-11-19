import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'atd.theme.v1'

function readTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export const theme = ref<Theme>(readTheme())

export function applyTheme(value: Theme = theme.value): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = value
  document.documentElement.style.colorScheme = value
}

export function setTheme(value: Theme): void {
  theme.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // ignore storage errors
  }
  applyTheme(value)
}

export function toggleTheme(): void {
  setTheme(theme.value === 'light' ? 'dark' : 'light')
}

applyTheme()