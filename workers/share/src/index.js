const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
}

const TTL = 60 * 60 * 24 * 180
const MAGIC_TTL = 60 * 15
const SESSION_TTL = 60 * 60 * 24 * 30

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
  })
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch])
}

function id() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10)
}

function appUrl(env, requestId, origin) {
  const base = env.APP_URL || 'https://kleale.github.io/AiTripBuddy/'
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}trip=${requestId}&api=${encodeURIComponent(origin)}`
}

function token(bytes = 24) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return [...data].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function emailKey(email) {
  const data = new TextEncoder().encode(email.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 160 ? email : ''
}

function authToken(request) {
  const header = request.headers.get('authorization') || ''
  const match = /^Bearer\s+([A-Za-z0-9]+)$/i.exec(header)
  return match?.[1] ?? ''
}

async function sessionEmail(env, request) {
  const value = authToken(request)
  if (!value) return ''
  const raw = await env.TRIPS.get(`session:${value}`)
  if (!raw) return ''
  try {
    return String(JSON.parse(raw).email || '')
  } catch {
    return ''
  }
}

async function sendMagicEmail(env, email, link) {
  if (!env.RESEND_API_KEY) return false
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'AiTripBuddy <noreply@aitripbuddy.app>',
      to: [email],
      subject: 'Ссылка для входа в AiTripBuddy',
      html: `<p>Вход в AiTripBuddy по ссылке:</p><p><a href="${link}">Открыть AiTripBuddy</a></p><p>Ссылка действует 15 минут. Если вы не запрашивали вход, проигнорируйте письмо.</p>`,
    }),
  })
  return response.ok
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

    if (url.pathname === '/api/auth/magic' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid json' }, 400)
      }
      const email = normalizeEmail(body?.email)
      if (!email) return json({ error: 'invalid email' }, 400)

      // Простое ограничение: не больше одного письма в минуту на адрес.
      const cooldown = await env.TRIPS.get(`magic-cooldown:${email}`)
      if (cooldown) return json({ error: 'too many requests' }, 429)

      const magic = token(24)
      const link = `${url.origin}/auth/verify?token=${magic}`
      await env.TRIPS.put(`magic:${magic}`, JSON.stringify({ email }), { expirationTtl: MAGIC_TTL })
      await env.TRIPS.put(`magic-cooldown:${email}`, '1', { expirationTtl: 60 })

      let sent
      try {
        sent = await sendMagicEmail(env, email, link)
      } catch {
        sent = false
      }
      if (!sent && env.ALLOW_DEV_LINKS !== 'true') {
        return json({ error: 'email_not_configured' }, 503)
      }
      return json(sent ? { sent: true } : { sent: false, devLink: link })
    }

    if (url.pathname === '/auth/verify' && request.method === 'GET') {
      const magic = url.searchParams.get('token') || ''
      const raw = magic ? await env.TRIPS.get(`magic:${magic}`) : null
      if (!raw) return new Response('Ссылка входа недействительна или истекла', { status: 400 })
      await env.TRIPS.delete(`magic:${magic}`)
      let email
      try {
        email = normalizeEmail(JSON.parse(raw).email)
      } catch {
        email = ''
      }
      if (!email) return new Response('Ссылка входа повреждена', { status: 400 })

      const session = token(32)
      await env.TRIPS.put(`session:${session}`, JSON.stringify({ email }), {
        expirationTtl: SESSION_TTL,
      })

      if (url.searchParams.get('format') === 'json') {
        return json({ session, email })
      }

      const base = env.APP_URL || 'https://kleale.github.io/AiTripBuddy/'
      const sep = base.includes('?') ? '&' : '?'
      return Response.redirect(`${base}${sep}auth=${session}`, 302)
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const email = await sessionEmail(env, request)
      return email ? json({ email }) : json({ error: 'unauthorized' }, 401)
    }

    if (url.pathname === '/api/admin/me' && request.method === 'GET') {
      const email = await sessionEmail(env, request)
      if (!email) return json({ error: 'unauthorized' }, 401)
      const admin = (env.ADMIN_EMAIL || 'aibuddycomp@gmail.com').trim().toLowerCase()
      if (email !== admin) return json({ error: 'forbidden' }, 403)
      return json({ admin: true, email })
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const value = authToken(request)
      if (value) await env.TRIPS.delete(`session:${value}`)
      return json({ ok: true })
    }

    if (url.pathname === '/api/account' && request.method === 'DELETE') {
      const email = await sessionEmail(env, request)
      if (!email) return json({ error: 'unauthorized' }, 401)
      await env.TRIPS.delete(`library:${await emailKey(email)}`)
      const value = authToken(request)
      if (value) await env.TRIPS.delete(`session:${value}`)
      return json({ ok: true })
    }

    if (url.pathname === '/api/library' && request.method === 'GET') {
      const email = await sessionEmail(env, request)
      if (!email) return json({ error: 'unauthorized' }, 401)
      const raw = await env.TRIPS.get(`library:${await emailKey(email)}`)
      if (!raw) return json({ trips: [], updatedAt: null })
      return new Response(raw, {
        headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' },
      })
    }

    if (url.pathname === '/api/library' && request.method === 'PUT') {
      const email = await sessionEmail(env, request)
      if (!email) return json({ error: 'unauthorized' }, 401)
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid json' }, 400)
      }
      const trips = Array.isArray(body?.trips) ? body.trips : null
      if (!trips) return json({ error: 'trips must be an array' }, 400)
      if (trips.length > 50) return json({ error: 'too many trips' }, 400)
      const payload = JSON.stringify({ trips, updatedAt: new Date().toISOString() })
      if (payload.length > 900000) return json({ error: 'library too large' }, 413)
      await env.TRIPS.put(`library:${await emailKey(email)}`, payload)
      return json({ ok: true, count: trips.length })
    }

    if (url.pathname === '/api/trips' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return json({ error: 'invalid json' }, 400)
      }
      const { code, summary, png } = body || {}
      if (typeof code !== 'string' || !summary || typeof png !== 'string') {
        return json({ error: 'code, summary and png are required' }, 400)
      }
      const tripId = id()
      await env.TRIPS.put(`trip:${tripId}`, JSON.stringify({ code, summary }), {
        expirationTtl: TTL,
      })
      await env.TRIPS.put(`og:${tripId}`, png, { expirationTtl: TTL })
      return json({ id: tripId, url: `${url.origin}/s/${tripId}` })
    }

    const apiMatch = /^\/api\/trips\/([A-Za-z0-9]+)$/.exec(url.pathname)
    if (apiMatch) {
      const data = await env.TRIPS.get(`trip:${apiMatch[1]}`)
      return data ? new Response(data, { headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } }) : json({ error: 'not found' }, 404)
    }

    const shareMatch = /^\/s\/([A-Za-z0-9]+)$/.exec(url.pathname)
    if (shareMatch) {
      const tripId = shareMatch[1]
      const raw = await env.TRIPS.get(`trip:${tripId}`)
      if (!raw) return new Response('Поездка не найдена или срок ссылки истёк', { status: 404, headers: CORS })
      const data = JSON.parse(raw)
      const summary = data.summary || {}
      const title = summary.title || 'Горнолыжная поездка'
      const description = [summary.route, summary.total, summary.dates, summary.pax].filter(Boolean).join(' · ')
      const image = `${url.origin}/og/${tripId}.png`
      const target = appUrl(env, tripId, url.origin)
      const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · AiTripBuddy</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(target)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="AiTripBuddy">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:secure_url" content="${escapeHtml(image)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0;url=${escapeHtml(target)}">
</head>
<body style="margin:0;background:#0f1929;color:#e7eefc;font-family:Segoe UI,Arial,sans-serif">
<main style="padding:40px;max-width:720px">
<h1 style="font-size:28px;margin:0 0 8px">${escapeHtml(title)}</h1>
<p style="color:#8aa4c8;line-height:1.5">${escapeHtml(description)}</p>
<p><a href="${escapeHtml(target)}" style="color:#7dd3fc">Открыть поездку в AiTripBuddy</a></p>
</main>
</body>
</html>`
      return new Response(html, { headers: { ...CORS, 'content-type': 'text/html; charset=utf-8' } })
    }

    const ogMatch = /^\/og\/([A-Za-z0-9]+)\.png$/.exec(url.pathname)
    if (ogMatch) {
      const dataUrl = await env.TRIPS.get(`og:${ogMatch[1]}`)
      if (!dataUrl) return new Response('not found', { status: 404, headers: CORS })
      const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0))
      return new Response(bytes, {
        headers: {
          ...CORS,
          'content-type': 'image/png',
          'cache-control': 'public, max-age=31536000, immutable',
        },
      })
    }

    return new Response('not found', { status: 404, headers: CORS })
  },
}
