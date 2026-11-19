import type { GuideCurrency } from '@/data/resort-guides'
import { guideFor } from '@/data/resort-guides'
import { findResort } from '@/data/resorts'
import type { Coords } from '@/lib/geo'

/**
 * Курируемый каталог ориентиров, а не инвентарь партнёра.
 * Цена — «от», средний сезон, за номер в сутки; её нужно проверять на сайте.
 */
export interface HotelOffer {
  id: string
  resortId: string
  name: string
  /** id части курорта из гида: к её нижней станции считается расстояние */
  zoneId: string
  stars: number
  /** рейтинг 0–10, 0 — не указан */
  rating: number
  /** цена за номер в сутки, средний сезон */
  priceFrom: number
  currency: GuideCurrency
  maxGuests: number
  /** расстояние до нижней станции выбранной зоны, км */
  liftKm: number
  note?: string
}

const hotel = (
  id: string,
  resortId: string,
  name: string,
  zoneId: string,
  stars: number,
  rating: number,
  priceFrom: number,
  currency: GuideCurrency,
  maxGuests: number,
  liftKm: number,
  note?: string,
): HotelOffer => ({
  id,
  resortId,
  name,
  zoneId,
  stars,
  rating,
  priceFrom,
  currency,
  maxGuests,
  liftKm,
  note,
})

