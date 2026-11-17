# Статистика посещений

## Что уже работает

- Каждый браузер получает анонимный `visitorId` в `localStorage` и отмечает один визит в день.
- В шапке есть кнопка **Статистика**: окно с графиком уникальных, вернувшихся и общего числа пользователей.
- Переключатель диапазона: всё, неделя, месяц, год (год группируется по месяцам).
- Без внешнего коллектора статистика считается по текущему браузеру — это удобно для проверки UI, но не даёт общую картину.

## Общая статистика: коллектор

График берёт данные с `VITE_STATS_URL` или из адреса, введённого в окне статистики («URL коллектора»).

Коллектор должен поддерживать два эндпоинта:

### `POST /visit`

```json
{ "visitorId": "abc123", "date": "2026-11-17", "returning": true }
```

Ответ: `204` или `{ "ok": true }`.

### `GET /series?from=2026-11-12&to=2026-11-17`

```json
{
  "days": [
    { "date": "2026-11-12", "unique": 3, "returning": 0, "total": 3 },
    { "date": "2026-11-13", "unique": 2, "returning": 1, "total": 5 }
  ]
}
```

- `unique` — новые посетители за день.
- `returning` — вернувшиеся за день.
- `total` — накопленное число уникальных посетителей на конец дня (монотонно растёт).

### Минимальный Cloudflare Worker

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })

    const id = env.STATS.idFromName('global')
    const stub = env.STATS.get(id)

    if (url.pathname === '/visit' && request.method === 'POST') {
      const body = await request.json()
      await stub.fetch('https://do/visit', { method: 'POST', body: JSON.stringify(body) })
      return new Response(null, { status: 204, headers: cors })
    }

    if (url.pathname === '/series') {
      const res = await stub.fetch(`https://do/series?${url.searchParams}`)
      return new Response(await res.text(), {
        headers: { ...cors, 'content-type': 'application/json' },
      })
    }

    return new Response('not found', { status: 404, headers: cors })
  },
}
```

Durable Object хранит `Map<visitorId, firstSeen>` и `Map<date, Set<visitorId>>`, из которых считаются `unique`, `returning` и накопленный `total`.

### Подключение

1. Задеплойте коллектор (Cloudflare Worker, Vercel, собственный сервер).
2. В приложении откройте **Статистика** и вставьте URL коллектора — он сохранится в `localStorage`.
3. Или задайте `VITE_STATS_URL` перед сборкой.

## Приватность

- Не собираются IP-адреса, имена, почта и содержимое поездок.
- Идентификатор случайный, хранится только в браузере.
- Допустимо очистить локальные данные: они находятся в ключах `atd.stats.*`.