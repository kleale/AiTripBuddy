# AiTripBuddy

MVP-конструктор горнолыжной поездки: маршрут на графе, отели, скипасс, питание и смета.

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Vite dev-сервер на `http://localhost:5173` |
| `npm run build` | `vue-tsc --noEmit` + production-сборка |
| `npm run typecheck` | проверка типов без сборки |
| `npm run lint` | ESLint (flat config, TS + Vue) |
| `npm test` | Vitest, юнит-тесты в `tests/` |
| `npm run test:watch` | Vitest в watch-режиме |

Перед завершением задачи запускайте `npm run typecheck && npm run lint && npm test`.

## Структура

- `src/types.ts` — доменные типы (`Trip`, `Stop`, `RouteLink`, `Meals`).
- `src/data/` — справочники: города/аэропорты, курорты, связки «курорт ↔ аэропорт», цены питания.
- `src/lib/` — чистые функции: `costs`, `currency`, `geo`, `format`, `schedule` (гант), `compare` (метрики), `share` (ссылки).
- `src/stores/` — реактивные сторы: текущая поездка, библиотека сохранённых, импорт из ссылки.
- `src/components/` — граф, гант, карта, смета, модалки (поездки, сравнение), узлы маршрута.
- `src/styles/` — `main.css` только импортирует модули (`base`, `layout`, `timeline`, …).
- `tests/` — Vitest: стоимость, геометрия/валюты, расписание, сравнение, шаринг, справочники.
- `docs/DEPLOY.md` — GitHub Pages, формат ссылок, сравнение.
- `.github/workflows/deploy.yml` — CI: typecheck → lint → test → build → Pages.

## Правила

- Все денежные суммы хранятся в валюте поездки; курс — `src/lib/currency.ts`, единственный источник правды.
- Числа считает код, не LLM: `computeCosts`, `foodPerDay`, `buildSchedule`, `tripMetrics` — чистые функции с тестами.
- Любые внешние данные нормализуются через `normalizeTrip()` перед использованием (localStorage, библиотека, ссылка).
- Даты отелей — `checkIn` (`YYYY-MM-DD`); расписание и гант строятся из них, без дат дни нумеруются условно.
- Справочники связные: `tests/data.test.ts` проверяет, что у каждого курорта есть существующий аэропорт и нет дублей кодов.
- Ссылки на наборы — `#trips=<code>` (`src/lib/share.ts`), данные только в хэше, без бэкенда.
- Записи в localStorage дебаунсятся (400 мс) и сбрасываются на `beforeunload`/`pagehide`.
- Leaflet подгружается лениво (`defineAsyncComponent`), чтобы не раздувать основной бандл.
- Сборка переносимая (`base: './'`), публикуется на GitHub Pages workflow-ом.