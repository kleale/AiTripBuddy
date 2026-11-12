export type GuideCurrency = 'JPY' | 'RUB'

export type TrailDifficulty = 'green' | 'blue' | 'red' | 'black'

export interface GuidePoint {
  lat: number
  lng: number
}

export interface GuideZone {
  id: string
  name: string
  baseAltitude: number
  topAltitude: number
  lifts: number
  trailsKm: Record<TrailDifficulty, number>
  passPrice: number
  passCurrency: GuideCurrency
  note?: string
  /** нижняя станция — реальные координаты */
  base: GuidePoint
  /** вершина зоны катания — реальные координаты */
  summit: GuidePoint
}

export interface ResortGuide {
  resortId: string
  title: string
  region: string
  season: string
  summary: string
  bestFor: string[]
  snow: string
  tips: string[]
  totalTrailsKm: number
  lifts: number
  vertical: number
  passAll?: { label: string; price: number; currency: GuideCurrency; note?: string }
  zones: GuideZone[]
}

const zone = (
  id: string,
  name: string,
  baseAltitude: number,
  topAltitude: number,
  lifts: number,
  trailsKm: [number, number, number, number],
  passPrice: number,
  passCurrency: GuideCurrency,
  base: GuidePoint,
  summit: GuidePoint,
  note?: string,
): GuideZone => ({
  id,
  name,
  baseAltitude,
  topAltitude,
  lifts,
  trailsKm: { green: trailsKm[0], blue: trailsKm[1], red: trailsKm[2], black: trailsKm[3] },
  passPrice,
  passCurrency,
  note,
  base,
  summit,
})

