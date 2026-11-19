import { computed, reactive, ref } from 'vue'

export interface AiSettings {
  enabled: boolean
  apiKey: string
  cheapModel: string
  midModel: string
  strongModel: string
  /** Ключ DeepSeek для аудита поездки; хранится только в браузере. */
  deepseekKey: string
  deepseekModel: string
}

const STORAGE_KEY = 'atd.ai.settings.v1'
const METRICS_KEY = 'atd.ai.metrics.v1'

const defaults: AiSettings = {
  enabled: true,
  apiKey: '',
  cheapModel: 'openai/gpt-4o-mini',
  midModel: 'anthropic/claude-3.5-sonnet',
  strongModel: 'openai/gpt-4o',
  deepseekKey: '',
  deepseekModel: 'deepseek-chat',
}

function readSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<AiSettings>
    return {
      ...defaults,
      ...parsed,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      deepseekKey: typeof parsed.deepseekKey === 'string' ? parsed.deepseekKey : '',
      deepseekModel:
        typeof parsed.deepseekModel === 'string' && parsed.deepseekModel.trim()
          ? parsed.deepseekModel
          : defaults.deepseekModel,
    }
  } catch {
    return { ...defaults }
  }
}

export const aiSettings = ref<AiSettings>(readSettings())
export const aiSettingsOpen = ref(false)
export const aiAvailable = computed(() => aiSettings.value.enabled && aiSettings.value.apiKey.trim().length > 0)
export const deepseekAvailable = computed(
  () => aiSettings.value.enabled && aiSettings.value.deepseekKey.trim().length > 0,
)

export function saveAiSettings(patch: Partial<AiSettings>): void {
  aiSettings.value = { ...aiSettings.value, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(aiSettings.value))
  } catch {
    // ignore storage errors
  }
}

export function openAiSettings(): void {
  aiSettingsOpen.value = true
}

export function closeAiSettings(): void {
  aiSettingsOpen.value = false
}

/* ---------- метрики сессии ---------- */

export interface AiMetrics {
  shown: number
  accepted: number
  costUsd: number
  requests: number
}

function readMetrics(): AiMetrics {
  try {
    const raw = sessionStorage.getItem(METRICS_KEY)
    if (!raw) return { shown: 0, accepted: 0, costUsd: 0, requests: 0 }
    const parsed = JSON.parse(raw) as Partial<AiMetrics>
    return {
      shown: Number(parsed.shown) || 0,
      accepted: Number(parsed.accepted) || 0,
      costUsd: Number(parsed.costUsd) || 0,
      requests: Number(parsed.requests) || 0,
    }
  } catch {
    return { shown: 0, accepted: 0, costUsd: 0, requests: 0 }
  }
}

export const aiMetrics = reactive<AiMetrics>(readMetrics())

function persistMetrics(): void {
  try {
    sessionStorage.setItem(METRICS_KEY, JSON.stringify(aiMetrics))
  } catch {
    // ignore
  }
}

export function recordHintShown(): void {
  aiMetrics.shown += 1
  persistMetrics()
}

export function recordHintAccepted(): void {
  aiMetrics.accepted += 1
  persistMetrics()
}

export function addAiCost(costUsd: number): void {
  if (Number.isFinite(costUsd) && costUsd > 0) aiMetrics.costUsd += costUsd
  aiMetrics.requests += 1
  persistMetrics()
}

export function resetAiMetrics(): void {
  aiMetrics.shown = 0
  aiMetrics.accepted = 0
  aiMetrics.costUsd = 0
  aiMetrics.requests = 0
  persistMetrics()
}

export function acceptanceRate(): number {
  return aiMetrics.shown > 0 ? Math.round((aiMetrics.accepted / aiMetrics.shown) * 100) : 0
}