export const hotelCatalog: HotelOffer[] = [
  // Красная Поляна
  hotel('kp-rixos', 'krasnaya-polyana', 'Rixos Krasnaya Polyana Sochi', 'gorki', 5, 9.1, 22000, 'RUB', 3, 0.8, '5*, бассейн и спа'),
  hotel('kp-marriott', 'krasnaya-polyana', 'Marriott Krasnaya Polyana', 'gorki', 5, 8.8, 17000, 'RUB', 3, 1.1, 'рядом с Горки Город'),
  hotel('kp-imeretinsky', 'krasnaya-polyana', 'Имеретинский отель', 'rosa', 4, 8.5, 11000, 'RUB', 3, 7.5, 'у моря, трансфер к склонам'),

  // Роза Хутор
  hotel('rosa-radisson', 'rosa-khutor', 'Radisson Rosa Khutor', 'south', 4, 8.9, 16000, 'RUB', 3, 0.35, 'ski-in/ski-out'),
  hotel('rosa-springs', 'rosa-khutor', 'Rosa Springs Hotel', 'south', 5, 9.0, 21000, 'RUB', 3, 0.5, 'спа и панорамные номера'),
  hotel('rosa-panorama', 'rosa-khutor', 'Panorama Rosa Khutor', 'north', 4, 8.4, 12500, 'RUB', 4, 0.9, 'апартаменты с кухней'),

  // Шерегеш
  hotel('sher-alpen', 'sheregesh', 'Альпен Клаб', 'sector-e', 4, 8.7, 8500, 'RUB', 3, 0.25, 'у подъёмника «Е»'),
  hotel('sher-medvezhonok', 'sheregesh', 'Медвежонок', 'kaskad', 3, 8.2, 6200, 'RUB', 3, 0.6, 'сауна и завтраки'),
  hotel('sher-snezhny', 'sheregesh', 'Снежный', 'kaskad', 3, 8.0, 5400, 'RUB', 2, 0.9, 'бюджетный вариант'),

  // Домбай
  hotel('domb-snezhnaya', 'dombay', 'Снежная долина', 'mussa', 4, 8.6, 7800, 'RUB', 3, 0.4, 'у канатной дороги'),
  hotel('domb-trois', 'dombay', 'Три вершины', 'north', 3, 8.1, 6100, 'RUB', 3, 0.7, 'вид на Эльбрус'),
  hotel('domb-krokus', 'dombay', 'Крокус', 'polyana', 3, 7.9, 5200, 'RUB', 2, 1.2, 'центр поляны'),

  // Приэльбрусье
  hotel('elbr-azau', 'elbrus', 'Ozon Азау', 'azau', 4, 8.4, 7200, 'RUB', 3, 0.3, 'у нижней станции'),
  hotel('elbr-vershina', 'elbrus', 'Вершина', 'azau', 3, 8.0, 5600, 'RUB', 3, 0.55, 'завтрак включён'),
  hotel('elbr-povorot', 'elbrus', 'Поворот', 'mir', 3, 7.8, 4800, 'RUB', 2, 1.4, 'на дороге к Чегету'),

  // Архыз
  hotel('ark-romantik', 'arkhyz', 'Романтик', 'romantik', 4, 8.5, 7600, 'RUB', 3, 0.2, 'ski-in/ski-out'),
  hotel('ark-medvezhya', 'arkhyz', 'Медвежья долина', 'dukka', 3, 8.1, 5900, 'RUB', 4, 1.1, 'коттеджи у леса'),
  hotel('ark-azimut', 'arkhyz', 'Азимут Архыз', 'lunnaya', 4, 8.3, 6800, 'RUB', 3, 1.8, 'спа и ресторан'),

  // Кировск
  hotel('kir-zapolyarny', 'kirovsk', 'Заполярный', 'vudyavr', 3, 8.0, 5200, 'RUB', 3, 0.35, 'у подъёмника Вудъявр'),
  hotel('kir-khibiny', 'kirovsk', 'Хибины', 'vudyavr', 3, 7.8, 4600, 'RUB', 2, 0.8, 'бюджетно и по-домашнему'),
  hotel('kir-tirvas', 'kirovsk', 'Тирвас', 'kukisvumchorr', 4, 8.2, 6400, 'RUB', 3, 1.2, 'спа-центр'),

  // Манжерок
  hotel('manzherok-hotel', 'manzherok', 'Манжерок', 'sinyukha', 4, 8.4, 7800, 'RUB', 3, 0.4, 'у подножия Синюхи'),
  hotel('manzherok-biryuza', 'manzherok', 'Бирюзовая Катунь', 'north', 3, 8.0, 5900, 'RUB', 4, 2.5, 'коттеджи на берегу'),
  hotel('manzherok-altai', 'manzherok', 'Алтай Палас', 'sinyukha', 5, 8.6, 11500, 'RUB', 3, 1.1, '5* с бассейном'),

  // Нисеко
  hotel('niseko-hilton', 'niseko', 'Hilton Niseko Village', 'village', 5, 8.7, 42000, 'JPY', 3, 0.15, 'ski-in/ski-out, онсэн'),
  hotel('niseko-greenleaf', 'niseko', 'Green Leaf Niseko Village', 'village', 4, 8.5, 32000, 'JPY', 3, 0.3, 'у гондолы'),
  hotel('niseko-ki', 'niseko', 'Ki Niseko', 'hirafu', 4, 8.9, 38000, 'JPY', 4, 0.25, 'апартаменты в Hirafu'),

  // Хакуба
  hotel('hak-tokyu', 'hakuba', 'Hakuba Tokyu Hotel', 'happo', 4, 8.4, 24000, 'JPY', 3, 0.7, 'онсэн и сад'),
  hotel('hak-sierra', 'hakuba', 'Sierra Resort Hakuba', 'iwatake', 4, 8.3, 21000, 'JPY', 4, 1.2, 'большой онсэн'),
  hotel('hak-phoenix', 'hakuba', 'Phoenix Hotel', 'happo', 3, 8.6, 18000, 'JPY', 3, 0.35, 'апарт-отель у Happo'),

  // Гудаури
  hotel('gud-lodge', 'gudauri', 'Gudauri Lodge', 'sadzele', 4, 8.6, 310, 'GEL', 3, 0.2, 'ski-in/ski-out, спа'),
  hotel('gud-marcopolo', 'gudauri', 'Marco Polo Hotel', 'sadzele', 4, 8.3, 250, 'GEL', 3, 0.4, 'у подъёмника'),
  hotel('gud-aura', 'gudauri', 'Good Aura', 'kobi', 3, 8.0, 180, 'GEL', 2, 0.9, 'бюджетный вариант'),

  // Местиа
  hotel('mes-plaza', 'mestia', 'Svaneti Plaza', 'hatsvali', 3, 8.2, 190, 'GEL', 3, 0.6, 'центр Местиа'),
  hotel('mes-posta', 'mestia', 'Hotel Posta', 'hatsvali', 3, 8.5, 230, 'GEL', 3, 0.4, 'гостеприимные хозяева'),
  hotel('mes-banguriani', 'mestia', 'Banguriani', 'tetnuldi', 4, 8.4, 280, 'GEL', 3, 8.0, 'у дороги на Тетнулди'),

  // Красное Озеро
  hotel('ko-spa', 'krasnoe-ozero', 'Красное озеро', 'main', 4, 8.5, 11000, 'RUB', 3, 0.3, 'спа-отель у склона'),
  hotel('ko-rayvola', 'krasnoe-ozero', 'Райвола', 'main', 3, 8.0, 7800, 'RUB', 3, 0.9, 'тихий лесной отель'),
  hotel('ko-berth', 'krasnoe-ozero', 'Берлога', 'belt', 3, 7.7, 6200, 'RUB', 4, 1.3, 'коттеджи с сауной'),

  // Туутари Парк
  hotel('tuu-park', 'tuutari', 'Туутари Парк', 'main', 4, 8.3, 9500, 'RUB', 3, 0.1, 'у подъёмников'),
  hotel('tuu-igo', 'tuutari', 'Игора', 'main', 4, 8.6, 13500, 'RUB', 3, 6.5, 'курорт с бассейном'),
  hotel('tuu-rayvola', 'tuutari', 'Райвола', 'training', 3, 7.9, 7200, 'RUB', 3, 1.0, 'рядом с учебным склоном'),

  // Майрхофен
  hotel('may-strass', 'mayrhofen', 'Sporthotel Strass', 'penken', 4, 8.8, 190, 'EUR', 3, 0.15, 'у Пенкенбана'),
  hotel('may-neuepost', 'mayrhofen', 'Hotel Neue Post', 'penken', 4, 8.7, 210, 'EUR', 3, 0.25, 'центр, спа'),
  hotel('may-alpenland', 'mayrhofen', 'Alpenland', 'ahorn', 3, 8.4, 150, 'EUR', 4, 0.8, 'апартаменты у Ахорна'),
]

export function hotelsFor(resortId: string, zoneId?: string): HotelOffer[] {
  return hotelCatalog.filter(
    (offer) => offer.resortId === resortId && (!zoneId || offer.zoneId === zoneId),
  )
}

/** Координаты отеля: смещение от нижней станции зоны на заданное расстояние. */
export function hotelOfferCoords(offer: HotelOffer): Coords | null {
  const resort = findResort(offer.resortId)
  const guide = guideFor(offer.resortId)
  const zone = guide?.zones.find((item) => item.id === offer.zoneId) ?? guide?.zones[0]
  const base = zone?.base ?? (resort ? { lat: resort.lat, lng: resort.lng } : null)
  if (!base) return null
  let hash = 2166136261
  for (let index = 0; index < offer.id.length; index += 1) {
    hash ^= offer.id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const seed = Math.abs(hash)
  const angle = ((seed % 360) * Math.PI) / 180
  const km = Math.max(0.05, offer.liftKm)
  const lat = base.lat + (km / 111) * Math.cos(angle)
  const lng =
    base.lng +
    (km / (111 * Math.cos((base.lat * Math.PI) / 180) || 1)) * Math.sin(angle)
  return { lat, lng }
}
