<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DisciplineMix, PrepPlan, StanceSetup, StyleMix } from '@/types'
import {
  applicableChecklist,
  avalancheKitReady,
  brandCategories,
  brandsByTier,
  brandsFor,
  budgetSections,
  checklistProgress,
  needsAvalancheKit,
  type BrandCategory,
} from '@/data/gear'
import {
  baseTypes,
  boardGuides,
  boardShapes,
  bindingSettings,
  bindingSizes,
  bindingStiffness,
  bindingStyleEffects,
  bootCare,
  bootLacing,
  bootLacingChoice,
  camberTypes,
  clothingLayers,
  constructionParts,
  discTypes,
  maintenanceSteps,
  membraneLevels,
  selectionLinks,
  servicePlaces,
  servicePrices,
  setupSteps,
  sidecutInfo,
  waxTypes,
  woodTypes,
  beginnerSetup,
} from '@/data/board-info'
import { proAthletesFor, type ProSport } from '@/data/pro-athletes'
import { partnerRegions, partnersFor, type PartnerRegion } from '@/data/partners'
import {
  flexAdvice,
  googleSearchUrl,
  normalizeMix,
  skiRange,
  skiWaist,
  snowboardRange,
  snowboardWaist,
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
import DisciplineSlider from '@/components/DisciplineSlider.vue'
import CamberDiagram from '@/components/CamberDiagram.vue'
import ShapeDiagram from '@/components/ShapeDiagram.vue'
import StanceDiagram from '@/components/StanceDiagram.vue'
import StyleSlider from '@/components/StyleSlider.vue'
import GearFitDiagram from '@/components/GearFitDiagram.vue'
import NumberField from '@/components/NumberField.vue'

type Tab = 'profile' | 'fit' | 'board' | 'clothing' | 'checklist' | 'brands' | 'pros' | 'partners' | 'budget'
type BoardTab =
  | 'stance'
  | 'camber'
  | 'shapes'
  | 'materials'
  | 'bindings'
  | 'boots'
  | 'care'
  | 'selection'
const boardTab = ref<BoardTab>('stance')
const boardTabs: { id: BoardTab; label: string }[] = [
  { id: 'stance', label: 'Стойка' },
  { id: 'camber', label: 'Прогибы' },
  { id: 'shapes', label: 'Формы' },
  { id: 'materials', label: 'Материалы' },
  { id: 'bindings', label: 'Крепления' },
  { id: 'boots', label: 'Ботинки' },
  { id: 'care', label: 'Уход' },
  { id: 'selection', label: 'Подбор' },
]

const tab = ref<Tab>('checklist')
const fitKind = ref<'snowboard' | 'ski'>('snowboard')
const brandTab = ref<BrandCategory>('snowboard')
const proSport = ref<'all' | ProSport>('all')
const partnerRegion = ref<PartnerRegion>('RU')
const partnerList = computed(() => partnersFor(partnerRegion.value))
const pros = computed(() => proAthletesFor(proSport.value))

const prep = computed<PrepPlan | null>(() => trip.value?.prep ?? null)
const levelLabel = computed(() => skillLevels.find((item) => item.id === prep.value?.level)?.label.toLowerCase() ?? '')
const mix = computed<DisciplineMix>(() => prep.value?.mix ?? { trail: 60, freeride: 20, park: 20 })
const progress = computed(() =>
  prep.value ? checklistProgress(prep.value) : { done: 0, total: 0, percent: 0 },
)
const groups = computed(() =>
  prep.value ? applicableChecklist(prep.value.mix, prep.value.ownership) : [],
)
const leftGroups = computed(() => groups.value.filter((group) => group.id !== 'extra'))
const extraGroups = computed(() => groups.value.filter((group) => group.id === 'extra'))
const avalancheReady = computed(() => (prep.value ? avalancheKitReady(prep.value.checklist) : false))
const freerideBlocked = computed(
  () => needsAvalancheKit(mix.value) && !(prep.value?.avalancheAck ?? false) && !avalancheReady.value,
)

const boardRange = computed(() =>
  prep.value
    ? snowboardRange(prep.value.heightCm, prep.value.weightKg, prep.value.mix, prep.value.level, prep.value.style)
    : snowboardRange(175, 75, mix.value, 'beginner'),
)
const skiLength = computed(() =>
  prep.value
    ? skiRange(prep.value.heightCm, prep.value.weightKg, prep.value.mix, prep.value.level, prep.value.style)
    : skiRange(175, 75, mix.value, 'beginner'),
)
const waist = computed(() => skiWaist(mix.value, prep.value?.style))
const boardWidth = computed(() => snowboardWaist(prep.value?.bootSize ?? 42, prep.value?.style))
const fit = computed(() => (fitKind.value === 'ski' ? skiLength.value : boardRange.value))
const advice = computed(() =>
  flexAdvice(fitKind.value, prep.value?.level ?? 'beginner', mix.value, prep.value?.weightKg ?? 75, prep.value?.style),
)

const brandList = computed(() => brandsFor(brandTab.value))
const styleRecord = computed<Record<string, number>>(() => ({
  ...(prep.value?.style ?? { carving: 40, freestyle: 20, freeride: 30, flat: 10 }),
}))
const styleParts = [
  { id: 'carving', label: 'Карвинг', color: '#f472b6' },
  { id: 'freestyle', label: 'Фристайл', color: '#a78bfa' },
  { id: 'freeride', label: 'Фрирайд', color: '#38bdf8' },
  { id: 'flat', label: 'Флэт', color: '#34d399' },
]
const brandGroups = computed(() =>
  brandTab.value === 'boots' || brandTab.value === 'clothing'
    ? brandsByTier(brandTab.value)
    : [{ tier: null, label: '', brands: brandList.value }],
)

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

function onDiscipline(value: DisciplineMix): void {
  patchPrep({ mix: value })
}

function onStyle(value: Record<string, number>): void {
  const style: StyleMix = {
    carving: value.carving ?? 0,
    freestyle: value.freestyle ?? 0,
    freeride: value.freeride ?? 0,
    flat: value.flat ?? 0,
  }
  patchPrep({ style })
}

function onStance(value: StanceSetup): void {
  patchPrep({ stance: value })
}

function applyBeginner(): void {
  patchPrep({
    level: 'beginner',
    mix: normalizeMix(beginnerSetup.mix),
    style: { ...beginnerSetup.style },
    stance: { ...beginnerSetup.stance },
  })
  tab.value = 'fit'
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
        <button type="button" :class="{ active: tab === 'checklist' }" @click="tab = 'checklist'">
          Чек-лист <span>{{ progress.done }}/{{ progress.total }}</span>
        </button>
        <button type="button" :class="{ active: tab === 'profile' }" @click="tab = 'profile'">Профиль</button>
        <button type="button" :class="{ active: tab === 'fit' }" @click="tab = 'fit'">Подбор</button>
        <button type="button" :class="{ active: tab === 'board' }" @click="tab = 'board'">Доска</button>
        <button type="button" :class="{ active: tab === 'clothing' }" @click="tab = 'clothing'">Одежда</button>
        <button type="button" :class="{ active: tab === 'brands' }" @click="tab = 'brands'">Бренды</button>
        <button type="button" :class="{ active: tab === 'pros' }" @click="tab = 'pros'">Райдеры</button>
        <button type="button" :class="{ active: tab === 'partners' }" @click="tab = 'partners'">Партнёры</button>
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

          <DisciplineSlider :model-value="mix" @update:model-value="onDiscipline" />
          <StyleSlider :model-value="styleRecord" :parts="styleParts" @update:model-value="onStyle" />
          <p class="guide-text prep-fit-hint">Стиль влияет на длину, ширину и жёсткость снаряжения.</p>

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
            <button type="button" class="mini-btn" @click="applyBeginner">Подобрать для новичка</button>
            <button type="button" class="primary-btn" @click="tab = 'fit'">Подбор снаряжения →</button>
          </div>
        </section>

        <!-- подбор -->
        <section v-else-if="tab === 'fit'" class="prep-pane">
          <div class="prep-fit-layout">
            <div class="prep-fit-main">
              <GearFitDiagram
                :kind="fitKind"
                :height-cm="prep.heightCm"
                :min="fit.min"
                :max="fit.max"
                :center="fit.center"
              />
            </div>

            <aside class="prep-fit-side">
              <div class="prep-kind-switch">
                <button type="button" :class="{ active: fitKind === 'snowboard' }" @click="setFitKind('snowboard')">Сноуборд</button>
                <button type="button" :class="{ active: fitKind === 'ski' }" @click="setFitKind('ski')">Лыжи</button>
              </div>

              <div class="modal-grid prep-measures">
                <NumberField label="Рост" suffix="см" :model-value="prep.heightCm" @update:model-value="(v) => patchPrep({ heightCm: v })" />
                <NumberField label="Вес" suffix="кг" :model-value="prep.weightKg" @update:model-value="(v) => patchPrep({ weightKg: v })" />
                <NumberField label="Ботинок" suffix="EU" :model-value="prep.bootSize" @update:model-value="(v) => patchPrep({ bootSize: v })" />
              </div>
              <p class="guide-text prep-fit-hint">
                Уровень {{ levelLabel }} · стиль
                {{ mix.trail }}/{{ mix.freeride }}/{{ mix.park }}.
                <button type="button" class="link-btn" @click="tab = 'profile'">Изменить</button>
              </p>

              <div class="prep-fit-cards">
                <div class="prep-fit-card">
                  <span>Длина</span>
                  <b>{{ fit.min }}–{{ fit.max }} см</b>
                  <small>{{ fitKind === 'ski' ? 'лыжи' : 'доска' }} под рост {{ prep.heightCm }} и вес {{ prep.weightKg }}</small>
                </div>
                <div v-if="fitKind === 'snowboard'" class="prep-fit-card">
                  <span>Ширина</span>
                  <b>{{ boardWidth.min }}–{{ boardWidth.max }} мм</b>
                  <small>под ботинок {{ prep.bootSize }} и стиль</small>
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
            </aside>
          </div>
        </section>
        <!-- доска: прогибы, стойка, уход -->
        <section v-else-if="tab === 'board'" class="prep-pane">
          <div class="prep-brand-tabs prep-board-tabs">
            <button
              v-for="item in boardTabs"
              :key="item.id"
              type="button"
              :class="{ active: boardTab === item.id }"
              @click="boardTab = item.id"
            >
              {{ item.label }}
            </button>
          </div>

          <div v-if="boardTab === 'stance'" class="prep-guide">
            <h4>Стойка и крепления</h4>
            <StanceDiagram
              :model-value="prep.stance"
              :style="prep.style"
              :level="prep.level"
              @update:model-value="onStance"
            />
          </div>

          <div v-if="boardTab === 'camber'" class="prep-guide">
            <h4>Типы прогибов</h4>
            <div class="camber-grid">
              <article v-for="camber in camberTypes" :key="camber.id" class="camber-card">
                <CamberDiagram :type="camber.id" />
                <b>{{ camber.name }}</b>
                <p>{{ camber.summary }}</p>
                <span>{{ camber.bestFor.join(' · ') }}</span>
                <small>{{ camber.tradeoff }}</small>
              </article>
            </div>
          </div>

          <div v-if="boardTab === 'shapes'" class="prep-guide">
            <h4>Формы доски</h4>
            <div class="guide-grid">
              <div v-for="shape in boardShapes" :key="shape.id">
                <ShapeDiagram :type="shape.id" />
                <b>{{ shape.name }}</b>
                <p>{{ shape.text }}</p>
                <span class="guide-tag">{{ shape.best }}</span>
                <small>{{ shape.tradeoff }}</small>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'shapes'" class="prep-guide">
            <h4>Радиус бокового выреза</h4>
            <div class="guide-grid">
              <div v-for="item in sidecutInfo" :key="item.title">
                <b>{{ item.title }}</b>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'selection'" class="prep-guide">
            <h4>Как подобрать</h4>
            <div class="guide-grid">
              <div v-for="item in boardGuides" :key="item.title">
                <b>{{ item.title }}</b>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'materials'" class="prep-guide">
            <h4>Материалы и конструкция</h4>
            <div class="guide-grid">
              <div v-for="wood in woodTypes" :key="wood.name">
                <b>{{ wood.name }}</b>
                <p>{{ wood.text }}</p>
              </div>
              <div v-for="part in constructionParts" :key="part.id">
                <b>{{ part.title }}</b>
                <p>{{ part.text }}</p>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'care'" class="prep-guide">
            <h4>Скользяк и парафин</h4>
            <div class="wax-grid">
              <div v-for="wax in waxTypes" :key="wax.id" class="wax-card">
                <b>{{ wax.name }}</b>
                <span>{{ wax.temp }}</span>
                <small>{{ wax.note }}</small>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'care'" class="prep-guide">
            <h4>Виды скользяков</h4>
            <div class="guide-grid">
              <div v-for="base in baseTypes" :key="base.id">
                <b>{{ base.name }}</b>
                <p>{{ base.note }}</p>
                <small>{{ base.price }}</small>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'bindings'" class="prep-guide">
            <h4>Жёсткость креплений</h4>
            <div class="guide-grid">
              <div v-for="item in bindingStiffness" :key="item.id">
                <b>{{ item.label }}</b>
                <p>{{ item.style }}</p>
                <span class="guide-tag">{{ item.plus }}</span>
                <small>{{ item.minus }}</small>
              </div>
            </div>

            <h4>Размеры под ботинок</h4>
            <div class="size-table">
              <div v-for="item in bindingSizes" :key="item.size">
                <b>{{ item.size }}</b>
                <span>{{ item.boots }}</span>
              </div>
            </div>

            <h4>Мини-диск или обычный</h4>
            <div class="guide-grid">
              <div v-for="item in discTypes" :key="item.id">
                <b>{{ item.name }}</b>
                <p>{{ item.text }}</p>
                <small>{{ item.note }}</small>
              </div>
            </div>

            <h4>Настройки и последовательность</h4>
            <div class="guide-grid">
              <div v-for="item in bindingSettings" :key="item.title">
                <b>{{ item.title }}</b>
                <p>{{ item.text }}</p>
              </div>
            </div>

            <h4>Как влияет на стиль</h4>
            <div class="guide-grid">
              <div v-for="item in bindingStyleEffects" :key="item.style">
                <b>{{ item.style }}</b>
                <p>{{ item.stiffness }} · хайбек {{ item.lean }} · {{ item.rotation }}</p>
                <small>{{ item.note }}</small>
              </div>
            </div>

            <h4>Пошагово</h4>
            <ol class="maintenance-list">
              <li v-for="(step, index) in setupSteps" :key="step">
                <b>{{ index + 1 }}.</b>
                <span>{{ step }}</span>
              </li>
            </ol>
          </div>

          <div v-if="boardTab === 'boots'" class="prep-guide">
            <h4>Шнуровка и системы</h4>
            <div class="boot-lacing">
              <article v-for="boot in bootLacing" :key="boot.name" class="boot-card">
                <b>{{ boot.name }}</b>
                <p><span class="boot-plus">+</span> {{ boot.pros }}</p>
                <p><span class="boot-minus">−</span> {{ boot.cons }}</p>
                <div class="boot-meta">
                  <span>надёжность: {{ boot.reliability }}</span>
                  <span>цена: {{ boot.price }}</span>
                  <span>ремонт: {{ boot.repair }}</span>
                  <span>комфорт: {{ boot.comfort }}</span>
                </div>
              </article>
            </div>

            <h4>Что выбрать</h4>
            <div class="guide-grid">
              <div v-for="item in bootLacingChoice" :key="item.scenario">
                <b>{{ item.scenario }}</b>
                <p>{{ item.choice }}</p>
                <small>{{ item.why }}</small>
              </div>
            </div>

            <h4>Подбор, стелька и сушка</h4>
            <div class="guide-grid">
              <div v-for="item in bootCare" :key="item.title">
                <b>{{ item.title }}</b>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'care'" class="prep-guide">
            <h4>Обслуживание и подготовка к сезону</h4>
            <ol class="maintenance-list">
              <li v-for="step in maintenanceSteps" :key="step.title">
                <b>{{ step.title }}</b>
                <span>{{ step.text }}</span>
              </li>
            </ol>
            <div class="service-grid">
              <div v-for="price in servicePrices" :key="price.label">
                <span>{{ price.label }}</span>
                <b>{{ price.price }}</b>
                <small v-if="price.note">{{ price.note }}</small>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'care'" class="prep-guide">
            <h4>Где обслуживать</h4>
            <div class="guide-grid">
              <div v-for="place in servicePlaces" :key="place.name">
                <b>{{ place.name }}</b>
                <p>{{ place.note }}</p>
              </div>
            </div>
          </div>

          <div v-if="boardTab === 'care'" class="prep-guide">
            <h4>Справка и поиск</h4>
            <div class="prep-links">
              <a
                v-for="link in selectionLinks"
                :key="link.label"
                :href="googleSearchUrl(link.query)"
                target="_blank"
                rel="noopener"
              >
                {{ link.label }} ↗
              </a>
            </div>
          </div>
        </section>

        <!-- одежда по погоде и высоте -->
        <section v-else-if="tab === 'clothing'" class="prep-pane">
          <div class="clothing-grid">
            <article v-for="layer in clothingLayers" :key="layer.id" class="clothing-card">
              <span>{{ layer.conditions }}</span>
              <b>{{ layer.title }}</b>
              <p>{{ layer.layers }}</p>
              <small>{{ layer.membrane }}</small>
              <em>{{ layer.note }}</em>
            </article>
          </div>

          <div class="prep-guide">
            <h4>Мембраны</h4>
            <div class="membrane-grid">
              <div v-for="membrane in membraneLevels" :key="membrane.label">
                <b>{{ membrane.label }}</b>
                <span>{{ membrane.note }}</span>
              </div>
            </div>
          </div>

          <div class="prep-guide">
            <h4>Как одеваться</h4>
            <ul>
              <li>Три слоя: термобельё, утеплитель, мембрана. Хлопок не носим.</li>
              <li>Крой свободнее: под куртку должен входить флис, руки не должны тянуть.</li>
              <li>Вентиляция важнее толщины: на подъёме расстёгивайте молнии.</li>
              <li>На высоте 3000+ добавляйте баф, очки категории 3–4 и UV-крем.</li>
              <li>В мороз −20 и ниже — пуховый средний слой и запасные перчатки.</li>
            </ul>
          </div>

          <div class="prep-guide">
            <h4>Бренды одежды</h4>
            <p class="guide-text">Эконом, средний и топ — во вкладке «Бренды», категория «Одежда РФ».</p>
            <button type="button" class="mini-btn" @click="tab = 'brands'; brandTab = 'clothing'">
              Открыть бренды одежды
            </button>
          </div>
        </section>
        <!-- чек-лист -->
        <section v-else-if="tab === 'checklist'" class="prep-pane">
          <div class="prep-progress-head">
            <div>
              <b>Собрано {{ progress.done }} из {{ progress.total }}</b>
              <span>· {{ progress.percent }}%</span>
            </div>
            <button type="button" class="mini-btn" @click="resetPrepChecklist">Сбросить</button>
          </div>
          <div class="prep-progress"><i :style="{ width: progress.percent + '%' }" /></div>

          <div v-if="needsAvalancheKit(mix) && !avalancheReady" class="prep-lock">
            <b>Фрирайд без лавинного набора</b>
            <p>Пока не отмечены бипер, щуп и лопата, за пределы трасс не выходим.</p>
          </div>

          <div class="prep-checklist-columns">
            <div class="prep-checklist-col">
              <div v-for="group in leftGroups" :key="group.id" class="prep-group">
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
            </div>

            <div class="prep-checklist-col">
              <div v-for="group in extraGroups" :key="group.id" class="prep-group">
                <div class="prep-group-head">
                  <h4>{{ group.title }}</h4>
                  <span v-if="group.note">{{ group.note }} · не входит в шкалу</span>
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
            </div>
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

          <div v-for="group in brandGroups" :key="group.label || 'all'" class="prep-brand-section">
            <h4 v-if="group.label">{{ group.label }}</h4>
            <div class="prep-brand-grid">
              <article v-for="brand in group.brands" :key="brand.id" class="prep-brand">
                <b>{{ brand.name }}</b>
                <p>{{ brand.note }}</p>
                <span>{{ brand.price }}</span>
                <a :href="googleSearchUrl(brand.query)" target="_blank" rel="noopener">Найти в Google ↗</a>
              </article>
            </div>
          </div>

          <p class="guide-text passport-note">
            Цены ориентировочные для РФ на сезон 2026/27. Проверяйте наличие и размеры перед покупкой.
          </p>
        </section>

        <!-- профи -->
        <section v-else-if="tab === 'pros'" class="prep-pane">
          <p class="guide-text">
            Ориентировочные профили топовых райдеров: стиль, параметры и спонсорское снаряжение. Модели меняются по сезонам.
          </p>
          <div class="prep-kind-switch">
            <button type="button" :class="{ active: proSport === 'all' }" @click="proSport = 'all'">Все</button>
            <button type="button" :class="{ active: proSport === 'snowboard' }" @click="proSport = 'snowboard'">Сноуборд</button>
            <button type="button" :class="{ active: proSport === 'ski' }" @click="proSport = 'ski'">Лыжи</button>
          </div>

          <div class="pros-grid">
            <article v-for="athlete in pros" :key="athlete.id" class="pro-card">
              <div class="pro-head">
                <div class="pro-avatar">{{ initials(athlete.name) }}</div>
                <div>
                  <b>{{ athlete.name }}</b>
                  <span>{{ athlete.country }} · {{ athlete.style }}</span>
                </div>
              </div>
              <div class="pro-chips">
                <span v-for="item in athlete.disciplines" :key="item">{{ item }}</span>
              </div>
              <div class="pro-params">
                <span>{{ athlete.heightCm }} см · {{ athlete.weightKg }} кг</span>
                <span>{{ athlete.stance }}</span>
              </div>
              <dl class="pro-gear">
                <div><dt>{{ athlete.sport === 'ski' ? 'Лыжи' : 'Доска' }}</dt><dd>{{ athlete.boardBrand }} {{ athlete.boardModel }}</dd></div>
                <div><dt>Длина</dt><dd>{{ athlete.boardLength }}</dd></div>
                <div><dt>Прогиб</dt><dd>{{ athlete.camber }}</dd></div>
                <div><dt>Жёсткость</dt><dd>{{ athlete.flex }}</dd></div>
                <div><dt>Ботинки</dt><dd>{{ athlete.boots }}</dd></div>
                <div><dt>Крепления</dt><dd>{{ athlete.bindings }}</dd></div>
              </dl>
              <p class="pro-note">{{ athlete.note }}</p>
              <a :href="googleSearchUrl(athlete.search)" target="_blank" rel="noopener">Найти снаряжение ↗</a>
            </article>
          </div>

          <p class="guide-text passport-note">
            Данные ориентировочные: спонсорские бренды и модели меняются, рост и вес — по открытым источникам.
          </p>
        </section>

        <!-- партнёры -->
        <section v-else-if="tab === 'partners'" class="prep-pane">
          <p class="guide-text">
            Ссылки ведут напрямую к партнёру: оплата и бронь происходят на его стороне. Приложение не принимает деньги и не хранит карты.
          </p>
          <div class="prep-brand-tabs">
            <button
              v-for="region in partnerRegions"
              :key="region.id"
              type="button"
              :class="{ active: partnerRegion === region.id }"
              @click="partnerRegion = region.id"
            >
              {{ region.label }}
            </button>
          </div>
          <div class="prep-brand-grid">
            <article v-for="partner in partnerList" :key="partner.id" class="prep-brand">
              <b>{{ partner.name }}</b>
              <p>{{ partner.note }}</p>
              <span>{{ partner.kind === 'hotel' ? 'отели' : partner.kind === 'flight' ? 'билеты' : 'экипировка' }}</span>
              <a :href="partner.url" target="_blank" rel="noopener">Перейти к партнёру ↗</a>
            </article>
          </div>
          <p class="guide-text passport-note">
            Партнёрские программы подключаются постепенно. Ссылки с UTM-меткой; комиссия выплачивается партнёром после оплаты, а не приложением.
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
