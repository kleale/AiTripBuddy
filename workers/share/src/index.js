const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
}

const TTL = 60 * 60 * 24 * 180

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })

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
