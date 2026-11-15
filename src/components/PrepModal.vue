<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DisciplineMix, PrepPlan } from '@/types'
import {
  applicableChecklist,
  avalancheKitReady,
  brandCategories,
  brandsFor,
  budgetSections,
  checklistProgress,
  needsAvalancheKit,
  type BrandCategory,
} from '@/data/gear'
import {
  flexAdvice,
  googleSearchUrl,
  normalizeMix,
  skiRange,
  skiWaist,
  snowboardRange,
} from '@/lib/gear-fit'
import {
  gearKindLabels,
  gearKinds,
  ownershipLabels,
  ownershipOptions,
  skillLevels,
} from '@/lib/prep'
import {
  closePrepEditor,
  patchPrep,
  prepEditorOpen,
  resetPrepChecklist,
  togglePrepItem,
  trip,
} from '@/stores/trip'
import GearFitDiagram from '@/components/GearFitDiagram.vue'
import NumberField from '@/components/NumberField.vue'

type Tab = 'profile' | 'fit' | 'checklist' | 'brands' | 'budget'

const tab = ref<Tab>('profile')
const fitKind = ref<'snowboard' | 'ski'>('snowboard')
const brandTab = ref<BrandCategory>('snowboard')

const prep = computed<PrepPlan | null>(() => trip.value?.prep ?? null)
const levelLabel = computed(() => skillLevels.find((item) => item.id === prep.value?.level)?.label.toLowerCase() ?? '')
const mix = computed<DisciplineMix>(() => prep.value?.mix ?? { trail: 60, freeride: 20, park: 20 })
const progress = computed(() =>
  prep.value ? checklistProgress(prep.value) : { done: 0, total: 0, percent: 0 },
)
const groups = computed(() =>
  prep.value ? applicableChecklist(prep.value.mix, prep.value.ownership) : [],
)
const avalancheReady = computed(() => (prep.value ? avalancheKitReady(prep.value.checklist) : false))
const freerideBlocked = computed(
  () => needsAvalancheKit(mix.value) && !(prep.value?.avalancheAck ?? false) && !avalancheReady.value,
)

const boardRange = computed(() =>
  prep.value
    ? snowboardRange(prep.value.heightCm, prep.value.weightKg, prep.value.mix, prep.value.level)
    : snowboardRange(175, 75, mix.value, 'beginner'),
)
const skiLength = computed(() =>
  prep.value
    ? skiRange(prep.value.heightCm, prep.value.weightKg, prep.value.mix, prep.value.level)
    : skiRange(175, 75, mix.value, 'beginner'),
)
const waist = computed(() => skiWaist(mix.value))
const fit = computed(() => (fitKind.value === 'ski' ? skiLength.value : boardRange.value))
const advice = computed(() =>
  flexAdvice(fitKind.value, prep.value?.level ?? 'beginner', mix.value, prep.value?.weightKg ?? 75),
)

const brandList = computed(() => brandsFor(brandTab.value))

const mixParts = computed(() => [
  { id: 'trail' as const, label: 'Трасса', value: mix.value.trail, color: '#34d399' },
  { id: 'freeride' as const, label: 'Фрирайд', value: mix.value.freeride, color: '#38bdf8' },
  { id: 'park' as const, label: 'Парк', value: mix.value.park, color: '#fbbf24' },
])

const brandGuides: Record<BrandCategory, string[]> = {
  snowboard: [
    'Длина — по росту, весу и стилю: трасса и фрирайд длиннее, парк короче.',
    'Ширина доски: при ботинке 45+ берите wide, иначе пятка и нос будут цеплять снег.',
    'Жёсткость: новичку мягче, эксперту и фрирайдеру жёстче для контроля.',
    'Форма: rocker/camber — от условий; для универсала смотрите гибрид.',
  ],
  ski: [
    'Длина: рост минус 5–15 см; фрирайд длиннее, парк короче.',
    'Талия 78–88 мм — трасса, 95–110 мм — фрирайд, 84–94 мм — парк.',
    'Радиус: меньше — короткие повороты, больше — стабильность на скорости.',
    'Жёсткость лыжи должна совпадать с весом и уровнем райдера.',
  ],
  boots: [
    'Меряйте на тонкий носок, пятка не должна гулять.',
    'Жёсткость ботинка — под жёсткость доски/лыжи и уровень.',
    'У сноуборда важна колодка и шнуровка, у лыж — last и flex.',
    'Прокатные ботинки мойте и сушите, свои — подбирайте индивидуально.',
  ],
  bindings: [
    'Крепления подбираются по ширине доски и размеру ботинка.',
    'Жёсткость креплений — под жёсткость ботинка и стиль.',
    'DIN на лыжах выставляйте по весу и уровню, лучше в сервисе.',
    'Проверяйте крепления перед каждым выездом.',
  ],
  poles: [
    'Длина палки: рост минус 50 см для трассы, для фрирайда чуть длиннее.',
    'Карбон легче, алюминий прочнее и дешевле.',
    'Телескопы удобны для фрирайда и ски-тура.',
    'Проверяйте темляки и наконечники.',
  ],
  clothing: [
    'Мембрана 10 000/10 000 — базовый уровень для снега.',
    'Термобельё — синтетика или меринос, не хлопок.',
    'В РФ смотрите Bask, Red Fox, Splav, Nordski, Decathlon Wedze.',
    'Яркая куртка повышает заметность на склоне.',
  ],
}

