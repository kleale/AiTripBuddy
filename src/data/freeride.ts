import type { HazardLevel, LngLat } from './trail-maps'

export type FreerideKind = 'offpiste' | 'backcountry' | 'glacier' | 'trees'

export interface FreerideZone {
  id: string
  name: string
  kind: FreerideKind
  /** упрощённый полигон зоны */
  coordinates: LngLat[]
  verticalM: number
  hazard: HazardLevel
  aspect: string
  note: string
}

export interface FreerideGate {
  id: string
  name: string
  lat: number
  lng: number
  hazard: HazardLevel
  /** нужен ли лавинный набор и гид */
  guided: boolean
  note: string
}

export interface FreerideInfo {
  resortId: string
  summary: string
  /** сезон и лучшее время */
  season: string
  /** чем хорош фрирайд */
  bestFor: string[]
  /** обязательное снаряжение */
  gear: string[]
  /** правила и ограничения */
  rules: string[]
  /** есть ли официальные ворота */
  hasGates: boolean
  /** общий уровень лавинной опасности по описаниям */
  hazard: HazardLevel
  zones: FreerideZone[]
  gates: FreerideGate[]
}

/** Полигон-прямоугольник по двум углам: [юго-запад, северо-восток]. */
function box(sw: LngLat, ne: LngLat): LngLat[] {
  return [sw, [ne[0], sw[1]], ne, [sw[0], ne[1]]]
}

