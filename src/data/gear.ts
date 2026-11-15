import type { DisciplineMix, GearOwnership, PrepPlan } from '@/types'

/* ---------- чек-лист ---------- */

export type ChecklistTag = 'base' | 'freeride' | 'park' | 'buy' | 'rent'

export interface GearChecklistItem {
  id: string
  title: string
  note?: string
}

export interface GearChecklistGroup {
  id: string
  title: string
  tag: ChecklistTag
  note?: string
  items: GearChecklistItem[]
}

export const checklistGroups: GearChecklistGroup[] = [
  {
    id: 'base',
    title: 'Базовый набор',
    tag: 'base',
    note: 'для любого типа катания',
    items: [
      { id: 'thermals', title: 'Термобельё, 2 комплекта', note: 'один катать, второй — сухой на вечер' },
      { id: 'fleece', title: 'Флиска / утеплитель', note: 'средний слой' },
      { id: 'membrane', title: 'Мембранная куртка и штаны', note: 'защита от ветра и снега' },
      { id: 'helmet', title: 'Шлем', note: 'свой или прокат' },
      { id: 'goggles', title: 'Маска', note: 'линзы под погоду: солнце / пасмурно' },
      { id: 'gloves', title: 'Перчатки, лучше две пары', note: 'замена, если промокнут' },
      { id: 'buff', title: 'Баф / балаклава', note: 'лицо от ветра и солнца' },
      { id: 'sunscreen', title: 'Солнцезащитный крем SPF 50', note: 'снег отражает солнце' },
      { id: 'firstaid', title: 'Аптечка', note: 'пластыри, обезболивающее' },
    ],
  },
  {
    id: 'freeride',
    title: 'Для фрирайда',
    tag: 'freeride',
    note: 'обязательно за пределами трасс',
    items: [
      { id: 'backpack', title: 'Небольшой рюкзак', note: 'с лавинным снаряжением' },
      { id: 'beacon', title: 'Лавинный датчик (бипер)', note: 'проверить перед выходом' },
      { id: 'probe', title: 'Щуп', note: 'не короче 240 см' },
      { id: 'shovel', title: 'Лопата', note: 'металлическая, не пластик' },
      { id: 'radio', title: 'Рация', note: 'связь в горах' },
    ],
  },
  {
    id: 'park',
    title: 'Парк и трассы',
    tag: 'park',
    items: [
      { id: 'protection', title: 'Защита: наколенники, копчик, спина', note: 'особенно для первых прыжков' },
      { id: 'clear-lens', title: 'Дополнительная маска с прозрачной линзой', note: 'вечер и пасмурная погода' },
    ],
  },
  {
    id: 'buy',
    title: 'Что покупать сразу (личное)',
    tag: 'buy',
    items: [
      { id: 'buy-thermals', title: 'Термобельё', note: 'синтетика или меринос, не хлопок' },
      { id: 'buy-socks', title: 'Носки', note: 'сноубордические, без складок' },
      { id: 'buy-goggles', title: 'Маска (очки)', note: 'гигиеничнее и важнее шлема напрокат' },
      { id: 'buy-gloves', title: 'Перчатки / варежки', note: 'свои всегда удобнее' },
    ],
  },
  {
    id: 'rent',
    title: 'Прокат',
    tag: 'rent',
    items: [
      { id: 'rent-book', title: 'Забронировать комплект заранее', note: 'в праздники размеров мало' },
      { id: 'rent-boots', title: 'Проверить ботинки по размеру', note: 'палец не упирается, пятка не гуляет' },
      { id: 'rent-docs', title: 'Документы и залог', note: 'уточнить условия проката' },
    ],
  },
]

export function applicableChecklist(
  mix: DisciplineMix,
  ownership: GearOwnership,
): GearChecklistGroup[] {
  return checklistGroups.filter((group) => {
    if (group.tag === 'base' || group.tag === 'buy') return true
    if (group.tag === 'freeride') return mix.freeride > 0
    if (group.tag === 'park') return mix.park > 0
    return ownership !== 'own'
  })
}

export function checklistProgress(plan: Pick<PrepPlan, 'mix' | 'ownership' | 'checklist'>): {
  done: number
  total: number
  percent: number
} {
  const groups = applicableChecklist(plan.mix, plan.ownership)
  const items = groups.flatMap((group) => group.items)
  const done = items.filter((item) => plan.checklist[item.id]).length
  return {
    done,
    total: items.length,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
  }
}

