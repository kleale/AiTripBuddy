export interface Resort {
  id: string
  name: string
  country: string
  region: string
  lat: number
  lng: number
}

export const resorts: Resort[] = [
  // Россия
  { id: 'krasnaya-polyana', name: 'Красная Поляна', country: 'Россия', region: 'Сочи', lat: 43.6783, lng: 40.2049 },
  { id: 'sheregesh', name: 'Шерегеш', country: 'Россия', region: 'Кемеровская обл.', lat: 52.905, lng: 88.03 },
  { id: 'dombay', name: 'Домбай', country: 'Россия', region: 'Карачаево-Черкесия', lat: 43.291, lng: 41.621 },
  { id: 'elbrus', name: 'Приэльбрусье', country: 'Россия', region: 'Кабардино-Балкария', lat: 43.245, lng: 42.5 },
  { id: 'arkhyz', name: 'Архыз', country: 'Россия', region: 'Карачаево-Черкесия', lat: 43.56, lng: 41.28 },
  { id: 'kirovsk', name: 'Кировск (Хибины)', country: 'Россия', region: 'Мурманская обл.', lat: 67.615, lng: 33.67 },
  { id: 'abzakovo', name: 'Абзаково', country: 'Россия', region: 'Башкортостан', lat: 53.83, lng: 58.96 },
  { id: 'solnechnaya-dolina', name: 'Солнечная долина', country: 'Россия', region: 'Челябинская обл.', lat: 55.02, lng: 60.16 },
  { id: 'belokurikha', name: 'Белокуриха', country: 'Россия', region: 'Алтайский край', lat: 51.99, lng: 84.98 },
  { id: 'baikalsk', name: 'Байкальск', country: 'Россия', region: 'Иркутская обл.', lat: 51.52, lng: 104.15 },
  // Кавказ и Закавказье
  { id: 'gudauri', name: 'Гудаури', country: 'Грузия', region: 'Мцхета-Мтианети', lat: 42.477, lng: 44.476 },
  { id: 'bakuriani', name: 'Бакуриани', country: 'Грузия', region: 'Самцхе-Джавахети', lat: 41.752, lng: 43.533 },
  { id: 'goderzi', name: 'Годердзи', country: 'Грузия', region: 'Аджария', lat: 41.63, lng: 42.51 },
  { id: 'mestia', name: 'Местиа', country: 'Грузия', region: 'Сванетия', lat: 43.045, lng: 42.73 },
  { id: 'tsakhkadzor', name: 'Цахкадзор', country: 'Армения', region: 'Котайк', lat: 40.53, lng: 44.69 },
  // Центральная Азия
  { id: 'shymbulak', name: 'Шымбулак', country: 'Казахстан', region: 'Алматы', lat: 43.128, lng: 77.082 },
  { id: 'karakol', name: 'Каракол', country: 'Кыргызстан', region: 'Иссык-Куль', lat: 42.49, lng: 78.39 },
  { id: 'chimgan', name: 'Чимган', country: 'Узбекистан', region: 'Ташкентская обл.', lat: 41.56, lng: 70.02 },
  // Турция
  { id: 'palandoken', name: 'Паландокен', country: 'Турция', region: 'Эрзурум', lat: 39.87, lng: 41.3 },
  { id: 'kartalkaya', name: 'Карталкая', country: 'Турция', region: 'Болу', lat: 40.51, lng: 31.75 },
  { id: 'uludag', name: 'Улудаг', country: 'Турция', region: 'Бурса', lat: 40.1, lng: 29.15 },
  { id: 'sarikamis', name: 'Сарыкамыш', country: 'Турция', region: 'Карс', lat: 40.33, lng: 42.57 },
  // Франция
  { id: 'chamonix', name: 'Шамони', country: 'Франция', region: 'Верхняя Савойя', lat: 45.9237, lng: 6.8694 },
  { id: 'val-thorens', name: 'Валь-Торанс', country: 'Франция', region: 'Савойя', lat: 45.298, lng: 6.58 },
  { id: 'les-deux-alpes', name: 'Ле-Дез-Альп', country: 'Франция', region: 'Изер', lat: 45.02, lng: 6.12 },
  { id: 'tignes', name: 'Тинь', country: 'Франция', region: 'Савойя', lat: 45.468, lng: 6.906 },
  { id: 'val-disere', name: 'Валь-д\'Изер', country: 'Франция', region: 'Савойя', lat: 45.448, lng: 6.98 },
  { id: 'les-arcs', name: 'Лез-Арк', country: 'Франция', region: 'Савойя', lat: 45.57, lng: 6.78 },
  { id: 'la-plagne', name: 'Ла-Плань', country: 'Франция', region: 'Савойя', lat: 45.5, lng: 6.68 },
  { id: 'meribel', name: 'Мерибель', country: 'Франция', region: 'Савойя', lat: 45.396, lng: 6.565 },
  { id: 'courchevel', name: 'Куршевель', country: 'Франция', region: 'Савойя', lat: 45.415, lng: 6.635 },
  { id: 'grand-massif', name: 'Гранд-Масс', country: 'Франция', region: 'Верхняя Савойя', lat: 45.06, lng: 6.11 },
  { id: 'les-menuires', name: 'Ле-Менюир', country: 'Франция', region: 'Савойя', lat: 45.07, lng: 6.52 },
  { id: 'alpe-dhuez', name: 'Альп-д\'Юэз', country: 'Франция', region: 'Изер', lat: 45.09, lng: 6.07 },
  { id: 'serre-chevalier', name: 'Серр-Шевалье', country: 'Франция', region: 'Верхние Альпы', lat: 44.95, lng: 6.49 },
  { id: 'morzine', name: 'Морзин', country: 'Франция', region: 'Верхняя Савойя', lat: 46.37, lng: 6.7 },
  { id: 'avoriaz', name: 'Аворьяз', country: 'Франция', region: 'Верхняя Савойя', lat: 46.26, lng: 6.79 },
  // Швейцария
  { id: 'zermatt', name: 'Церматт', country: 'Швейцария', region: 'Вале', lat: 46.0207, lng: 7.7491 },
  { id: 'verbier', name: 'Вербье', country: 'Швейцария', region: 'Вале', lat: 46.096, lng: 7.228 },
  { id: 'davos', name: 'Давос', country: 'Швейцария', region: 'Граубюнден', lat: 46.802, lng: 9.836 },
  { id: 'st-moritz', name: 'Санкт-Мориц', country: 'Швейцария', region: 'Граубюнден', lat: 46.4908, lng: 9.8355 },
  { id: 'grindelwald', name: 'Гриндельвальд', country: 'Швейцария', region: 'Берн', lat: 46.624, lng: 8.041 },
  { id: 'villars', name: 'Виллар', country: 'Швейцария', region: 'Во', lat: 46.3, lng: 7.06 },
  // Австрия
  { id: 'ischgl', name: 'Ишгль', country: 'Австрия', region: 'Тироль', lat: 47.015, lng: 10.288 },
  { id: 'solden', name: 'Зёльден', country: 'Австрия', region: 'Тироль', lat: 46.967, lng: 11.007 },
  { id: 'st-anton', name: 'Санкт-Антон', country: 'Австрия', region: 'Тироль', lat: 47.129, lng: 10.266 },
  { id: 'mayrhofen', name: 'Майрхофен', country: 'Австрия', region: 'Тироль', lat: 47.167, lng: 11.864 },
  { id: 'kitzbuhel', name: 'Китцбюэль', country: 'Австрия', region: 'Тироль', lat: 47.446, lng: 12.392 },
  { id: 'schladming', name: 'Шладминг', country: 'Австрия', region: 'Штирия', lat: 47.394, lng: 13.687 },
  { id: 'saalbach', name: 'Зальбах-Хинтерглемм', country: 'Австрия', region: 'Зальцбург', lat: 47.427, lng: 12.736 },
  { id: 'hintertux', name: 'Хинтертукс', country: 'Австрия', region: 'Тироль', lat: 47.2, lng: 11.98 },
  { id: 'bad-gastein', name: 'Бад-Гаштайн', country: 'Австрия', region: 'Зальцбург', lat: 47.115, lng: 13.137 },
  { id: 'zell-am-see', name: 'Целль-ам-Зе', country: 'Австрия', region: 'Зальцбург', lat: 47.323, lng: 12.796 },
  // Италия
  { id: 'cortina', name: 'Кортина-д\'Ампеццо', country: 'Италия', region: 'Венето', lat: 46.5405, lng: 12.1357 },
  { id: 'val-gardena', name: 'Валь-Гардена', country: 'Италия', region: 'Больцано', lat: 46.57, lng: 11.76 },
  { id: 'livigno', name: 'Ливиньо', country: 'Италия', region: 'Ломбардия', lat: 46.538, lng: 10.136 },
  { id: 'bormio', name: 'Бормио', country: 'Италия', region: 'Ломбардия', lat: 46.467, lng: 10.37 },
  { id: 'sestriere', name: 'Сестриере', country: 'Италия', region: 'Пьемонт', lat: 44.96, lng: 6.94 },
  { id: 'madonna', name: 'Мадонна-ди-Кампильо', country: 'Италия', region: 'Трентино', lat: 46.23, lng: 10.826 },
  { id: 'cervinia', name: 'Червиния', country: 'Италия', region: 'Валле-д\'Аоста', lat: 45.876, lng: 7.627 },
  { id: 'alta-badia', name: 'Альта-Бадия', country: 'Италия', region: 'Больцано', lat: 46.55, lng: 11.87 },
  { id: 'val-di-fassa', name: 'Валь-ди-Фасса', country: 'Италия', region: 'Трентино', lat: 46.43, lng: 11.71 },
  { id: 'aprica', name: 'Априка', country: 'Италия', region: 'Ломбардия', lat: 46.15, lng: 10.14 },
  // Андорра и Испания
  { id: 'grandvalira', name: 'Грандвалира', country: 'Андорра', region: 'Андорра', lat: 42.56, lng: 1.58 },
  { id: 'pal-arinsal', name: 'Па-де-Каза', country: 'Андорра', region: 'Андорра', lat: 42.54, lng: 1.47 },
  { id: 'baqueira', name: 'Бакерия-Берет', country: 'Испания', region: 'Каталония', lat: 42.7, lng: 0.9 },
  { id: 'sierra-nevada', name: 'Сьерра-Невада', country: 'Испания', region: 'Андалусия', lat: 37.09, lng: -3.39 },
  { id: 'formigal', name: 'Формигаль', country: 'Испания', region: 'Арагон', lat: 42.66, lng: 0.5 },
  // Балканы
  { id: 'bansko', name: 'Банско', country: 'Болгария', region: 'Благоевград', lat: 41.83, lng: 23.48 },
  { id: 'borovets', name: 'Боровец', country: 'Болгария', region: 'София', lat: 42.27, lng: 23.61 },
  { id: 'pamporovo', name: 'Пампорово', country: 'Болгария', region: 'Смолян', lat: 41.64, lng: 24.69 },
  { id: 'jasna', name: 'Ясна', country: 'Словакия', region: 'Низкие Татры', lat: 49.07, lng: 19.34 },
  { id: 'strbske-pleso', name: 'Штрбске-Плесо', country: 'Словакия', region: 'Высокие Татры', lat: 49.12, lng: 20.08 },
  { id: 'kranska-gora', name: 'Краньска-Гора', country: 'Словения', region: 'Гореньска', lat: 46.48, lng: 13.78 },
  { id: 'bovec', name: 'Бовец', country: 'Словения', region: 'Горишка', lat: 46.34, lng: 13.55 },
  { id: 'zakopane', name: 'Закопане', country: 'Польша', region: 'Малопольша', lat: 49.29, lng: 19.95 },
  // Скандинавия
  { id: 'hemsedal', name: 'Хемседал', country: 'Норвегия', region: 'Викен', lat: 60.86, lng: 8.55 },
  { id: 'trysil', name: 'Трюсиль', country: 'Норвегия', region: 'Иннландет', lat: 61.31, lng: 12.27 },
  { id: 'oppdal', name: 'Оппдал', country: 'Норвегия', region: 'Трёнделаг', lat: 62.59, lng: 9.7 },
  { id: 'are', name: 'Оре', country: 'Швеция', region: 'Емтланд', lat: 63.4, lng: 13.08 },
  { id: 'salen', name: 'Селен', country: 'Швеция', region: 'Даларна', lat: 61.15, lng: 12.83 },
  { id: 'levi', name: 'Леви', country: 'Финляндия', region: 'Лапландия', lat: 67.8, lng: 24.85 },
  { id: 'ruka', name: 'Рука', country: 'Финляндия', region: 'Кайнуу', lat: 66.16, lng: 29.15 },
  { id: 'yllas', name: 'Юлляс', country: 'Финляндия', region: 'Лапландия', lat: 68.25, lng: 23.83 },
  // Азия и Америка
  { id: 'niseko', name: 'Нисеко', country: 'Япония', region: 'Хоккайдо', lat: 42.86, lng: 140.7 },
  { id: 'hakuba', name: 'Хакуба', country: 'Япония', region: 'Нагано', lat: 36.7, lng: 137.85 },
  { id: 'nozawa', name: 'Нодзава-Онсэн', country: 'Япония', region: 'Нагано', lat: 36.92, lng: 138.63 },
  { id: 'yongpyong', name: 'Ёнпхён', country: 'Южная Корея', region: 'Канвондо', lat: 37.65, lng: 128.68 },
  { id: 'vail', name: 'Вейл', country: 'США', region: 'Колорадо', lat: 39.64, lng: -106.37 },
  { id: 'aspen', name: 'Аспен', country: 'США', region: 'Колорадо', lat: 39.19, lng: -106.82 },
  { id: 'park-city', name: 'Парк-Сити', country: 'США', region: 'Юта', lat: 40.65, lng: -111.5 },
  { id: 'jackson-hole', name: 'Джексон-Хоул', country: 'США', region: 'Вайоминг', lat: 43.59, lng: -110.83 },
  { id: 'mammoth', name: 'Маммот', country: 'США', region: 'Калифорния', lat: 37.63, lng: -119.03 },
  { id: 'snowbird', name: 'Сноубирд', country: 'США', region: 'Юта', lat: 40.58, lng: -111.65 },
  { id: 'whistler', name: 'Уистлер', country: 'Канада', region: 'Британская Колумбия', lat: 50.12, lng: -122.95 },
  { id: 'banff', name: 'Банф (Саншайн)', country: 'Канада', region: 'Альберта', lat: 51.1, lng: -115.76 },
  { id: 'mont-tremblant', name: 'Мон-Тремблан', country: 'Канада', region: 'Квебек', lat: 46.21, lng: -74.59 },
]

export function findResort(id: string): Resort | undefined {
  return resorts.find((r) => r.id === id)
}
