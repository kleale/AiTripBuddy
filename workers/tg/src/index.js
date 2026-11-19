const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'content-type': 'application/json' } })

function appUrl(env, id) {
  const base = env.APP_URL || 'https://kleale.github.io/AiTripBuddy/'
  return `${base}${base.includes('?') ? '&' : '?'}trip=${id}`
}

async function send(env, chatId, text, keyboard) {
  if (!env.BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
    }),
  })
}

async function tripSummary(env, id) {
  const raw = await env.TRIPS.get(`trip:${id}`)
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    const s = data.summary || {}
    return {
      title: s.title || 'Горнолыжная поездка',
      route: s.route || '',
      total: s.total || '',
      dates: s.dates || '',
      pax: s.pax || '',
    }
  } catch {
    return null
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    const hook = /^\/webhook\/([^/]+)$/.exec(url.pathname)
    if (hook && request.method === 'POST') {
      if (env.WEBHOOK_SECRET && hook[1] !== env.WEBHOOK_SECRET) return json({ error: 'forbidden' }, 403)
      const update = await request.json()
      const message = update.message
      const callback = update.callback_query
      const chatId = message?.chat?.id ?? callback?.message?.chat?.id
      const text = String(message?.text || '').trim()
      if (chatId) await env.TG.put(`chat:${chatId}`, String(chatId))

      const start = /^\/start(?:@\w+)?\s+trip_([A-Za-z0-9]+)/.exec(text)
      if (start) {
        const id = start[1]
        const summary = await tripSummary(env, id)
        if (!summary) {
          await send(env, chatId, 'Поездка не найдена или срок ссылки истёк.')
          return json({ ok: true })
        }
        await env.TG.put(`trip:${chatId}`, id)
        await env.TG.put(`confirm:${id}:${chatId}`, 'pending')
        await send(
          env,
          chatId,
          `<b>${summary.title}</b>\n${summary.route}\n${summary.dates} · ${summary.pax}\n${summary.total}\n\nПодтвердите участие:`,
          [[{ text: '✅ Подтвердить', callback_data: `confirm:${id}` }, { text: '❌ Не еду', callback_data: `decline:${id}` }]],
        )
        return json({ ok: true })
      }

      if (text.startsWith('/stop')) {
        const id = await env.TG.get(`trip:${chatId}`)
        if (id) await env.TG.delete(`confirm:${id}:${chatId}`)
        await env.TG.delete(`chat:${chatId}`)
        await send(env, chatId, 'Уведомления отключены. Данные участия удалены.')
        return json({ ok: true })
      }

      if (callback) {
        const [action, id] = String(callback.data || '').split(':')
        if (id) {
          await env.TG.put(`confirm:${id}:${chatId}`, action === 'confirm' ? 'yes' : 'no')
          await send(env, chatId, action === 'confirm' ? 'Участие подтверждено.' : 'Отмечено: не еду.')
        }
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callback.id }),
        })
        return json({ ok: true })
      }

      return json({ ok: true })
    }

    // Ручной запуск напоминаний: POST /remind/<secret> с { id, text }
    const remind = /^\/remind\/([^/]+)$/.exec(url.pathname)
    if (remind && request.method === 'POST') {
      if (env.WEBHOOK_SECRET && remind[1] !== env.WEBHOOK_SECRET) return json({ error: 'forbidden' }, 403)
      const { id, text } = await request.json()
      const chats = await env.TG.list({ prefix: `confirm:${id}:` })
      let sent = 0
      for (const key of chats.keys) {
        const status = await env.TG.get(key.name)
        if (status === 'no') continue
        const chatId = key.name.split(':').pop()
        await send(env, chatId, text || 'Напоминание о поездке', [[{ text: 'Открыть поездку', url: appUrl(env, id) }]])
        sent += 1
      }
      return json({ ok: true, sent })
    }

    return json({ ok: true, service: 'atb-telegram' })
  },
}