export const freeride: Record<string, FreerideInfo> = {
  hakuba: {
    resortId: 'hakuba',
    summary:
      'Фрирайд в долине идёт через вороты (gates): курорты открывают выходы за границу патруля, когда лавинная обстановка позволяет. Самые известные — северные склоны Happo и чаша Tsugaike, лесные склоны Cortina. Вне ворот катание только с гидом.',
    season: 'январь — март, пик снега в конце января и феврале',
    bestFor: ['глубокий снег', 'лесные склоны', 'вороты с патрулём', 'длинные выкаты'],
    gear: ['бипер', 'щуп', 'лопата', 'рюкзак с лавинным набором'],
    rules: [
      'Выход за границу патруля — только через открытые вороты',
      'Ворота закрывают при ветре и лавинной опасности, проверяйте утром',
      'Mizuno no Sawa в Нисеко и аналогичные кулуары — только с гидом',
      'Не выезжайте ниже выката: возврат к дороге не всегда возможен',
    ],
    hasGates: true,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-happo-ober',
        name: 'Happo · Ober-grat',
        kind: 'backcountry',
        coordinates: box([137.802, 36.684], [137.82, 36.697]),
        verticalM: 680,
        hazard: 'high',
        aspect: 'север, северо-восток',
        note: 'Крутой северный склон за воротами. Лавинные доски, только с гидом',
      },
      {
        id: 'fr-happo-usa',
        name: 'Happo · Usagidaira',
        kind: 'offpiste',
        coordinates: box([137.812, 36.688], [137.826, 36.695]),
        verticalM: 420,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Целина между трассами, выкат к нижней станции',
      },
      {
        id: 'fr-goryu-korengi',
        name: 'Goryu · Korengi',
        kind: 'backcountry',
        coordinates: box([137.805, 36.681], [137.819, 36.689]),
        verticalM: 540,
        hazard: 'moderate',
        aspect: 'восток',
        note: 'Классический выкат к дороге у Goryu, популярен в снегопады',
      },
      {
        id: 'fr-tsugaike-bowl',
        name: 'Tsugaike · чаша',
        kind: 'backcountry',
        coordinates: box([137.848, 36.748], [137.868, 36.762]),
        verticalM: 520,
        hazard: 'considerable',
        aspect: 'северо-запад',
        note: 'Широкая чаша выше верхней станции, камни в малоснежные годы',
      },
      {
        id: 'fr-cortina-trees',
        name: 'Cortina · лес',
        kind: 'trees',
        coordinates: box([137.832, 36.766], [137.85, 36.78]),
        verticalM: 460,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Лесные склоны с редким лесом, снег держится долго',
      },
    ],
    gates: [
      {
        id: 'gate-happo-2',
        name: 'Happo · Gate 2 (Ober)',
        lat: 36.6905,
        lng: 137.8145,
        hazard: 'high',
        guided: true,
        note: 'Выход на Ober-grat, только с лавинным набором',
      },
      {
        id: 'gate-happo-3',
        name: 'Happo · Gate 3 (Usagidaira)',
        lat: 36.6885,
        lng: 137.8195,
        hazard: 'considerable',
        guided: false,
        note: 'Целина между трассами, возврат к нижней станции',
      },
      {
        id: 'gate-tsugaike',
        name: 'Tsugaike · верхние ворота',
        lat: 36.755,
        lng: 137.852,
        hazard: 'considerable',
        guided: false,
        note: 'Вход в чашу, следите за лавинной обстановкой',
      },
      {
        id: 'gate-cortina',
        name: 'Cortina · лесные ворота',
        lat: 36.772,
        lng: 137.842,
        hazard: 'moderate',
        guided: false,
        note: 'Лесные склоны, легко потерять направление в туман',
      },
    ],
  },

  niseko: {
    resortId: 'niseko',
    summary:
      'Нисеко — эталон снежного фрирайда: 12–18 м за сезон и вороты по всему периметру. Mizuno no Sawa — легендарный кулуар, где катание только с гидом. Goshiki и Higashi-One — softer варианты для первого опыта вне трасс.',
    season: 'декабрь — март, лучший снег с середины декабря по февраль',
    bestFor: ['самый стабильный снег', 'вороты', 'лес', 'длинные выкаты'],
    gear: ['бипер', 'щуп', 'лопата', 'маска с запасным стеклом'],
    rules: [
      'Все выходы — только через вороты, их статус публикуют утром',
      'Mizuno no Sawa — с гидом, самостоятельно закрыто',
      'Не выезжайте за пределы зоны выката: реки и обрывы',
      'Ветер закрывает верхние вороты чаще, чем трассы',
    ],
    hasGates: true,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-mizuno',
        name: 'Mizuno no Sawa',
        kind: 'backcountry',
        coordinates: box([140.664, 42.866], [140.681, 42.878]),
        verticalM: 620,
        hazard: 'high',
        aspect: 'север',
        note: 'Кулуар под вершиной, катание только с гидом',
      },
      {
        id: 'fr-goshiki',
        name: 'Goshiki',
        kind: 'offpiste',
        coordinates: box([140.657, 42.864], [140.671, 42.876]),
        verticalM: 480,
        hazard: 'moderate',
        aspect: 'северо-запад',
        note: 'Мягкий лесной склон, популярен для первого выхода вне трасс',
      },
      {
        id: 'fr-higashi',
        name: 'Higashi-One',
        kind: 'trees',
        coordinates: box([140.68, 42.867], [140.7, 42.878]),
        verticalM: 520,
        hazard: 'moderate',
        aspect: 'восток',
        note: 'Лес между трассами Hanazono и Hirafu',
      },
      {
        id: 'fr-annupuri',
        name: 'Annupuri · вороты',
        kind: 'backcountry',
        coordinates: box([140.653, 42.866], [140.666, 42.876]),
        verticalM: 400,
        hazard: 'considerable',
        aspect: 'запад',
        note: 'Выходы к лесу, выкат к дороге',
      },
    ],
    gates: [
      { id: 'gate-hirafu-2', name: 'Hirafu · Gate 2', lat: 42.873, lng: 140.677, hazard: 'considerable', guided: false, note: 'Выход к лесу, следите за рекой внизу' },
      { id: 'gate-hirafu-5', name: 'Hirafu · Gate 5', lat: 42.872, lng: 140.671, hazard: 'moderate', guided: false, note: 'Самый простой выход для первого опыта' },
      { id: 'gate-hanazono', name: 'Hanazono · Gate', lat: 42.874, lng: 140.7, hazard: 'moderate', guided: false, note: 'Лес и целина у Hanazono' },
      { id: 'gate-mizuno', name: 'Mizuno no Sawa · вход', lat: 42.877, lng: 140.667, hazard: 'high', guided: true, note: 'Только с гидом' },
    ],
  },

  'krasnaya-polyana': {
    resortId: 'krasnaya-polyana',
    summary:
      'Официальных фрирайд-ворот на кластере нет: за границы трасс выходят самостоятельно, и это главный риск региона. Интересны северные склоны выше 2000 м, цирки под вершинами и лесные склоны Аибги. Лавинная служба работает, но ответственность на райдере.',
    season: 'январь — март, на верхних отметках до апреля',
    bestFor: ['высота', 'цирки', 'лесные склоны', 'длинный сезон'],
    gear: ['бипер', 'щуп', 'лопата', 'связь и запасной телефон'],
    rules: [
      'Ворот нет: любой выход за трассу — на свой риск',
      'Лавинная обстановка меняется за день, читайте сводку',
      'Ветер и облака наверху закрывают ориентацию',
      'Не катайтесь в одиночку, сообщайте маршрут',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-kp-north',
        name: 'Северный склон · выше 2000',
        kind: 'backcountry',
        coordinates: box([40.275, 43.545], [40.3, 43.562]),
        verticalM: 700,
        hazard: 'high',
        aspect: 'север, северо-восток',
        note: 'Крутые кулуары под верхними станциями, снежные доски',
      },
      {
        id: 'fr-kp-cirques',
        name: 'Цирки · Горки Город',
        kind: 'offpiste',
        coordinates: box([40.25, 43.558], [40.278, 43.573]),
        verticalM: 560,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Целина между трассами выше 1800 м',
      },
      {
        id: 'fr-kp-aibga',
        name: 'Лесные склоны Аибги',
        kind: 'trees',
        coordinates: box([40.22, 43.58], [40.262, 43.615]),
        verticalM: 480,
        hazard: 'moderate',
        aspect: 'запад',
        note: 'Лес и просеки, выкат к дороге',
      },
      {
        id: 'fr-kp-laura',
        name: 'Зона Лауры',
        kind: 'offpiste',
        coordinates: box([40.233, 43.575], [40.258, 43.592]),
        verticalM: 500,
        hazard: 'moderate',
        aspect: 'северо-запад',
        note: 'Склоны вокруг трасс Газпрома, меньше народу',
      },
    ],
    gates: [],
  },

  'rosa-khutor': {
    resortId: 'rosa-khutor',
    summary:
      'На Розе Хутор фрирайд сосредоточен на северном склоне и в цирках выше 2000 м. Официальных ворот нет, границы патруля обозначены, выход за них — самостоятельное решение. Лесные выкаты к Аибге дают длинные спуски, но требуют знания рельефа.',
    season: 'январь — март, верхний склон держится до апреля',
    bestFor: ['перепад 1534 м', 'цирки', 'лесные выкаты', 'апрельское катание'],
    gear: ['бипер', 'щуп', 'лопата', 'налобный фонарь'],
    rules: [
      'Официальных ворот нет — за границу трасс только осознанно',
      'Северный склон в тени: снег жёстче, лавины держатся дольше',
      'Верхние станции закрывают при ветре',
      'Проверяйте погоду и видимость перед выходом',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-rh-north-cirque',
        name: 'Северный цирк',
        kind: 'backcountry',
        coordinates: box([40.283, 43.545], [40.302, 43.56]),
        verticalM: 720,
        hazard: 'high',
        aspect: 'север',
        note: 'Крутые линии под верхней станцией',
      },
      {
        id: 'fr-rh-wild',
        name: 'Дикая зона',
        kind: 'offpiste',
        coordinates: box([40.268, 43.55], [40.286, 43.565]),
        verticalM: 620,
        hazard: 'considerable',
        aspect: 'северо-восток',
        note: 'Целина между трассами, выкат на нижние очереди',
      },
      {
        id: 'fr-rh-trees',
        name: 'Лесные выкаты',
        kind: 'trees',
        coordinates: box([40.258, 43.562], [40.28, 43.58]),
        verticalM: 520,
        hazard: 'moderate',
        aspect: 'запад',
        note: 'Лес ниже 1500 м, длинные спуски к дороге',
      },
    ],
    gates: [],
  },

  mayrhofen: {
    resortId: 'mayrhofen',
    summary:
      'Майрхофен — крупный фрирайд-район Циллерталя: северные стены Пенкена, Ахорн и Расткогель. Ворот в понимании Японии нет, но есть обозначенные off-piste маршруты. Лавинная служба Тироля публикует прогноз по региону.',
    season: 'декабрь — апрель, лучший снег в январе и феврале',
    bestFor: ['северные стены', 'перепад', 'апрельское катание', 'инфраструктура'],
    gear: ['бипер', 'щуп', 'лопата', 'ABS-рюкзак по желанию'],
    rules: [
      'Официальных ворот нет: вне трасс — на свой риск',
      'Следите за прогнозом лавинной службы Тироля',
      'Северные стены требуют опыта и хорошей видимости',
      'Весной камни и мокрые лавины после полудня',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-mayr-penken',
        name: 'Пенкен · северные стены',
        kind: 'backcountry',
        coordinates: box([11.835, 47.145], [11.875, 47.162]),
        verticalM: 900,
        hazard: 'high',
        aspect: 'север',
        note: 'Крутые стены над лесом, классика Циллерталя',
      },
      {
        id: 'fr-mayr-ahorn',
        name: 'Ахорн',
        kind: 'offpiste',
        coordinates: box([11.855, 47.138], [11.878, 47.152]),
        verticalM: 650,
        hazard: 'considerable',
        aspect: 'северо-запад',
        note: 'Целина и лес, выкат к нижней станции',
      },
      {
        id: 'fr-mayr-rastkogel',
        name: 'Расткогель',
        kind: 'offpiste',
        coordinates: box([11.808, 47.124], [11.84, 47.142]),
        verticalM: 700,
        hazard: 'considerable',
        aspect: 'северо-восток',
        note: 'Меньше народу, требует знания выкатов',
      },
    ],
    gates: [],
  },

  gudauri: {
    resortId: 'gudauri',
    summary:
      'Гудаури — главный фрирайд-курорт Грузии. Катание выше границы леса, длинные спуски, хели-ски и хайк к Джуте. Ворот нет, но есть патруль и лавинная служба. Ветреные дни закрывают верхнюю гондолу, а Крестовый перевал — дорогу из Тбилиси.',
    season: 'декабрь — апрель, март часто лучший месяц',
    bestFor: ['фрирайд', 'хели-ски', 'хайк', 'длинные спуски', 'бюджет'],
    gear: ['бипер', 'щуп', 'лопата', 'солнцезащита', 'тёплая одежда на ветер'],
    rules: [
      'Официальных ворот нет: вне трасс — на свой риск',
      'Хели-ски только с оператором и гидом',
      'Ветер закрывает верхнюю станцию — проверяйте утром',
      'При метели перевал закрывают, закладывайте день на дорогу',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-gud-sadzele',
        name: 'Садзеле · выше 3000',
        kind: 'backcountry',
        coordinates: box([44.448, 42.46], [44.482, 42.48]),
        verticalM: 1280,
        hazard: 'considerable',
        aspect: 'север, восток',
        note: 'Длинные линии от верхней станции до долины',
      },
      {
        id: 'fr-gud-kobi',
        name: 'Долина Коби',
        kind: 'backcountry',
        coordinates: box([44.478, 42.508], [44.505, 42.538]),
        verticalM: 900,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Целина и лес, выкат к селу',
      },
      {
        id: 'fr-gud-juta',
        name: 'Джута · хайк',
        kind: 'backcountry',
        coordinates: box([44.596, 42.568], [44.63, 42.592]),
        verticalM: 700,
        hazard: 'high',
        aspect: 'северо-запад',
        note: 'Хайк от деревни, только с гидом',
      },
      {
        id: 'fr-gud-truso',
        name: 'Трусовское ущелье',
        kind: 'backcountry',
        coordinates: box([44.528, 42.628], [44.565, 42.662]),
        verticalM: 900,
        hazard: 'moderate',
        aspect: 'восток',
        note: 'Дальняя зона, нужен транспорт и гид',
      },
    ],
    gates: [],
  },

  mestia: {
    resortId: 'mestia',
    summary:
      'Местиа — две зоны: небольшой Хацвали и высокий Тетнулди. Фрирайд на Тетнулди идёт от 3160 м по северным склонам и ледниковым языкам, Хацвали — лес и мягкие целины. Своего транспорта нет, до Тетнулди добираются на машине с водителем.',
    season: 'январь — апрель, Тетнулди держит снег дольше',
    bestFor: ['целина', 'ледник', 'виды на Ушбу', 'пустые склоны'],
    gear: ['бипер', 'щуп', 'лопата', 'кошки при выходе на ледник'],
    rules: [
      'Без местного гида уходить с трасс опасно',
      'На леднике нужны кошки и связка',
      'Лавинная обстановка меняется быстро, спрашивайте в патруле',
      'Дорога до Тетнулди — 40–60 минут на машине',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-mest-tetnuldi',
        name: 'Тетнулди · север',
        kind: 'backcountry',
        coordinates: box([42.968, 43.018], [43.002, 43.042]),
        verticalM: 890,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Широкие склоны от верхней станции',
      },
      {
        id: 'fr-mest-glacier',
        name: 'Ледниковый язык',
        kind: 'glacier',
        coordinates: box([42.985, 43.03], [43.012, 43.05]),
        verticalM: 600,
        hazard: 'high',
        aspect: 'северо-восток',
        note: 'Трещины: нужны кошки и связка',
      },
      {
        id: 'fr-mest-hatsvali',
        name: 'Хацвали · лес',
        kind: 'trees',
        coordinates: box([42.72, 43.018], [42.744, 43.034]),
        verticalM: 480,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Лес и мягкая целина, хороший вариант в снегопад',
      },
    ],
    gates: [],
  },

  sheregesh: {
    resortId: 'sheregesh',
    summary:
      'Шерегеш — лесной фрирайд: между секторами много целины и просек. Официальных ворот нет, но патруль работает. Снега много с ноября, поэтому ранний сезон здесь лучший в России. Лавинная опасность умеренная, но в лесу есть «ловушки» — ручьи и завалы.',
    season: 'ноябрь — апрель, снег с середины ноября',
    bestFor: ['ранний сезон', 'лес', 'много снега', 'бюджет'],
    gear: ['бипер', 'щуп', 'лопата', 'тёплый слой'],
    rules: [
      'Ворот нет: за трассами катание на свой риск',
      'В лесу легко потерять направление, держитесь просек',
      'Ручьи и завалы — главная опасность вне трасс',
      'Сектор Е открывается раньше остальных',
    ],
    hasGates: false,
    hazard: 'moderate',
    zones: [
      {
        id: 'fr-sher-top',
        name: 'Верх Зелёной',
        kind: 'offpiste',
        coordinates: box([87.938, 52.943], [87.972, 52.957]),
        verticalM: 420,
        hazard: 'moderate',
        aspect: 'восток',
        note: 'Целина между секторами, выкат к подъёмникам',
      },
      {
        id: 'fr-sher-e',
        name: 'Сектор Е · целины',
        kind: 'trees',
        coordinates: box([87.878, 52.923], [87.912, 52.937]),
        verticalM: 380,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Просеки и лес, популярно в снегопады',
      },
      {
        id: 'fr-sher-forest',
        name: 'Лесные склоны',
        kind: 'trees',
        coordinates: box([87.958, 52.918], [87.99, 52.932]),
        verticalM: 340,
        hazard: 'moderate',
        aspect: 'запад',
        note: 'Густой лес, нужен напарник',
      },
    ],
    gates: [],
  },

  'krasnoe-ozero': {
    resortId: 'krasnoe-ozero',
    summary:
      'Красное Озеро — небольшой курорт под Приозерском. Фрирайд как таковой не развит: есть лесные выкаты по краям склонов, но перепад маленький и выходы короткие. Для первого знакомства с целиной подходит, для серьёзного катания — нет.',
    season: 'декабрь — март',
    bestFor: ['первый опыт вне трасс', 'лес', 'выходные из Петербурга'],
    gear: ['шлем', 'защита', 'бипер по желанию'],
    rules: [
      'Лавинной службы нет: оценивайте склон сами',
      'Лесные выкаты короткие, легко выехать на дорогу',
      'В оттепель снег мокрый и тяжёлый',
      'Не уходите далеко от склонов без связи',
    ],
    hasGates: false,
    hazard: 'low',
    zones: [
      {
        id: 'fr-kras-les',
        name: 'Лес по краю склонов',
        kind: 'trees',
        coordinates: box([29.752, 60.52], [29.778, 60.532]),
        verticalM: 90,
        hazard: 'low',
        aspect: 'запад',
        note: 'Короткие выкаты, подходит для первого опыта',
      },
    ],
    gates: [],
  },

  tuutari: {
    resortId: 'tuutari',
    summary:
      'Туутари Парк — учебные и короткие склоны на Дудергофских высотах. Фрирайда нет: перепад 90 м, всё катание в границах подготовленных склонов. Для целины лучше ехать в Красное Озеро или Игору.',
    season: 'декабрь — март',
    bestFor: ['новичкам', 'первый снег', 'после работы'],
    gear: ['шлем', 'защита'],
    rules: [
      'Катание только в границах склонов',
      'Лес вокруг — не зона катания',
      'Детям до 5 лет нельзя без взрослого',
    ],
    hasGates: false,
    hazard: 'low',
    zones: [],
    gates: [],
  },

  kirovsk: {
    resortId: 'kirovsk',
    summary:
      'Хибины — большой фрирайд-район за полярным кругом: цирки Кукисвумчорра, северные склоны Вудъявра и длинные выкаты к озеру. Официальных ворот нет, лавинная обстановка меняется быстро, поэтому выход за трассы — только с гидом и полным набором.',
    season: 'ноябрь — май, лучший снег в марте и апреле',
    bestFor: ['полярный фрирайд', 'цирки', 'поздний сезон', 'много снега'],
    gear: ['бипер', 'щуп', 'лопата', 'рюкзак', 'тёплый слой'],
    rules: [
      'Официальных ворот нет: за границей трасс — на свой риск',
      'Без гида и лавинного набора не выходите в цирки',
      'Полярная ночь сокращает световой день, планируйте выход заранее',
      'Сообщайте маршрут и возвращайтесь до темноты',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-kir-kukis',
        name: 'Кукисвумчорр · цирки',
        kind: 'backcountry',
        coordinates: box([33.7, 67.61], [33.76, 67.64]),
        verticalM: 550,
        hazard: 'considerable',
        aspect: 'север, северо-восток',
        note: 'Цирки и кулуары над верхней станцией, нужен гид',
      },
      {
        id: 'fr-kir-vudyavr',
        name: 'Вудъявр · северные склоны',
        kind: 'offpiste',
        coordinates: box([33.68, 67.6], [33.75, 67.65]),
        verticalM: 700,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Целина между трассами и длинный выкат к озеру',
      },
    ],
    gates: [],
  },

  dombay: {
    resortId: 'dombay',
    summary:
      'Домбай — фрирайд вокруг Мусса-Ачитары и северного склона: кулуары под вершинами, лесные просеки и длинные весенние выкаты. Ворот нет, лавинная служба работает, но решение за райдером.',
    season: 'декабрь — апрель, весной мягкий снег',
    bestFor: ['кулуары', 'весенний снег', 'лес', 'длинные выкаты'],
    gear: ['бипер', 'щуп', 'лопата', 'каска'],
    rules: [
      'Ворот нет: выход за трассы — на свой риск',
      'Весной после полудня мокрые лавины, катайтесь утром',
      'Кулуары под вершинами требуют устойчивой погоды',
      'Не катайтесь в одиночку',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-dom-mussa',
        name: 'Мусса-Ачитара · север',
        kind: 'offpiste',
        coordinates: box([41.58, 43.27], [41.63, 43.3]),
        verticalM: 900,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Кулуары и лес между трассами',
      },
      {
        id: 'fr-dom-north',
        name: 'Северный склон · цели',
        kind: 'backcountry',
        coordinates: box([41.6, 43.28], [41.65, 43.31]),
        verticalM: 700,
        hazard: 'moderate',
        aspect: 'северо-запад',
        note: 'Целинные поля выше лесной зоны',
      },
    ],
    gates: [],
  },

  elbrus: {
    resortId: 'elbrus',
    summary:
      'Приэльбрусье — высокогорный фрирайд на леднике и в цирках Азау. Перепад огромный, трещины и лавины реальны круглый год. Самостоятельный выход за трассы без гида и акклиматизации недопустим.',
    season: 'декабрь — май, на леднике круглый год',
    bestFor: ['высокогорье', 'ледник', 'длинные спуски', 'март–апрель'],
    gear: ['бипер', 'щуп', 'лопата', 'обвязка', 'усы', 'солнцезащита'],
    rules: [
      'Только с гидом: трещины и лавины на леднике',
      'Акклиматизация перед выходом наверх обязательна',
      'Проверяйте закрытие верхних очередей утром',
      'Не выезжайте ниже Гарабаши без знания рельефа',
    ],
    hasGates: false,
    hazard: 'high',
    zones: [
      {
        id: 'fr-elbr-azau',
        name: 'Азау · ледник',
        kind: 'glacier',
        coordinates: box([42.44, 43.24], [42.48, 43.27]),
        verticalM: 1200,
        hazard: 'high',
        aspect: 'юг, юго-восток',
        note: 'Ледник с трещинами, только с гидом',
      },
      {
        id: 'fr-elbr-irik',
        name: 'Ирикчат · цирк',
        kind: 'backcountry',
        coordinates: box([42.45, 43.23], [42.5, 43.26]),
        verticalM: 800,
        hazard: 'considerable',
        aspect: 'север',
        note: 'Целина и кулуары в стороне от трасс',
      },
    ],
    gates: [],
  },

  manzherok: {
    resortId: 'manzherok',
    summary:
      'Манжерок — небольшой фрирайд в лесу Малой Синюхи и на склонах над Катунью. За трассами есть целинные поля, но перепад небольшой, а лавинная опасность умеренная. Для серьёзного фрирайда лучше ехать в Шерегеш.',
    season: 'декабрь — март',
    bestFor: ['лес', 'новичкам во фрирайде', 'семьям', 'недорого'],
    gear: ['бипер', 'щуп', 'лопата'],
    rules: [
      'Ворот нет: за трассами катание на свой риск',
      'В лесу держитесь просек и не теряйте ориентацию',
      'Подготовленных трасс хватает для первого опыта',
      'Весной снег быстро мокнет, катайтесь утром',
    ],
    hasGates: false,
    hazard: 'moderate',
    zones: [
      {
        id: 'fr-manz-sinyukha',
        name: 'Малая Синюха · лес',
        kind: 'trees',
        coordinates: box([85.76, 51.82], [85.81, 51.85]),
        verticalM: 500,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Лесная целина между трассами',
      },
      {
        id: 'fr-manz-katun',
        name: 'Над Катунью · поля',
        kind: 'offpiste',
        coordinates: box([85.79, 51.83], [85.84, 51.86]),
        verticalM: 450,
        hazard: 'moderate',
        aspect: 'восток',
        note: 'Открытые поля с видом на реку',
      },
    ],
    gates: [],
  },

  arkhyz: {
    resortId: 'arkhyz',
    summary:
      'Архыз — фрирайд в трёх долинах: кулуары над «Романтиком», лесные склоны Дукки и открытые поля Лунной Поляны. Официальных ворот нет, но лавинная служба работает. Верхние зоны требуют опыта и видимости.',
    season: 'декабрь — апрель',
    bestFor: ['кулуары', 'лес', 'длинные спуски', 'семьям'],
    gear: ['бипер', 'щуп', 'лопата', 'каска'],
    rules: [
      'Ворот нет: выход за трассы — на свой риск',
      'В январе сильные ветры, верха часто закрыты',
      'Кулуары требуют устойчивой погоды и опыта',
      'Не катайтесь в одиночку',
    ],
    hasGates: false,
    hazard: 'considerable',
    zones: [
      {
        id: 'fr-ark-dukka',
        name: 'Дукка · лес и цели',
        kind: 'trees',
        coordinates: box([41.29, 43.56], [41.33, 43.59]),
        verticalM: 600,
        hazard: 'moderate',
        aspect: 'север',
        note: 'Лесная целина между трассами',
      },
      {
        id: 'fr-ark-romantik',
        name: 'Романтик · север',
        kind: 'backcountry',
        coordinates: box([41.26, 43.55], [41.3, 43.58]),
        verticalM: 700,
        hazard: 'considerable',
        aspect: 'северо-запад',
        note: 'Кулуары над верхней станцией',
      },
    ],
    gates: [],
  },
}

export function freerideFor(resortId: string): FreerideInfo | undefined {
  return freeride[resortId]
}

export function hasFreeride(resortId: string): boolean {
  return Boolean(freeride[resortId])
}