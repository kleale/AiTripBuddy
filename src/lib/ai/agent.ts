import { aiSettings, addAiCost, aiAvailable } from '@/lib/ai/settings'
import { extractJson, PriceHintSchema, type AiPriceHint } from '@/lib/ai/schema'
import { aiToolDefinitions, runAiTool } from '@/lib/ai/tools'
import type { PriceHint } from '@/lib/price-hints'

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const CACHE_KEY = 'atd.ai.cache.v1'
const CACHE_TTL = 24 * 60 * 60 * 1000
const SYSTEM_PROMPT =
  'Ты аналитик цен горнолыжной поездки. Всегда вызывай инструменты справочника для чисел. ' +
  'Никогда не придумывай цены: low/high/typical бери только из tool results. ' +
  'Верни строго JSON: kind, low, high, typical, currency, unit, source, fetchedAt, confidence, rationale. ' +
  'low <= typical <= high. Если данных нет — вызови getResortFacts или getPriceHistory.'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | { type: string; text: string; cache_control?: { type: string } }[]
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

interface ToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

interface ChatUsage {
  prompt_tokens?: number
  completion_tokens?: number
  cost?: number
}

interface ChatResponse {
  choices?: { message?: ChatMessage }[]
  usage?: ChatUsage
  error?: { message?: string }
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function readCache(key: string): PriceHint | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, { hint: PriceHint; expiresAt: number }>
    const entry = cache[key]
    if (!entry || entry.expiresAt < Date.now()) return null
    return entry.hint
  } catch {
    return null
  }
}

function writeCache(key: string, hint: PriceHint): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const cache = raw ? (JSON.parse(raw) as Record<string, { hint: PriceHint; expiresAt: number }>) : {}
    cache[key] = { hint, expiresAt: Date.now() + CACHE_TTL }
    const keys = Object.keys(cache)
    if (keys.length > 80) delete cache[keys[0] as string]
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignore
  }
}

export function clearAiCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}

async function callModel(
  model: string,
  messages: ChatMessage[],
  options: { tools?: boolean; json?: boolean } = {},
): Promise<{ message: ChatMessage; cost: number }> {
  const key = aiSettings.value.apiKey.trim()
  if (!key) throw new Error('no key')

  const system = messages[0]
  const cacheable = model.includes('claude') || model.includes('anthropic')
  const prepared = messages.map((message, index) =>
    index === 0 && cacheable && typeof message.content === 'string'
      ? { ...message, content: [{ type: 'text', text: message.content, cache_control: { type: 'ephemeral' } }] }
      : message,
  )

  const body: Record<string, unknown> = {
    model,
    messages: prepared,
    temperature: 0.2,
    max_tokens: 900,
    usage: { include: true },
  }
  if (options.tools) {
    body.tools = aiToolDefinitions
    body.tool_choice = 'auto'
  }
  if (options.json) body.response_format = { type: 'json_object' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'X-Title': 'AiTripBuddy',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`openrouter ${response.status}`)
    const data = (await response.json()) as ChatResponse
    if (data.error) throw new Error(data.error.message ?? 'openrouter error')
    const message = data.choices?.[0]?.message
    if (!message) throw new Error('empty response')
    const cost = Number(data.usage?.cost) || 0
    addAiCost(cost)
    return { message, cost }
  } finally {
    clearTimeout(timer)
    void system
  }
}

async function parseStage(context: Record<string, unknown>, fallback: PriceHint): Promise<Record<string, unknown>> {
  if (!context.query || !aiSettings.value.cheapModel) return context
  try {
    const { message } = await callModel(
      aiSettings.value.cheapModel,
      [
        { role: 'system', content: 'Нормализуй контекст цены в JSON без пояснений. Верни только JSON.' },
        { role: 'user', content: JSON.stringify({ fallback, context }) },
      ],
      { json: true },
    )
    const parsed = extractJson(typeof message.content === 'string' ? message.content : '')
    return parsed && typeof parsed === 'object' ? { ...context, ...(parsed as Record<string, unknown>) } : context
  } catch {
    return context
  }
}

function reconcile(modelHint: AiPriceHint, toolHint: PriceHint | null, fallback: PriceHint): PriceHint {
  const source = toolHint ?? fallback
  return {
    kind: source.kind,
    low: source.low,
    high: source.high,
    typical: source.typical,
    currency: source.currency,
    unit: source.unit,
    source: source.source,
    fetchedAt: source.fetchedAt,
    confidence: source.confidence,
    rationale: modelHint.rationale || source.rationale,
  }
}

async function runAgent(model: string, context: Record<string, unknown>, fallback: PriceHint): Promise<PriceHint | null> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'Дай диапазон цены. Используй tools, не выдумывай числа.',
        fallback,
        context,
      }),
    },
  ]

  let toolHint: PriceHint | null = null

  for (let round = 0; round < 4; round += 1) {
    const { message } = await callModel(model, messages, { tools: true })
    if (message.tool_calls?.length) {
      messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls })
      for (const call of message.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        } catch {
          // keep empty args
        }
        const result = await runAiTool(call.function.name, args)
        if (result.hint) toolHint = result.hint
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })
      }
      continue
    }

    const content = typeof message.content === 'string' ? message.content : ''
    const parsed = extractJson(content)
    const validation = PriceHintSchema.safeParse(parsed)
    if (validation.success) return reconcile(validation.data, toolHint, fallback)

    messages.push({ role: 'assistant', content })
    messages.push({
      role: 'user',
      content: `JSON не прошёл валидацию: ${validation.error.issues.map((issue) => issue.message).join('; ')}. Верни только корректный JSON.`,
    })
  }

  return null
}

/** Вызов OpenRouter с tools; при любой ошибке возвращает локальную оценку. */
export async function llmPriceHint(fallback: PriceHint, context: Record<string, unknown> = {}): Promise<PriceHint> {
  if (!aiAvailable.value) return fallback

  const cacheKey = hashString(JSON.stringify({ fallback, context, settings: aiSettings.value }))
  const cached = readCache(cacheKey)
  if (cached) return cached

  const parsedContext = await parseStage(context, fallback)
  const strong = parsedContext.compare === true
  const model = strong ? aiSettings.value.strongModel : aiSettings.value.midModel
  try {
    let hint = await runAgent(model, parsedContext, fallback)
    if (!hint) hint = await runAgent(aiSettings.value.strongModel, parsedContext, fallback)
    if (!hint) return fallback
    writeCache(cacheKey, hint)
    return hint
  } catch {
    return fallback
  }
}
