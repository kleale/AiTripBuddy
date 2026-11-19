# Короткие ссылки и OG-превью поездок

Воркер хранит сжатый код поездки и PNG-карточку в Cloudflare KV, отдаёт короткую ссылку и HTML с персональными OG-мета.

## Что делает

- `POST /api/trips` — `{ code, summary, png }` → `{ id, url }`.
- `GET /api/trips/:id` — `{ code, summary }` для приложения.
- `GET /s/:id` — HTML с `og:title`, `og:description`, `og:image` и переходом в приложение.
- `GET /og/:id.png` — PNG-карточка поездки для Telegram/Threads.

## Деплой

```bash
cd workers/share
npx wrangler login
npx wrangler kv namespace create TRIPS
```

Скопируйте `id` из вывода в `wrangler.toml` вместо `PASTE_KV_NAMESPACE_ID`, затем:

```bash
npx wrangler deploy
```

Wrangler покажет адрес вида:

```
https://atb-share.<account>.workers.dev
```

Адрес уже захардкожен в `src/lib/short-links.ts` как `https://atb-share.atb-share--triopsklre.workers.dev`. Если воркер развёрнут по другому адресу, поменяйте константу `SHARE_API` и пересоберите приложение.

## Проверка

1. Сохраните поездку, нажмите «Короткая ссылка».
2. Вставьте ссылку в Telegram — должна появиться карточка с маршрутом, стоимостью, датами и календарём.
3. Проверьте картинку: `https://atb-share.<account>.workers.dev/og/<id>.png` → `image/png`.
4. Если Telegram показывает старое превью, отправьте ссылку с новым id или обновите кэш через `@WebpageBot`.

## Ограничения

- Данные доступны по ссылке; ID случайный, но не приватный.
- TTL записи — 180 дней.
- Для больших объёмов картинок замените KV на R2.
- Не коммитьте API-токены Cloudflare в репозиторий.
