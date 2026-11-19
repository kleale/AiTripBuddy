# Telegram-бот AiTripBuddy

Бот только информирует и подтверждает участие, платежей нет.

## Что умеет

- `/start trip_<id>` — подключить чат к поездке и показать карточку.
- Кнопки «Подтвердить» / «Не еду» — статус участия.
- `/stop` — отписаться и удалить участие.
- `POST /remind/<secret>` — ручная рассылка напоминаний (текст и кнопка на поездку).

## Деплой

```bash
cd workers/tg
npx wrangler kv namespace create TG
```

Вставьте `id` в `wrangler.toml`, затем:

```bash
npx wrangler deploy
```

Создайте бота у `@BotFather`, получите токен и задайте секреты:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
```

Установите webhook:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://atb-tg.<subdomain>.workers.dev/webhook/<WEBHOOK_SECRET>"
```

## Напоминания

Ручной запуск:

```bash
curl -X POST https://atb-tg.<subdomain>.workers.dev/remind/<WEBHOOK_SECRET> \
  -H "content-type: application/json" \
  -d "{\"id\":\"<share-id>\",\"text\":\"Через 7 дней поездка — подтвердите участие\"}"
```

Позже можно повесить cron Worker на T-14/T-7/T-2/T-1.
