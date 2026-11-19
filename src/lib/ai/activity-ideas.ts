import { z } from 'zod'
import { aiSettings, deepseekAvailable } from '@/lib/ai/settings'
import type { ActivityIdea } from '@/data/activity-ideas'

export interface ActivityIdeasResult {
  summary: string
  ideas: ActivityIdea[]
  provider: 'local' | 'deepseek'
}

const ENDPOINT = 'https://api.deepseek.com/chat/completions'

const IdeasSchema = z.object({
  summary: z.string().min(1).max(500),
  rankedIds: z.array(z.string()).max(20).default([]),
})

export function localActivityIdeas(
  ideas: ActivityIdea[],
  max = 8,
): ActivityIdeasResult {
  return {
    summary: ideas.length
      ? `Подборка для этого места: ${ideas.length} идей. Цены ориентировочные, проверяйте у поставщика.`
      : 'Для этого места пока нет курируемых идей — добавьте мероприятие вручную.',
    ideas: ideas.slice(0, max),
    provider: 'local',
  }
}

/** DeepSeek только ранжирует курируемые идеи; места и цены не генерируются. */
export async function llmActivityIdeas(
  ideas: ActivityIdea[],
  context: { place: string; country?: string; checkIn?: string; pax: number; currency: string },
): Promise<ActivityIdeasResult> {
  const local = localActivityIdeas(ideas)
  if (!deepseekAvailable.value || ideas.length === 0) return local

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiSettings.value.deepseekKey.trim()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: aiSettings.value.deepseekModel || 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Ты подбираешь мероприятия для горнолыжной поездки. Используй только переданные идеи: ' +
              'не придумывай новые места и цены. Верни JSON: summary и rankedIds.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              context,
              ideas: ideas.map((item) => ({
                id: item.id,
                title: item.title,
                kind: item.kind,
                placeName: item.placeName,
                durationHours: item.durationHours,
                priceFrom: item.priceFrom,
                currency: item.currency,
                description: item.description,
              })),
            }),
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!response.ok) return local
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content ?? ''
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) return local
    const parsed = IdeasSchema.safeParse(JSON.parse(content.slice(start, end + 1)))
    if (!parsed.success) return local

    const rank = new Map(parsed.data.rankedIds.map((id, index) => [id, index]))
    const ranked = [...ideas].sort((a, b) => {
      const ai = rank.get(a.id) ?? 99
      const bi = rank.get(b.id) ?? 99
      return ai - bi
    })
    return {
      summary: parsed.data.summary,
      ideas: ranked.slice(0, 8),
      provider: 'deepseek',
    }
  } catch {
    return local
  } finally {
    clearTimeout(timer)
  }
}