export const resortGuides: Record<string, ResortGuide> = {
  niseko: {
    resortId: 'niseko',
    title: 'Нисеко Юнайтед',
    region: 'Хоккайдо, Япония',
    season: 'конец ноября — начало мая',
    summary:
      'Четыре соединённых курорта у горы Ётэй. Самый стабильный снег в Японии: 12–18 м за сезон, лёгкий и сухой. Между зонами ходят шаттлы, единый All Mountain pass действует на всех подъёмниках.',
    bestFor: ['фрирайд', 'глубокий снег', 'длинный сезон', 'англоязычная инфраструктура'],
    snow: '12–18 м за сезон, снегопады почти каждый день в январе–феврале',
    tips: [
      'All Mountain pass выгоднее, если катаетесь больше 3 дней и хотите перемещаться между зонами',
      'Ворота (gates) за границей трасс — только с беккантри-снаряжением и гидом',
      'Ночная каталка в Hirafu — отдельный билет',
      'Жильё в Hirafu бронируйте за 3–6 месяцев: в сезон всё занято',
    ],
    totalTrailsKm: 135,
    lifts: 30,
    vertical: 900,
    passAll: {
      label: 'Niseko United All Mountain, 1 день',
      price: 9500,
      currency: 'JPY',
      note: 'действует во всех четырёх зонах',
    },
    zones: [
      zone('hanazono', 'Hanazono', 300, 1000, 3, [4, 6, 5, 2], 7500, 'JPY', { lat: 42.8585, lng: 140.7 }, { lat: 42.874, lng: 140.67 }),
      zone('hirafu', 'Grand Hirafu', 260, 1200, 14, [6, 12, 14, 8], 8000, 'JPY', { lat: 42.86, lng: 140.71 }, { lat: 42.8745, lng: 140.6755 }),
      zone('village', 'Niseko Village', 250, 1000, 8, [5, 9, 10, 5], 8000, 'JPY', { lat: 42.865, lng: 140.69 }, { lat: 42.876, lng: 140.665 }),
      zone('annupuri', 'Annupuri', 200, 1000, 5, [4, 7, 8, 4], 7500, 'JPY', { lat: 42.87, lng: 140.66 }, { lat: 42.877, lng: 140.658 }),
    ],
  },

  hakuba: {
    resortId: 'hakuba',
    title: 'Долина Хакуба',
    region: 'Нагано, Япония',
    season: 'декабрь — начало мая',
    summary:
      'Долина с десятью курортами и олимпийским наследием 1998 года. Happo-One — крутые трассы и панорама Северных Альп, Cortina и Tsugaike — снег и целина, Iwatake — мягкие склоны для семей.',
    bestFor: ['крутые трассы', 'целина', 'разнообразие курортов', 'виды на Альпы'],
    snow: '8–12 м за сезон, ветреные вершины закрываются чаще, чем в Нисеко',
    tips: [
      'Hakuba Valley pass покрывает все курорты долины, отдельные билеты дешевле на 1 день',
      'Между курортами ходят бесплатные шаттлы по расписанию',
      'Happo-One — самый «город»: больше ресторанов и баров',
      'В пик сезона очереди на гондолу Happo утром — приходите к открытию',
    ],
    totalTrailsKm: 137,
    lifts: 36,
    vertical: 1071,
    passAll: {
      label: 'Hakuba Valley, 1 день',
      price: 8500,
      currency: 'JPY',
      note: 'все курорты долины',
    },
    zones: [
      zone('norikura', 'Norikura', 1450, 2000, 4, [2, 5, 4, 2], 5500, 'JPY', { lat: 36.76, lng: 137.86 }, { lat: 36.75, lng: 137.85 }),
      zone('cortina', 'Cortina', 900, 1400, 3, [2, 3, 4, 3], 5800, 'JPY', { lat: 36.78, lng: 137.85 }, { lat: 36.77, lng: 137.835 }),
      zone('tsugaike', 'Tsugaike Kogen', 800, 1700, 8, [6, 10, 9, 4], 6800, 'JPY', { lat: 36.74, lng: 137.845 }, { lat: 36.725, lng: 137.83 }),
      zone('iwatake', 'Iwatake', 750, 1500, 5, [4, 6, 5, 2], 6300, 'JPY', { lat: 36.712, lng: 137.85 }, { lat: 36.7, lng: 137.83 }),
      zone('goryu', 'Hakuba47 & Goryu', 700, 1500, 9, [5, 8, 8, 4], 6800, 'JPY', { lat: 36.677, lng: 137.836 }, { lat: 36.69, lng: 137.815 }),
      zone('happo', 'Happo-One', 760, 1831, 10, [5, 9, 12, 7], 7500, 'JPY', { lat: 36.697, lng: 137.841 }, { lat: 36.69, lng: 137.815 }),
    ],
  },

  'krasnaya-polyana': {
    resortId: 'krasnaya-polyana',
    title: 'Красная Поляна',
    region: 'Сочи, Россия',
    season: 'декабрь — апрель',
    summary:
      'Горный кластер из четырёх курортов с общей инфраструктурой и самой большой зоной катания в России. Роза Хутор и Горки Город — современные гондолы и до 2320 м, Газпром и Альпика спокойнее и дешевле.',
    bestFor: ['большая зона катания', 'инфраструктура', 'перепад высот', 'апрельское катание'],
    snow: '2–4 м за сезон, на верхних отметках снег держится до мая',
    tips: [
      'Единого скипасса на весь кластер нет — покупайте отдельно на каждый курорт',
      'Курорты соединены канатными дорогами и шаттлами, но не всегда доступны переходами',
      'В высокий сезон и праздники очереди на нижних станциях — берите утро',
      'Ветреные дни закрывают верхние станции, проверяйте статус подъёмников утром',
    ],
    totalTrailsKm: 175,
    lifts: 60,
    vertical: 1600,
    zones: [
      zone('alpika', 'Альпика', 540, 1500, 8, [3, 6, 6, 3], 3900, 'RUB', { lat: 43.605, lng: 40.245 }, { lat: 43.59, lng: 40.255 }),
      zone('gazprom', 'Газпром (Лаура)', 540, 1600, 15, [5, 9, 9, 4], 4300, 'RUB', { lat: 43.596, lng: 40.238 }, { lat: 43.58, lng: 40.25 }),
      zone('gorki', 'Горки Город', 540, 2320, 18, [6, 11, 12, 6], 4900, 'RUB', { lat: 43.585, lng: 40.25 }, { lat: 43.565, lng: 40.265 }),
      zone('rosa', 'Роза Хутор', 540, 2320, 19, [7, 12, 14, 8], 5200, 'RUB', { lat: 43.5707, lng: 40.2765 }, { lat: 43.55, lng: 40.29 }),
    ],
  },

  'rosa-khutor': {
    resortId: 'rosa-khutor',
    title: 'Роза Хутор',
    region: 'Сочи, Россия',
    season: 'декабрь — апрель',
    summary:
      'Олимпийский курорт 2014 года: 77 км трасс, перепад 1534 м и три станции подъёма до отметки 2320. Южный склон — длинные светлые трассы, северный — спортивный уклон и меньше солнца.',
    bestFor: ['перепад высот', 'длинные трассы', 'апрельское катание', 'олимпийские склоны'],
    snow: '2–4 м за сезон, верхняя зона держит снег дольше нижней',
    tips: [
      'Единый день действует на оба склона и все станции — берите его, если катаетесь весь день',
      'Утром верхняя станция часто в облаке: начните с нижнего уровня',
      'Северный склон меньше освещён — там холоднее и дольше держится снег',
      'В праздники бронируйте подъём заранее онлайн',
    ],
    totalTrailsKm: 77,
    lifts: 19,
    vertical: 1534,
    passAll: {
      label: 'Единый день, взрослый',
      price: 5200,
      currency: 'RUB',
      note: 'оба склона и все станции',
    },
    zones: [
      zone('north', 'Северный склон', 960, 2320, 7, [2, 5, 7, 5], 4800, 'RUB', { lat: 43.575, lng: 40.283 }, { lat: 43.552, lng: 40.292 }),
      zone('south', 'Южный склон', 540, 2320, 12, [4, 8, 9, 5], 5200, 'RUB', { lat: 43.57, lng: 40.276 }, { lat: 43.551, lng: 40.29 }),
    ],
  },
}

export function guideFor(resortId: string): ResortGuide | undefined {
  return resortGuides[resortId]
}

export function hasGuide(resortId: string): boolean {
  return Boolean(resortGuides[resortId])
}

/** Сколько всего километров трасс по сложности в гиде. */
export function guideDifficulty(guide: ResortGuide): Record<TrailDifficulty, number> {
  const total: Record<TrailDifficulty, number> = { green: 0, blue: 0, red: 0, black: 0 }
  for (const item of guide.zones) {
    total.green += item.trailsKm.green
    total.blue += item.trailsKm.blue
    total.red += item.trailsKm.red
    total.black += item.trailsKm.black
  }
  return total
}