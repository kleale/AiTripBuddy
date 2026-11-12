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
- `src/lib/` — чистые функции: `costs`, `currency`, `geo`, `format`.
- `src/stores/` — реактивные сторы: текущая поездка и библиотека сохранённых.
- `src/components/` — граф, карта, смета, модалки, узлы маршрута.
- `src/styles/` — `main.css` только импортирует модули (`base`, `layout`, …).
- `tests/` — Vitest: стоимость, геометрия/валюты, целостность справочников.

## Правила

- Все денежные суммы хранятся в валюте поездки; курс — `src/lib/currency.ts`, единственный источник правды.
- Числа считает код, не LLM: `computeCosts` и `foodPerDay` — чистые функции с тестами.
- Любые внешние данные нормализуются через `normalizeTrip()` перед использованием (загрузка из localStorage и из библиотеки).
- Справочники связные: `tests/data.test.ts` проверяет, что у каждого курорта есть существующий аэропорт и нет дублей кодов.
- Записи в localStorage дебаунсятся (400 мс) и сбрасываются на `beforeunload`/`pagehide`.
- Leaflet подгружается лениво (`defineAsyncComponent`), чтобы не раздувать основной бандл.