export function needsAvalancheKit(mix: DisciplineMix): boolean {
  return mix.freeride > 0
}

export function avalancheKitReady(checklist: Record<string, boolean>): boolean {
  return Boolean(checklist.beacon && checklist.probe && checklist.shovel)
}

/* ---------- бренды ---------- */

export type BrandCategory = 'snowboard' | 'ski' | 'boots' | 'bindings' | 'poles' | 'clothing'

export type BrandTier = 'budget' | 'mid' | 'top'

export interface GearBrand {
  id: string
  name: string
  category: BrandCategory
  note: string
  price: string
  query: string
  /** бюджетный сегмент — для ботинок и одежды */
  tier?: BrandTier
}

export const brandTierLabels: Record<BrandTier, string> = {
  budget: 'Эконом',
  mid: 'Средний',
  top: 'Топ',
}

export const brandCategories: { id: BrandCategory; label: string }[] = [
  { id: 'snowboard', label: 'Сноуборды' },
  { id: 'ski', label: 'Лыжи' },
  { id: 'boots', label: 'Ботинки' },
  { id: 'bindings', label: 'Крепления' },
  { id: 'poles', label: 'Палки' },
  { id: 'clothing', label: 'Одежда РФ' },
]

export const gearBrands: GearBrand[] = [
  { id: 'burton', name: 'Burton', category: 'snowboard', note: 'All-mountain и парк, Custom и Process — универсальная классика.', price: '45–90 тыс. ₽', query: 'Burton сноуборд купить' },
  { id: 'jones', name: 'Jones', category: 'snowboard', note: 'Фрирайд и горы: Mountain Twin, Flagship, Stratos.', price: '50–95 тыс. ₽', query: 'Jones сноуборд купить' },
  { id: 'libtech', name: 'Lib Tech', category: 'snowboard', note: 'Rocker и магне-тракшн, Orca для глубокого снега.', price: '55–90 тыс. ₽', query: 'Lib Tech сноуборд купить' },
  { id: 'gnu', name: 'GNU', category: 'snowboard', note: 'Парк и фрирайд с асимметрией, Riders Choice.', price: '45–78 тыс. ₽', query: 'GNU сноуборд купить' },
  { id: 'capita', name: 'Capita', category: 'snowboard', note: 'Парк и трасса, DOA и Mercury — лёгкие и живые.', price: '45–80 тыс. ₽', query: 'Capita сноуборд купить' },
  { id: 'nitro', name: 'Nitro', category: 'snowboard', note: 'Крепкие all-mountain доски: Team, Pantera.', price: '40–70 тыс. ₽', query: 'Nitro сноуборд купить' },
  { id: 'salomon', name: 'Salomon', category: 'snowboard', note: 'Assassin и Sight — универсалы для трассы и парка.', price: '40–75 тыс. ₽', query: 'Salomon сноуборд купить' },
  { id: 'ride', name: 'Ride', category: 'snowboard', note: 'Парк и трасса, Warpig и Zero — широкие и стабильные.', price: '45–80 тыс. ₽', query: 'Ride сноуборд купить' },
  { id: 'yes', name: 'YES', category: 'snowboard', note: 'Фрирайд-геометрия, PYL и Basic.', price: '45–75 тыс. ₽', query: 'YES сноуборд купить' },
  { id: 'bataleon', name: 'Bataleon', category: 'snowboard', note: '3BT и парк, Whatever и Goliath.', price: '40–70 тыс. ₽', query: 'Bataleon сноуборд купить' },
  { id: 'gentemstick', name: 'Gentemstick', category: 'snowboard', note: 'Япония: фрирайд-доски ручной сборки, снег Хоккайдо.', price: '90–160 тыс. ₽', query: 'Gentemstick сноуборд купить' },
  { id: 'moss', name: 'Moss', category: 'snowboard', note: 'Япония: дерево и серф-геометрия для целины.', price: '80–150 тыс. ₽', query: 'Moss сноуборд купить' },

  { id: 'atomic', name: 'Atomic', category: 'ski', note: 'Bent Chetler — фрирайд, Redster — трасса.', price: '55–100 тыс. ₽', query: 'Atomic горные лыжи купить' },
  { id: 'rossignol', name: 'Rossignol', category: 'ski', note: 'Experience для трассы, Sender для фрирайда.', price: '45–90 тыс. ₽', query: 'Rossignol горные лыжи купить' },
  { id: 'salomon-ski', name: 'Salomon', category: 'ski', note: 'QST — универсальная линейка для любых условий.', price: '50–95 тыс. ₽', query: 'Salomon QST горные лыжи купить' },
  { id: 'head', name: 'Head', category: 'ski', note: 'Kore — лёгкие all-mountain, Supershape — трасса.', price: '45–85 тыс. ₽', query: 'Head Kore горные лыжи купить' },
  { id: 'fischer', name: 'Fischer', category: 'ski', note: 'Ranger — универсалы, RC4 — спортивная трасса.', price: '45–85 тыс. ₽', query: 'Fischer Ranger горные лыжи купить' },
  { id: 'blizzard', name: 'Blizzard', category: 'ski', note: 'Rustler и Brahma — стабильные all-mountain.', price: '55–100 тыс. ₽', query: 'Blizzard Rustler горные лыжи купить' },
  { id: 'nordica', name: 'Nordica', category: 'ski', note: 'Enforcer — фрирайд и трасса, Dobermann — спорт.', price: '55–95 тыс. ₽', query: 'Nordica Enforcer горные лыжи купить' },
  { id: 'volkl', name: 'Völkl', category: 'ski', note: 'Mantra для универсала, Revolt для парка.', price: '55–100 тыс. ₽', query: 'Volkl Mantra горные лыжи купить' },
  { id: 'k2', name: 'K2', category: 'ski', note: 'Mindbender и Reckoner — универсалы и парк.', price: '45–85 тыс. ₽', query: 'K2 Mindbender горные лыжи купить' },
  { id: 'elan', name: 'Elan', category: 'ski', note: 'Ripstick — лёгкие и дружелюбные all-mountain.', price: '45–80 тыс. ₽', query: 'Elan Ripstick горные лыжи купить' },
  { id: 'blackcrows', name: 'Black Crows', category: 'ski', note: 'Фрирайд-дизайн: Atris, Camox, Corvus.', price: '70–120 тыс. ₽', query: 'Black Crows горные лыжи купить' },
  { id: 'armada', name: 'Armada', category: 'ski', note: 'Парк и фрирайд: ARV, Declivity.', price: '45–85 тыс. ₽', query: 'Armada ARV горные лыжи купить' },
  { id: 'ogasaka', name: 'Ogasaka', category: 'ski', note: 'Япония: трасса и универсалы, точная геометрия.', price: '60–120 тыс. ₽', query: 'Ogasaka горные лыжи купить' },
  { id: 'swallow', name: 'Swallow', category: 'ski', note: 'Япония: лыжи для трассы и мягкого снега.', price: '50–110 тыс. ₽', query: 'Swallow горные лыжи купить' },

  { id: 'burton-boots', name: 'Burton', category: 'boots', tier: 'mid', note: 'Сноуборд: Moto (мягкие), Ruler (средние), Ion (жёсткие).', price: '18–45 тыс. ₽', query: 'Burton сноубордические ботинки купить' },
  { id: 'thirtytwo', name: 'ThirtyTwo', category: 'boots', tier: 'mid', note: 'Сноуборд: TM-2 и Lashed, удобная колодка.', price: '18–40 тыс. ₽', query: 'ThirtyTwo сноубордические ботинки купить' },
  { id: 'deeluxe', name: 'Deeluxe', category: 'boots', tier: 'top', note: 'Сноуборд: жёсткие модели для фрирайда.', price: '20–45 тыс. ₽', query: 'Deeluxe сноубордические ботинки купить' },
  { id: 'salomon-boots', name: 'Salomon', category: 'boots', tier: 'mid', note: 'Сноуборд и лыжи: S/Pro, Faction.', price: '18–45 тыс. ₽', query: 'Salomon горнолыжные ботинки купить' },
  { id: 'tecnica', name: 'Tecnica', category: 'boots', tier: 'top', note: 'Лыжи: Mach1 100 и 130 — эталон посадки.', price: '25–55 тыс. ₽', query: 'Tecnica Mach1 горнолыжные ботинки купить' },
  { id: 'lange', name: 'Lange', category: 'boots', tier: 'top', note: 'Лыжи: Shadow и RS, спортивная жёсткость.', price: '25–55 тыс. ₽', query: 'Lange горнолыжные ботинки купить' },
  { id: 'dalbello', name: 'Dalbello', category: 'boots', tier: 'mid', note: 'Лыжи: трёхсоставные ботинки, парк и трасса.', price: '25–50 тыс. ₽', query: 'Dalbello горнолыжные ботинки купить' },
  { id: 'atomic-boots', name: 'Atomic', category: 'boots', tier: 'mid', note: 'Лыжи: Hawx — лёгкие и удобные.', price: '25–50 тыс. ₽', query: 'Atomic Hawx горнолыжные ботинки купить' },
  { id: 'k2-boots', name: 'K2', category: 'boots', tier: 'mid', note: 'Сноуборд и лыжи: Maysis, Recon, BFC.', price: '18–42 тыс. ₽', query: 'K2 горнолыжные ботинки купить' },
  { id: 'ride-boots', name: 'Ride', category: 'boots', tier: 'mid', note: 'Сноуборд: Lasso и Trident, удобная шнуровка.', price: '18–38 тыс. ₽', query: 'Ride сноубордические ботинки купить' },
  { id: 'vans-boots', name: 'Vans', category: 'boots', tier: 'budget', note: 'Сноуборд: Hi-Standard, мягкие и недорогие.', price: '12–28 тыс. ₽', query: 'Vans сноубордические ботинки купить' },
  { id: 'nitro-boots', name: 'Nitro', category: 'boots', tier: 'mid', note: 'Сноуборд: Anthem, Venture, Capital.', price: '16–38 тыс. ₽', query: 'Nitro сноубордические ботинки купить' },
  { id: 'nordica-boots', name: 'Nordica', category: 'boots', tier: 'mid', note: 'Лыжи: Speedmachine и Cruise, комфорт.', price: '22–50 тыс. ₽', query: 'Nordica горнолыжные ботинки купить' },
  { id: 'head-boots', name: 'Head', category: 'boots', tier: 'mid', note: 'Лыжи: Kore и Edge, универсальная посадка.', price: '22–50 тыс. ₽', query: 'Head горнолыжные ботинки купить' },
  { id: 'nordway-boots', name: 'Nordway (РФ)', category: 'boots', tier: 'budget', note: 'РФ, бюджетный старт и прокат; проверяйте жёсткость.', price: '8–18 тыс. ₽', query: 'Nordway горнолыжные ботинки купить' },
  { id: 'termit-boots', name: 'Termit (РФ)', category: 'boots', tier: 'budget', note: 'РФ, недорогие ботинки для первых сезонов.', price: '7–16 тыс. ₽', query: 'Termit горнолыжные ботинки купить' },
  { id: 'splav-boots', name: 'Splav (РФ)', category: 'boots', tier: 'mid', note: 'РФ, аутдор-ботинки для холода и снега.', price: '12–26 тыс. ₽', query: 'Splav зимние ботинки купить' },
  { id: 'stayer-boots', name: 'Stayer (РФ)', category: 'boots', tier: 'budget', note: 'РФ, базовые ботинки и термоносоки.', price: '8–20 тыс. ₽', query: 'Stayer зимние ботинки купить' },
  { id: 'bask-boots', name: 'Bask (РФ)', category: 'boots', tier: 'top', note: 'РФ, тёплые аутдор-ботинки для севера.', price: '18–35 тыс. ₽', query: 'Bask зимние ботинки купить' },

  { id: 'union', name: 'Union', category: 'bindings', note: 'Сноуборд: Flite Pro, Strata, Atlas.', price: '15–35 тыс. ₽', query: 'Union сноубордические крепления купить' },
  { id: 'burton-bindings', name: 'Burton', category: 'bindings', note: 'Сноуборд: Mission, Cartel, Genesis.', price: '18–40 тыс. ₽', query: 'Burton сноубордические крепления купить' },
  { id: 'rome', name: 'Rome', category: 'bindings', note: 'Сноуборд: парк и трасса, лёгкие базы.', price: '15–30 тыс. ₽', query: 'Rome сноубордические крепления купить' },
  { id: 'bentmetal', name: 'Bent Metal', category: 'bindings', note: 'Сноуборд: прочные и простые, Transfer.', price: '15–30 тыс. ₽', query: 'Bent Metal сноубордические крепления купить' },
  { id: 'now', name: 'Now', category: 'bindings', note: 'Сноуборд: Now IPO и Drive, прямая передача усилия.', price: '16–34 тыс. ₽', query: 'Now сноубордические крепления купить' },
  { id: 'nitro-bindings', name: 'Nitro', category: 'bindings', note: 'Сноуборд: Rambler, Phantom, Machine.', price: '14–32 тыс. ₽', query: 'Nitro сноубордические крепления купить' },
  { id: 'ride-bindings', name: 'Ride', category: 'bindings', note: 'Сноуборд: A-6, C-8, A-8.', price: '14–32 тыс. ₽', query: 'Ride сноубордические крепления купить' },
  { id: 'k2-bindings', name: 'K2', category: 'bindings', note: 'Сноуборд: Formula, Meridian, Program.', price: '14–30 тыс. ₽', query: 'K2 сноубордические крепления купить' },
  { id: 'arbor-bindings', name: 'Arbor', category: 'bindings', note: 'Сноуборд: Cypress и Hemlock, дерево и минимализм.', price: '15–30 тыс. ₽', query: 'Arbor сноубордические крепления купить' },
  { id: 'marker', name: 'Marker', category: 'bindings', note: 'Лыжи: Squire, Griffon, Jester.', price: '12–30 тыс. ₽', query: 'Marker горнолыжные крепления купить' },
  { id: 'tyrolia', name: 'Tyrolia', category: 'bindings', note: 'Лыжи: Attack 11–16, надёжная классика.', price: '12–30 тыс. ₽', query: 'Tyrolia Attack горнолыжные крепления купить' },
  { id: 'look', name: 'Look', category: 'bindings', note: 'Лыжи: Pivot и SPX, короткая база и контроль.', price: '14–36 тыс. ₽', query: 'Look Pivot горнолыжные крепления купить' },
  { id: 'salomon-bindings', name: 'Salomon', category: 'bindings', note: 'Лыжи: Strive и Stage, универсальные.', price: '12–30 тыс. ₽', query: 'Salomon горнолыжные крепления купить' },
  { id: 'atomic-bindings', name: 'Atomic', category: 'bindings', note: 'Лыжи: Strive 12–16, лёгкие и точные.', price: '12–30 тыс. ₽', query: 'Atomic горнолыжные крепления купить' },
  { id: 'head-bindings', name: 'Head', category: 'bindings', note: 'Лыжи: SX, TX, Freeflex.', price: '12–30 тыс. ₽', query: 'Head горнолыжные крепления купить' },
  { id: 'fischer-bindings', name: 'Fischer', category: 'bindings', note: 'Лыжи: RS 11–16, под трассу и фрирайд.', price: '12–30 тыс. ₽', query: 'Fischer горнолыжные крепления купить' },
  { id: 'volkl-bindings', name: 'Völkl', category: 'bindings', note: 'Лыжи: крепления в комплекте с Mantra и Revolt.', price: '12–28 тыс. ₽', query: 'Volkl горнолыжные крепления купить' },
  { id: 'blizzard-bindings', name: 'Blizzard', category: 'bindings', note: 'Лыжи: комплекты для Rustler и Brahma.', price: '12–28 тыс. ₽', query: 'Blizzard горнолыжные крепления купить' },
  { id: 'armada-bindings', name: 'Armada', category: 'bindings', note: 'Лыжи: парк и фрирайд, комплекты ARV.', price: '14–32 тыс. ₽', query: 'Armada горнолыжные крепления купить' },

  { id: 'leki', name: 'Leki', category: 'poles', note: 'Лыжные палки с быстрым сбросом, карбон.', price: '8–25 тыс. ₽', query: 'Leki горнолыжные палки купить' },
  { id: 'bd', name: 'Black Diamond', category: 'poles', note: 'Traverse и Carbon — лёгкие и прочные.', price: '7–20 тыс. ₽', query: 'Black Diamond горнолыжные палки купить' },
  { id: 'komperdell', name: 'Komperdell', category: 'poles', note: 'Австрийские палки, телескопы для фрирайда.', price: '6–18 тыс. ₽', query: 'Komperdell горнолыжные палки купить' },
  { id: 'scott', name: 'Scott', category: 'poles', note: 'Палки и защита, хорошие базовые модели.', price: '5–15 тыс. ₽', query: 'Scott горнолыжные палки купить' },
  { id: 'salomon-poles', name: 'Salomon', category: 'poles', note: 'Arctic и MTN, лёгкий алюминий.', price: '5–15 тыс. ₽', query: 'Salomon горнолыжные палки купить' },
  { id: 'atomic-poles', name: 'Atomic', category: 'poles', note: 'Cloud и Redster, под трассу и фрирайд.', price: '6–18 тыс. ₽', query: 'Atomic горнолыжные палки купить' },

  { id: 'bask', name: 'Bask', category: 'clothing', tier: 'top', note: 'РФ: пух и мембрана для холода, верхний сегмент.', price: '25–60 тыс. ₽', query: 'Bask горнолыжная куртка купить' },
  { id: 'redfox', name: 'Red Fox', category: 'clothing', tier: 'mid', note: 'РФ: аутдор, куртки и штаны на сезон.', price: '15–40 тыс. ₽', query: 'Red Fox горнолыжная куртка купить' },
  { id: 'splav', name: 'Splav', category: 'clothing', tier: 'budget', note: 'РФ: мембранные куртки и штаны, доступно.', price: '12–30 тыс. ₽', query: 'Splav горнолыжная куртка купить' },
  { id: 'stayer', name: 'Stayer', category: 'clothing', tier: 'budget', note: 'РФ: спортивный бренд, базовые слои.', price: '8–25 тыс. ₽', query: 'Stayer горнолыжная одежда купить' },
  { id: 'nordski', name: 'Nordski', category: 'clothing', tier: 'budget', note: 'РФ: одежда для снега, хороший бюджет.', price: '10–25 тыс. ₽', query: 'Nordski горнолыжная куртка купить' },
  { id: 'termit', name: 'Termit', category: 'clothing', tier: 'budget', note: 'РФ: термобельё и мембрана, недорого.', price: '5–18 тыс. ₽', query: 'Termit горнолыжная одежда купить' },
  { id: 'wedze', name: 'Decathlon Wedze', category: 'clothing', tier: 'budget', note: 'Франция/Decathlon: бюджетный старт.', price: '5–20 тыс. ₽', query: 'Wedze горнолыжная куртка купить' },
  { id: 'nordway', name: 'Nordway / Спортмастер', category: 'clothing', tier: 'budget', note: 'РФ: доступная одежда и перчатки для старта.', price: '4–15 тыс. ₽', query: 'Nordway горнолыжная куртка купить' },
  { id: 'columbia', name: 'Columbia', category: 'clothing', tier: 'mid', note: 'США: массовый аутдор, куртки и штаны.', price: '15–35 тыс. ₽', query: 'Columbia горнолыжная куртка купить' },
  { id: 'haglofs', name: 'Haglöfs', category: 'clothing', tier: 'mid', note: 'Швеция: мембрана и посадка, средний сегмент.', price: '25–55 тыс. ₽', query: 'Haglofs горнолыжная куртка купить' },
  { id: 'montbell', name: 'Montbell', category: 'clothing', tier: 'mid', note: 'Япония: лёгкий пух и мембрана.', price: '20–50 тыс. ₽', query: 'Montbell горнолыжная куртка купить' },
  { id: 'salomon-clothing', name: 'Salomon', category: 'clothing', tier: 'mid', note: 'Франция: горнолыжные куртки и штаны.', price: '20–50 тыс. ₽', query: 'Salomon горнолыжная куртка купить' },
  { id: 'goldwin', name: 'Goldwin', category: 'clothing', tier: 'mid', note: 'Япония: минимализм, мембрана, лыжная классика.', price: '30–70 тыс. ₽', query: 'Goldwin горнолыжная куртка купить' },
  { id: 'tnf', name: 'The North Face', category: 'clothing', tier: 'top', note: 'США: премиальный аутдор, параллельный импорт.', price: '40–90 тыс. ₽', query: 'The North Face горнолыжная куртка купить' },
  { id: 'patagonia', name: 'Patagonia', category: 'clothing', tier: 'top', note: 'США: эко-аутдор, пух и мембрана.', price: '45–95 тыс. ₽', query: 'Patagonia горнолыжная куртка купить' },
  { id: 'arcteryx', name: "Arc'teryx", category: 'clothing', tier: 'top', note: 'Канада: премиальная мембрана и крой.', price: '70–150 тыс. ₽', query: 'Arcteryx горнолыжная куртка купить' },
  { id: 'mammut', name: 'Mammut', category: 'clothing', tier: 'top', note: 'Швейцария: горная одежда и защита.', price: '45–100 тыс. ₽', query: 'Mammut горнолыжная куртка купить' },
  { id: 'norrona', name: 'Norrøna', category: 'clothing', tier: 'top', note: 'Норвегия: цвет и мембрана для фрирайда.', price: '60–130 тыс. ₽', query: 'Norrona горнолыжная куртка купить' },
  { id: 'descente', name: 'Descente', category: 'clothing', tier: 'top', note: 'Япония: лыжная классика и точная посадка.', price: '45–100 тыс. ₽', query: 'Descente горнолыжная куртка купить' },
  { id: 'phenix', name: 'Phenix', category: 'clothing', tier: 'top', note: 'Япония: премиальные лыжные коллекции.', price: '50–120 тыс. ₽', query: 'Phenix горнолыжная куртка купить' },
  { id: 'burton-ak', name: 'Burton [ak]', category: 'clothing', tier: 'top', note: 'США: фрирайд-линейка Burton, мембрана GORE-TEX.', price: '50–110 тыс. ₽', query: 'Burton AK горнолыжная куртка купить' },
]