function setLevel(level: PrepPlan['level']): void {
  patchPrep({ level })
}

function setMix(key: keyof DisciplineMix, event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  patchPrep({ mix: normalizeMix({ ...mix.value, [key]: value }) })
}

function setOwnership(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'own' || value === 'rent' || value === 'mix') patchPrep({ ownership: value })
}

function setEquipment(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'snowboard' || value === 'ski' || value === 'undecided') patchPrep({ equipment: value })
}

function setFitKind(kind: 'snowboard' | 'ski'): void {
  fitKind.value = kind
  if (prep.value?.equipment === 'undecided') patchPrep({ equipment: kind })
}

function setAck(event: Event): void {
  patchPrep({ avalancheAck: (event.target as HTMLInputElement).checked })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closePrepEditor()
}

watch(
  () => prep.value?.equipment,
  (equipment) => {
    if (equipment === 'snowboard' || equipment === 'ski') fitKind.value = equipment
  },
  { immediate: true },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="prep && prepEditorOpen" class="modal-backdrop" @click.self="closePrepEditor">
    <div class="modal prep-modal" role="dialog" aria-modal="true" aria-label="Подготовка к поездке">
      <div class="modal-head">
        <div>
          <div class="node-kicker">Подготовка к путешествию</div>
          <h3>Снаряжение, чек-лист и бюджет</h3>
        </div>
        <button type="button" class="node-remove" aria-label="Закрыть" @click="closePrepEditor">×</button>
      </div>

      <div class="prep-tabs">
        <button type="button" :class="{ active: tab === 'profile' }" @click="tab = 'profile'">Профиль</button>
        <button type="button" :class="{ active: tab === 'fit' }" @click="tab = 'fit'">Подбор</button>
        <button type="button" :class="{ active: tab === 'checklist' }" @click="tab = 'checklist'">
          Чек-лист <span>{{ progress.done }}/{{ progress.total }}</span>
        </button>
        <button type="button" :class="{ active: tab === 'brands' }" @click="tab = 'brands'">Бренды</button>
        <button type="button" :class="{ active: tab === 'budget' }" @click="tab = 'budget'">Бюджет</button>
      </div>

      <div class="prep-body">
        <!-- профиль -->
        <section v-if="tab === 'profile'" class="prep-pane">
          <p class="guide-text">
            Уровень и стиль влияют на длину снаряжения и жёсткость. Проценты всегда дают в сумме 100.
          </p>

          <div class="prep-levels">
            <button
              v-for="level in skillLevels"
              :key="level.id"
              type="button"
              class="prep-level"
              :class="{ active: prep.level === level.id }"
              @click="setLevel(level.id)"
            >
              <b>{{ level.label }}</b>
              <span>{{ level.note }}</span>
            </button>
          </div>

          <div class="prep-mix-summary">
            <div class="prep-mix-bar">
              <i v-for="part in mixParts" :key="part.id" :style="{ width: part.value + '%', background: part.color }" />
            </div>
            <div class="prep-mix-legend">
              <span v-for="part in mixParts" :key="part.id">
                <i :style="{ background: part.color }" />{{ part.label }} <b>{{ part.value }}%</b>
              </span>
            </div>
          </div>

          <label v-for="part in mixParts" :key="part.id" class="prep-slider">
            <span>{{ part.label }} <b>{{ part.value }}%</b></span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="part.value"
              @input="setMix(part.id, $event)"
            />
          </label>

          <div class="modal-grid">
            <label class="select-field">
              <span>Снаряжение</span>
              <select :value="prep.equipment" @change="setEquipment">
                <option v-for="kind in gearKinds" :key="kind.id" :value="kind.id">{{ kind.label }}</option>
              </select>
            </label>
            <label class="select-field">
              <span>Аренда или своё</span>
              <select :value="prep.ownership" @change="setOwnership">
                <option v-for="option in ownershipOptions" :key="option.id" :value="option.id">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="modal-grid prep-measures">
            <NumberField label="Рост" suffix="см" :model-value="prep.heightCm" @update:model-value="(v) => patchPrep({ heightCm: v })" />
            <NumberField label="Вес" suffix="кг" :model-value="prep.weightKg" @update:model-value="(v) => patchPrep({ weightKg: v })" />
            <NumberField label="Ботинок" suffix="EU" :model-value="prep.bootSize" @update:model-value="(v) => patchPrep({ bootSize: v })" />
          </div>

          <div v-if="freerideBlocked" class="prep-lock">
            <b>Фрирайд: сначала лавинный набор</b>
            <p>Бипер, щуп и лопата обязательны за пределами трасс. Советы по фрирайду скрыты, пока набор не собран.</p>
          </div>

          <div class="prep-actions">
            <button type="button" class="primary-btn" @click="tab = 'fit'">Подбор снаряжения →</button>
          </div>
        </section>

        <!-- подбор -->
        <section v-else-if="tab === 'fit'" class="prep-pane">
          <div class="prep-kind-switch">
            <button type="button" :class="{ active: fitKind === 'snowboard' }" @click="setFitKind('snowboard')">Сноуборд</button>
            <button type="button" :class="{ active: fitKind === 'ski' }" @click="setFitKind('ski')">Лыжи</button>
          </div>

          <div class="modal-grid prep-measures">
            <NumberField label="Рост" suffix="см" :model-value="prep.heightCm" @update:model-value="(v) => patchPrep({ heightCm: v })" />
            <NumberField label="Вес" suffix="кг" :model-value="prep.weightKg" @update:model-value="(v) => patchPrep({ weightKg: v })" />
          </div>
          <p class="guide-text prep-fit-hint">
            Уровень {{ levelLabel }} · стиль
            {{ mix.trail }}/{{ mix.freeride }}/{{ mix.park }}.
            <button type="button" class="link-btn" @click="tab = 'profile'">Изменить</button>
          </p>

          <GearFitDiagram
            :kind="fitKind"
            :height-cm="prep.heightCm"
            :min="fit.min"
            :max="fit.max"
            :center="fit.center"
          />

          <div class="prep-fit-cards">
            <div class="prep-fit-card">
              <span>Длина</span>
              <b>{{ fit.min }}–{{ fit.max }} см</b>
              <small>{{ fitKind === 'ski' ? 'лыжи' : 'доска' }} под рост {{ prep.heightCm }} и вес {{ prep.weightKg }}</small>
            </div>
            <div v-if="fitKind === 'ski'" class="prep-fit-card">
              <span>Талия</span>
              <b>{{ waist.min }}–{{ waist.max }} мм</b>
              <small>под стиль {{ mix.trail }}/{{ mix.freeride }}/{{ mix.park }}</small>
            </div>
            <div class="prep-fit-card">
              <span>Жёсткость</span>
              <b>{{ advice.score }}/10 · {{ advice.label }}</b>
              <small>ботинки {{ advice.bootFlex }}</small>
            </div>
          </div>

          <div class="prep-advice">
            <h4>Ботинки и крепления под жёсткость {{ advice.label }}</h4>
            <p>{{ advice.bindingNote }}</p>
            <div class="prep-example-grid">
              <div>
                <span>Ботинки</span>
                <a
                  v-for="item in advice.boots"
                  :key="item.label"
                  :href="googleSearchUrl(item.query)"
                  target="_blank"
                  rel="noopener"
                >
                  {{ item.label }} ↗
                </a>
              </div>
              <div>
                <span>Крепления</span>
                <a
                  v-for="item in advice.bindings"
                  :key="item.label"
                  :href="googleSearchUrl(item.query)"
                  target="_blank"
                  rel="noopener"
                >
                  {{ item.label }} ↗
                </a>
              </div>
            </div>
          </div>

          <div v-if="freerideBlocked" class="prep-lock">
            <b>Советы по фрирайду заблокированы</b>
            <p>Сначала соберите бипер, щуп и лопату. Без них за трассы не выходим.</p>
            <label class="prep-ack">
              <input type="checkbox" :checked="prep.avalancheAck" @change="setAck" />
              <span>Понимаю: фрирайд только с лавинным набором и гидом</span>
            </label>
          </div>
          <div v-else-if="mix.freeride > 0" class="prep-note">
            Для фрирайда добавьте в рюкзак бипер, щуп, лопату и рацию. Размер и жёсткость выше уже учитывают стиль.
          </div>

          <div class="prep-guide">
            <h4>Как выбрать</h4>
            <ul>
              <li v-for="line in brandGuides[fitKind === 'ski' ? 'ski' : 'snowboard']" :key="line">{{ line }}</li>
            </ul>
          </div>
        </section>

        <!-- чек-лист -->
        <section v-else-if="tab === 'checklist'" class="prep-pane">
          <div class="prep-progress-head">
            <div>
              <b>Собрано {{ progress.done }} из {{ progress.total }}</b>
              <span>{{ progress.percent }}%</span>
            </div>
            <button type="button" class="mini-btn" @click="resetPrepChecklist">Сбросить</button>
          </div>
          <div class="prep-progress"><i :style="{ width: progress.percent + '%' }" /></div>

          <div v-if="needsAvalancheKit(mix) && !avalancheReady" class="prep-lock">
            <b>Фрирайд без лавинного набора</b>
            <p>Пока не отмечены бипер, щуп и лопата, за пределы трасс не выходим.</p>
          </div>

          <div v-for="group in groups" :key="group.id" class="prep-group">
            <div class="prep-group-head">
              <h4>{{ group.title }}</h4>
              <span v-if="group.note">{{ group.note }}</span>
            </div>
            <label v-for="item in group.items" :key="item.id" class="prep-check">
              <input
                type="checkbox"
                :checked="Boolean(prep.checklist[item.id])"
                @change="togglePrepItem(item.id)"
              />
              <span>
                <b>{{ item.title }}</b>
                <small v-if="item.note">{{ item.note }}</small>
              </span>
            </label>
          </div>
        </section>

        <!-- бренды -->
        <section v-else-if="tab === 'brands'" class="prep-pane">
          <div class="prep-brand-tabs">
            <button
              v-for="category in brandCategories"
              :key="category.id"
              type="button"
              :class="{ active: brandTab === category.id }"
              @click="brandTab = category.id"
            >
              {{ category.label }}
            </button>
          </div>

          <div class="prep-guide">
            <h4>Как выбрать · {{ brandCategories.find((item) => item.id === brandTab)?.label }}</h4>
            <ul>
              <li v-for="line in brandGuides[brandTab]" :key="line">{{ line }}</li>
            </ul>
          </div>

          <div class="prep-brand-grid">
            <article v-for="brand in brandList" :key="brand.id" class="prep-brand">
              <b>{{ brand.name }}</b>
              <p>{{ brand.note }}</p>
              <span>{{ brand.price }}</span>
              <a :href="googleSearchUrl(brand.query)" target="_blank" rel="noopener">Найти в Google ↗</a>
            </article>
          </div>

          <p class="guide-text passport-note">
            Цены ориентировочные для РФ на сезон 2026/27. Проверяйте наличие и размеры перед покупкой.
          </p>
        </section>

        <!-- бюджет -->
        <section v-else class="prep-pane">
          <p class="guide-text">
            Ориентиры по РФ: аренда на 6 дней, покупка комплекта и одежда. Точные цены зависят от региона и сезона.
          </p>
          <div v-for="section in budgetSections" :key="section.id" class="prep-budget-section">
            <div class="prep-budget-head">
              <h4>{{ section.title }}</h4>
              <span>{{ section.note }}</span>
            </div>
            <div class="prep-budget-grid">
              <article v-for="tier in section.tiers" :key="tier.id" class="prep-budget">
                <b>{{ tier.title }}</b>
                <small>{{ tier.note }}</small>
                <ul>
                  <li v-for="item in tier.items" :key="item.label">
                    <span>{{ item.label }}</span>
                    <em>{{ item.price }}</em>
                  </li>
                </ul>
                <strong>{{ tier.total }}</strong>
              </article>
            </div>
          </div>
          <p class="guide-text passport-note">
            Одежда в РФ: Decathlon Wedze, Nordway, Termit — бюджет; Splav, Red Fox, Nordski — середина; Bask,
            Columbia, The North Face — верхний сегмент.
          </p>
        </section>
      </div>

      <div class="modal-actions prep-footer">
        <span class="prep-footer-note">{{ gearKindLabels[prep.equipment] }} · {{ ownershipLabels[prep.ownership] }}</span>
        <button type="button" class="primary-btn" @click="closePrepEditor">Готово</button>
      </div>
    </div>
  </div>
</template>
