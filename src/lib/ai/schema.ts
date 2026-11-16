import { z } from 'zod'

export const CurrencySchema = z.enum(['RUB', 'EUR', 'USD', 'GEL', 'KZT'])
export const HintKindSchema = z.enum(['hotel', 'transfer', 'skipass', 'food'])

export const PriceHintSchema = z
  .object({
    kind: HintKindSchema,
    low: z.number().nonnegative(),
    high: z.number().nonnegative(),
    typical: z.number().nonnegative(),
    currency: CurrencySchema,
    unit: z.string().min(1).max(80),
    source: z.string().min(1).max(200),
    fetchedAt: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    rationale: z.string().max(500),
  })
  .refine((hint) => hint.low <= hint.typical && hint.typical <= hint.high, {
    message: 'low <= typical <= high',
  })

export const PriceRequestSchema = z.object({
  kind: HintKindSchema,
  place: z.string().min(1).max(160),
  country: z.string().max(80).optional(),
  currency: CurrencySchema,
  query: z.string().max(500).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export type AiPriceHint = z.infer<typeof PriceHintSchema>
export type AiPriceRequest = z.infer<typeof PriceRequestSchema>

/** Достаёт JSON из ответа модели, даже если он в markdown-блоке. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // try fenced block
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1])
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      // ignore
    }
  }
  return null
}
