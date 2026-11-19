import type { ActivityKind } from '@/types'
import type { GuideCurrency } from '@/data/resort-guides'

export interface ActivityIdea {
  id: string
  resortId: string
  title: string
  kind: ActivityKind
  placeName: string
  address?: string
  durationHours: number
  priceFrom: number
  currency: GuideCurrency
  description: string
  /** цена ориентировочная, не оффер */
  confidence: 'estimate'
}

const idea = (
  id: string,
  resortId: string,
  title: string,
  kind: ActivityKind,
  placeName: string,
  durationHours: number,
  priceFrom: number,
  currency: GuideCurrency,
  description: string,
  address?: string,
): ActivityIdea => ({
  id,
  resortId,
  title,
  kind,
  placeName,
  address,
  durationHours,
  priceFrom,
  currency,
  description,
  confidence: 'estimate',
})

export const activityIdeas: ActivityIdea[] = [
  idea('niseko-onsen', 'niseko', 'Онсэн после катания', 'spa', 'Yukichichibu Onsen', 2, 1000, 'JPY', 'Открытые ванны с видом на горы; полотенце можно взять на месте.', 'Niseko, Hokkaido'),
  idea('niseko-snowmobile', 'niseko', 'Снегоход по целине', 'ride', 'Niseko Snowmobile Tour', 3, 14000, 'JPY', 'Гид ведёт по лесным трассам; нужны права категории или инструктаж.', 'Niseko, Hokkaido'),
  idea('hakuba-monkey', 'hakuba', 'Снежные обезьяны Дзигокудани', 'excursion', 'Jigokudani Monkey Park', 4, 800, 'JPY', 'Парк с горячими источниками и японскими макаками; ехать около 50 минут.', 'Yamanouchi, Nagano'),
  idea('hakuba-onsen', 'hakuba', 'Онсэн в Хакубе', 'spa', 'Happo Onsen', 2, 1000, 'JPY', 'Простой общественный онсэн рядом с Happo-One; работает до вечера.', 'Hakuba, Nagano'),
  idea('kp-skypark', 'krasnaya-polyana', 'Скайпарк и подвесной мост', 'ride', 'Skypark AJ Hackett Sochi', 3, 3000, 'RUB', 'Мост и роуп-джампинг над ущельем; бронируйте слот заранее.', 'Ачишховская, Красная Поляна'),
  idea('kp-spa', 'krasnaya-polyana', 'Спа-день в горах', 'spa', 'Спа-центр курорта', 3, 4500, 'RUB', 'Бассейн, сауны и массаж после катания; уточняйте расписание.', 'Красная Поляна'),
  idea('rosa-panorama', 'rosa-khutor', 'Панорама 2320', 'excursion', 'Роза Пик', 2, 1500, 'RUB', 'Подъём на вершину и смотровая площадка; одевайтесь теплее.', 'Роза Хутор'),
  idea('rosa-spa', 'rosa-khutor', 'Спа Rosa Springs', 'spa', 'Rosa Springs', 3, 5000, 'RUB', 'Термальный комплекс с бассейном и саунами у подъёмников.', 'Роза Хутор'),
  idea('sher-husky', 'sheregesh', 'Хаски-питомник', 'ride', 'Питомник хаски', 2, 2500, 'RUB', 'Катание в упряжке и общение с собаками; зависит от снега.', 'Шерегеш'),
  idea('sher-banya', 'sheregesh', 'Баня после склона', 'spa', 'Банный комплекс', 2, 2000, 'RUB', 'Русская баня и купель; лучше бронировать вечером заранее.', 'Шерегеш'),
  idea('domb-cable', 'dombay', 'Канатная дорога на Домбай', 'excursion', 'Домбайская поляна', 2, 1500, 'RUB', 'Подъём к смотровым площадкам; в ветер очередь может стоять.', 'Домбай'),
  idea('domb-narzan', 'dombay', 'Нарзаны и ущелье', 'excursion', 'Нарзанная поляна', 3, 2500, 'RUB', 'Прогулка к источникам с гидом; нужна непромокаемая обувь.', 'Домбай'),
  idea('elbr-azau', 'elbrus', 'Спа в Азау', 'spa', 'Спа-центр Азау', 2, 3000, 'RUB', 'Бассейн и сауна у нижней станции; после высоты — без нагрузок.', 'Приэльбрусье'),
  idea('elbr-cheget', 'elbrus', 'День на Чегете', 'ride', 'Чегет', 4, 2000, 'RUB', 'Свободное катание и виды на Эльбрус; лавинную обстановку проверяйте утром.', 'Приэльбрусье'),
  idea('ark-spa', 'arkhyz', 'Спа Романтик', 'spa', 'Романтик', 3, 3500, 'RUB', 'Бассейн и сауны рядом с подъёмником; есть детская зона.', 'Архыз'),
  idea('ark-waterfalls', 'arkhyz', 'Софийские водопады', 'excursion', 'Софийские водопады', 5, 3500, 'RUB', 'Внедорожная экскурсия к водопадам; уточняйте проходимость дороги.', 'Архыз'),
  idea('kir-husky', 'kirovsk', 'Хаски в Хибинах', 'ride', 'Хаски-парк', 2, 3000, 'RUB', 'Упряжки по зимнему лесу; одежда по погоде, часто ветрено.', 'Кировск'),
  idea('kir-museum', 'kirovsk', 'Музей и минералы Хибин', 'excursion', 'Музейно-выставочный центр', 2, 700, 'RUB', 'Коллекция минералов и история освоения Хибин; вариант на плохую погоду.', 'Кировск'),
  idea('manz-cable', 'manzherok', 'Канатная дорога на Синюху', 'excursion', 'Гора Синюха', 2, 1200, 'RUB', 'Подъём и смотровая площадка; зимой работает по погоде.', 'Манжерок'),
  idea('manz-biryuza', 'manzherok', 'Бирюзовая Катунь', 'excursion', 'Бирюзовая Катунь', 3, 800, 'RUB', 'Прогулка по берегу и фотозоны; зимой часть объектов закрыта.', 'Алтай'),
  idea('gud-paraglide', 'gudauri', 'Параплан над Гудаури', 'ride', 'Gudauri paragliding', 2, 250, 'GEL', 'Полёт с инструктором; зависит от ветра и видимости.', 'Гудаури'),
  idea('gud-kazbegi', 'gudauri', 'Казбеги и Гергети', 'excursion', 'Гергети', 5, 180, 'GEL', 'Джип-тур к церкви Гергети и Крестовому перевалу; дорога зимой сложная.', 'Казбеги'),
  idea('mes-towers', 'mestia', 'Сванские башни', 'excursion', 'Местиа', 3, 100, 'GEL', 'Прогулка по старому Местиа и башням; музей Маргиани по расписанию.', 'Местиа'),
  idea('mes-hatsvali', 'mestia', 'Хацвали и Тетнулди', 'ride', 'Хацвали', 4, 150, 'GEL', 'Катание и виды на Тетнулди; проверяйте работу подъёмников.', 'Местиа'),
  idea('may-penken', 'mayrhofen', 'Penken парк', 'ride', 'Penken Park', 4, 0, 'EUR', 'Сноупарк с линиями разной сложности; вход по скипассу.', 'Майрхофен'),
  idea('may-ahorn', 'mayrhofen', 'Прогулка на Ахорн', 'excursion', 'Ahorn', 3, 0, 'EUR', 'Подъём на Ахорн и смотровые тропы; часть маршрутов закрыта зимой.', 'Майрхофен'),
  idea('tuu-spa', 'tuutari', 'Спа после склона', 'spa', 'Туутари Парк', 2, 3500, 'RUB', 'Сауны и бассейн рядом с подъёмниками; удобно после вечернего катания.', 'Туутари'),
  idea('tuu-husky', 'tuutari', 'Хаски-прогулка', 'ride', 'Хаски-парк', 2, 2600, 'RUB', 'Короткая упряжка по лесу; подходит для семей.', 'Ленинградская область'),
  idea('ko-banya', 'krasnoe-ozero', 'Баня у озера', 'spa', 'Красное озеро', 2, 2500, 'RUB', 'Баня и купель; бронируйте заранее на вечер.', 'Приозерский район'),
  idea('ko-igora', 'krasnoe-ozero', 'Спа Игора', 'spa', 'Игора', 3, 4500, 'RUB', 'Большой спа-комплекс и бассейн; ехать на машине.', 'Ленинградская область'),
]

export function activityIdeasFor(resortId: string): ActivityIdea[] {
  return activityIdeas.filter((item) => item.resortId === resortId)
}