export function brandsFor(category: BrandCategory): GearBrand[] {
  return gearBrands.filter((brand) => brand.category === category)
}

export interface BrandTierGroup {
  tier: BrandTier
  label: string
  brands: GearBrand[]
}

/** Ботинки и одежда группируются по бюджету. */
export function brandsByTier(category: BrandCategory): BrandTierGroup[] {
  return (['budget', 'mid', 'top'] as BrandTier[])
    .map((tier) => ({
      tier,
      label: brandTierLabels[tier],
      brands: gearBrands.filter((brand) => brand.category === category && brand.tier === tier),
    }))
    .filter((group) => group.brands.length > 0)
}

/* ---------- бюджет РФ ---------- */

export interface BudgetItem {
  label: string
  price: string
}

export interface BudgetTier {
  id: string
  title: string
  note: string
  items: BudgetItem[]
  total: string
}

export interface BudgetSection {
  id: string
  title: string
  note: string
  tiers: BudgetTier[]
}

export const budgetSections: BudgetSection[] = [
  {
    id: 'rent',
    title: 'Аренда комплекта',
    note: 'цена за день в РФ, 6 дней катания',
    tiers: [
      {
        id: 'rent-economy',
        title: 'Эконом',
        note: 'базовый прокат у подъёмника',
        items: [
          { label: 'Доска/лыжи + ботинки', price: '2 500–3 500 ₽/день' },
          { label: 'Шлем и маска', price: '500–900 ₽/день' },
        ],
        total: '18–26 тыс. ₽ за 6 дней',
      },
      {
        id: 'rent-optimum',
        title: 'Оптимум',
        note: 'свежие модели, подгонка ботинок',
        items: [
          { label: 'Комплект + ботинки', price: '3 500–5 000 ₽/день' },
          { label: 'Шлем и маска', price: '700–1 200 ₽/день' },
        ],
        total: '25–37 тыс. ₽ за 6 дней',
      },
      {
        id: 'rent-premium',
        title: 'Премиум',
        note: 'топовые модели и сервис',
        items: [
          { label: 'Премиум-комплект', price: '5 000–8 000 ₽/день' },
          { label: 'Шлем и маска', price: '1 000–2 000 ₽/день' },
        ],
        total: '36–60 тыс. ₽ за 6 дней',
      },
    ],
  },
  {
    id: 'buy-board',
    title: 'Покупка сноуборда',
    note: 'доска, ботинки, крепления, шлем, маска',
    tiers: [
      {
        id: 'board-economy',
        title: 'Эконом',
        note: 'старт без гонки за весом',
        items: [
          { label: 'Доска', price: '25–40 тыс. ₽' },
          { label: 'Ботинки', price: '12–18 тыс. ₽' },
          { label: 'Крепления', price: '8–14 тыс. ₽' },
          { label: 'Шлем и маска', price: '9–15 тыс. ₽' },
        ],
        total: '54–87 тыс. ₽',
      },
      {
        id: 'board-optimum',
        title: 'Оптимум',
        note: 'на несколько сезонов',
        items: [
          { label: 'Доска', price: '45–70 тыс. ₽' },
          { label: 'Ботинки', price: '20–30 тыс. ₽' },
          { label: 'Крепления', price: '15–25 тыс. ₽' },
          { label: 'Шлем и маска', price: '14–22 тыс. ₽' },
        ],
        total: '94–147 тыс. ₽',
      },
      {
        id: 'board-premium',
        title: 'Премиум',
        note: 'топовые линейки',
        items: [
          { label: 'Доска', price: '80–140 тыс. ₽' },
          { label: 'Ботинки', price: '30–45 тыс. ₽' },
          { label: 'Крепления', price: '25–40 тыс. ₽' },
          { label: 'Шлем и маска', price: '22–38 тыс. ₽' },
        ],
        total: '157–263 тыс. ₽',
      },
    ],
  },
  {
    id: 'buy-ski',
    title: 'Покупка лыж',
    note: 'лыжи, ботинки, крепления, шлем, маска',
    tiers: [
      {
        id: 'ski-economy',
        title: 'Эконом',
        note: 'первый комплект',
        items: [
          { label: 'Лыжи', price: '30–45 тыс. ₽' },
          { label: 'Ботинки', price: '15–22 тыс. ₽' },
          { label: 'Крепления', price: '10–16 тыс. ₽' },
          { label: 'Шлем и маска', price: '10–16 тыс. ₽' },
        ],
        total: '65–99 тыс. ₽',
      },
      {
        id: 'ski-optimum',
        title: 'Оптимум',
        note: 'универсал на сезон',
        items: [
          { label: 'Лыжи', price: '50–80 тыс. ₽' },
          { label: 'Ботинки', price: '25–35 тыс. ₽' },
          { label: 'Крепления', price: '18–28 тыс. ₽' },
          { label: 'Шлем и маска', price: '14–22 тыс. ₽' },
        ],
        total: '107–165 тыс. ₽',
      },
      {
        id: 'ski-premium',
        title: 'Премиум',
        note: 'спорт и фрирайд',
        items: [
          { label: 'Лыжи', price: '90–150 тыс. ₽' },
          { label: 'Ботинки', price: '35–55 тыс. ₽' },
          { label: 'Крепления', price: '28–45 тыс. ₽' },
          { label: 'Шлем и маска', price: '22–38 тыс. ₽' },
        ],
        total: '175–288 тыс. ₽',
      },
    ],
  },
  {
    id: 'clothing',
    title: 'Одежда в РФ',
    note: 'куртка, штаны, термобельё, перчатки',
    tiers: [
      {
        id: 'cloth-economy',
        title: 'Эконом',
        note: 'Decathlon, Nordway, Termit',
        items: [
          { label: 'Куртка', price: '8–14 тыс. ₽' },
          { label: 'Штаны', price: '6–10 тыс. ₽' },
          { label: 'Термобельё', price: '3–5 тыс. ₽' },
          { label: 'Перчатки', price: '2–4 тыс. ₽' },
        ],
        total: '19–33 тыс. ₽',
      },
      {
        id: 'cloth-optimum',
        title: 'Оптимум',
        note: 'Splav, Red Fox, Nordski',
        items: [
          { label: 'Куртка', price: '15–25 тыс. ₽' },
          { label: 'Штаны', price: '10–18 тыс. ₽' },
          { label: 'Термобельё', price: '5–8 тыс. ₽' },
          { label: 'Перчатки', price: '3–6 тыс. ₽' },
        ],
        total: '33–57 тыс. ₽',
      },
      {
        id: 'cloth-premium',
        title: 'Премиум',
        note: 'Bask, Columbia, The North Face',
        items: [
          { label: 'Куртка', price: '30–50 тыс. ₽' },
          { label: 'Штаны', price: '20–35 тыс. ₽' },
          { label: 'Термобельё', price: '8–15 тыс. ₽' },
          { label: 'Перчатки', price: '6–12 тыс. ₽' },
        ],
        total: '64–112 тыс. ₽',
      },
    ],
  },
]
