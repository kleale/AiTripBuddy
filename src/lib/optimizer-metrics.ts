import { reactive } from 'vue'

const KEY = 'atd.optimizer.metrics.v1'

export interface OptimizerMetrics {
  runs: number
  variants: number
  applied: number
  saved: number
  lastMs: number
  lastRun: string
}

function read(): OptimizerMetrics {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { runs: 0, variants: 0, applied: 0, saved: 0, lastMs: 0, lastRun: '' }
    const parsed = JSON.parse(raw) as Partial<OptimizerMetrics>
    return {
      runs: Number(parsed.runs) || 0,
      variants: Number(parsed.variants) || 0,
      applied: Number(parsed.applied) || 0,
      saved: Number(parsed.saved) || 0,
      lastMs: Number(parsed.lastMs) || 0,
      lastRun: typeof parsed.lastRun === 'string' ? parsed.lastRun : '',
    }
  } catch {
    return { runs: 0, variants: 0, applied: 0, saved: 0, lastMs: 0, lastRun: '' }
  }
}

export const optimizerMetrics = reactive<OptimizerMetrics>(read())

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(optimizerMetrics))
  } catch {
    // ignore
  }
}

export function recordOptimizerRun(variants: number, ms: number): void {
  optimizerMetrics.runs += 1
  optimizerMetrics.variants += variants
  optimizerMetrics.lastMs = Math.round(ms)
  optimizerMetrics.lastRun = new Date().toISOString()
  persist()
}

export function recordOptimizerApplied(saved = 0): void {
  optimizerMetrics.applied += 1
  optimizerMetrics.saved += Math.max(0, Math.round(saved))
  persist()
}
