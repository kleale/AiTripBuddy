import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveAiSettings } from '@/lib/ai/settings'
import { llmPriceHint, clearAiCache } from '@/lib/ai/agent'
import { runAiTool } from '@/lib/ai/tools'
import { hotelPriceHint } from '@/lib/price-hints'
import type { StayStop } from '@/types'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
})
vi.stubGlobal('sessionStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
})

function stay(): StayStop {
  return {
    id: 's1',
    kind: 'stay',
    placeKind: 'resort',
    resortId: 'hakuba',
    resort: 'Хакуба',
    country: 'Япония',
    hotel: '',
    lat: 36.7,
    lng: 137.85,
    nights: 7,
    rooms: 1,
    hotelPerNight: 0,
    hotelSource: null,
    hotelStars: 3,
    skipassDays: 5,
    skipassPerDay: 0,
    meals: { breakfast: 'hotel', lunch: 'cafe', dinner: 'cafe' },
    foodPerDayOverride: null,
    checkIn: '2027-01-23',
  } as StayStop
}

const validJson = JSON.stringify({
  kind: 'hotel',
  low: 1,
  high: 2,
  typical: 1,
  currency: 'RUB',
  unit: 'за номер',
  source: 'model',
  fetchedAt: '2026-11-16',
  confidence: 'high',
  rationale: 'модель посчитала',
})

function response(message: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message }], usage: { cost: 0.001 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const toolCall = {
  role: 'assistant',
  content: '',
  tool_calls: [
    {
      id: 'call-1',
      type: 'function',
      function: { name: 'getSkipassPrice', arguments: JSON.stringify({ resortId: 'hakuba', currency: 'RUB' }) },
    },
  ],
}

beforeEach(() => {
  store.clear()
  saveAiSettings({
    enabled: true,
    apiKey: 'test-key',
    cheapModel: 'cheap',
    midModel: 'mid',
    strongModel: 'strong',
  })
  clearAiCache()
})

describe('LLM-агент с tools', () => {
  it('берёт числа из tool result, а не из ответа модели', async () => {
    const local = hotelPriceHint(stay(), 'RUB')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(toolCall))
      .mockResolvedValueOnce(response({ role: 'assistant', content: validJson }))
    vi.stubGlobal('fetch', fetchMock)

    const hint = await llmPriceHint(local, { kind: 'hotel', place: 'Хакуба', currency: 'RUB' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(hint.typical).not.toBe(1)
    expect(hint.typical).toBeGreaterThan(0)
    expect(hint.source).toContain('гид')
  })

  it('повторяет запрос на невалидный JSON', async () => {
    const local = hotelPriceHint(stay(), 'RUB')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(toolCall))
      .mockResolvedValueOnce(response({ role: 'assistant', content: 'не json' }))
      .mockResolvedValueOnce(response({ role: 'assistant', content: validJson }))
    vi.stubGlobal('fetch', fetchMock)

    const hint = await llmPriceHint(local, { kind: 'hotel', place: 'Хакуба', currency: 'RUB' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(hint.typical).toBeGreaterThan(0)
  })

  it('кэширует ответ на 24 часа', async () => {
    const local = hotelPriceHint(stay(), 'RUB')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(toolCall))
      .mockResolvedValueOnce(response({ role: 'assistant', content: validJson }))
    vi.stubGlobal('fetch', fetchMock)

    await llmPriceHint(local, { kind: 'hotel', place: 'Хакуба', currency: 'RUB', unique: 'cache' })
    await llmPriceHint(local, { kind: 'hotel', place: 'Хакуба', currency: 'RUB', unique: 'cache' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tool getResortFacts возвращает факты курорта', async () => {
    const result = await runAiTool('getResortFacts', { place: 'Хакуба' })
    expect(result.facts?.name).toBe('Хакуба')
    expect(result.facts?.season).toBeTruthy()
  })
})
