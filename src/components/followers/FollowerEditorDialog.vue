<template>
  <v-dialog v-model="dialogModel" max-width="1200">
    <v-card v-if="draft">
      <v-card-title>Edit Follower #{{ draft.ID }}</v-card-title>
      <v-card-subtitle>{{ getFollowerName(draft) }}</v-card-subtitle>
      <v-card-text v-if="isUniqueFollowerId">
        <v-alert text="This follower uses a unique ID." type="warning" variant="tonal" />
      </v-card-text>
      <v-card-text>
        <v-card variant="tonal">
          <v-card-title>Appearance</v-card-title>
          <v-divider />
          <v-card-text>
            <v-alert v-if="appearanceLoadError" class="mb-4" :text="appearanceLoadError" type="warning"
              variant="tonal" />
            <v-alert v-if="animationLoadError" class="mb-4" :text="animationLoadError" type="warning" variant="tonal" />

            <v-row>
              <v-col cols="12" md="5">
                <FollowerSpinePreview v-if="draft" :animation="previewAnimationValue" :appearance="draft"
                  :height="260" />
              </v-col>

              <v-col cols="12" md="7">
                <v-row>
                  <v-col cols="12">
                    <v-autocomplete v-model="previewAnimation" clearable density="comfortable" :items="animationOptions"
                      label="Preview Animation" :loading="isAnimationLoading"
                      no-data-text="No animations found in follower skeleton" variant="outlined" />
                  </v-col>
                  <v-col cols="12">
                    <v-select v-model="draft.AppearanceSkin" density="comfortable" item-title="title" item-value="value"
                      :items="formSkinOptions" label="Follower Form" variant="outlined" />
                  </v-col>
                  <v-col cols="12">
                    <v-select v-model="draft.AppearanceClothingType" density="comfortable" item-title="title"
                      item-value="value" :items="clothingTypeOptions" label="Clothing" variant="outlined" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select v-model="draft.AppearanceClothingVariantIndex" density="comfortable" item-title="title"
                      item-value="value" :items="clothingVariantOptions" label="Clothing Variant" variant="outlined" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select v-model="draft.AppearanceFormColorIndex" density="comfortable" item-title="title"
                      item-value="value" :items="formColorOptions" label="Form Color" variant="outlined" />
                  </v-col>
                  <v-col cols="12" md="4">
                    <v-select v-model="draft.AppearanceClothingColorIndex" density="comfortable" item-title="title"
                      item-value="value" :items="clothingColorOptions" label="Clothing Color" variant="outlined" />
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        <v-row class="mt-3">
          <v-col cols="12" md="6">
            <v-text-field v-model="draft._name" density="comfortable" label="Name" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-number-input v-model="draft.XPLevel" control-variant="split" density="comfortable" label="XP Level"
              :min="0" variant="outlined" />
          </v-col>

          <v-col cols="12" md="6">
            <v-number-input v-model="draft.Age" control-variant="split" density="comfortable" label="Age" :min="0"
              variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-number-input v-model="draft.LifeExpectancy" control-variant="split" density="comfortable"
              label="Life Expectancy" :min="0" variant="outlined" />
          </v-col>

          <v-col cols="12" md="4">
            <v-select v-model="draft.FollowerRole" density="comfortable" item-title="title" item-value="value"
              :items="roleOptions" label="Role" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="draft.CurrentOverrideTaskType" density="comfortable" item-title="title"
              item-value="value" :items="taskOptions" label="Task" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-select v-model="draft.Location" density="comfortable" item-title="title" item-value="value"
              :items="locationOptions" label="Location" variant="outlined" />
          </v-col>

          <v-col cols="12" md="4">
            <v-number-input v-model="draft.Adoration" control-variant="split" density="comfortable"
              label="Adoration (XP)" :max="100" :min="0" :step="1" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-number-input v-model="draft._happiness" control-variant="split" density="comfortable" label="Happiness"
              :max="100" :min="0" :precision="null" variant="outlined" />
          </v-col>
          <v-col cols="12" md="4">
            <v-number-input v-model="draft._faith" control-variant="split" density="comfortable" label="Faith"
              :max="100" :min="0" :step="1" variant="outlined" />
          </v-col>

          <v-col cols="12" md="6">
            <v-number-input v-model="draft._satiation" control-variant="split" density="comfortable" label="Satiation"
              :max="100" :min="0" :precision="null" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-number-input v-model="draft._starvation" control-variant="split" density="comfortable" label="Starvation"
              :max="100" :min="0" :precision="null" variant="outlined" />
          </v-col>
        </v-row>


        <v-card class="mt-3" variant="tonal">
          <v-card-title>Traits</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field v-model="traitSearch" hide-details label="Filter traits by name or description"
                  prepend-inner-icon="mdi-magnify" single-line variant="outlined" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select v-model="traitKindFilter" density="comfortable" hide-details item-title="title"
                  item-value="value" :items="traitKindOptions" label="Trait type" variant="outlined" />
              </v-col>
              <v-col cols="12">
                <v-checkbox v-model="showRestrictedTraits" color="warning" hide-details
                  label="Show restricted traits" />
              </v-col>
              <v-col v-if="showRestrictedTraits" cols="12">
                <v-alert text="Restricted traits are visible. Edit carefully." type="warning" variant="tonal" />
              </v-col>
            </v-row>

            <v-data-table-virtual class="mt-4" fixed-header :headers="traitHeaders" height="400" hide-default-footer
              :items="filteredTraitRows">
              <template #item.selected="{ item }">
                <v-checkbox-btn :disabled="item.isDisabled" :model-value="isTraitSelected(item.id)"
                  @update:model-value="setTraitSelected(item.id, !!$event)" />
              </template>
              <template #item.name="{ item }">
                <span :class="{ 'text-warning font-weight-medium': item.isRestricted }">
                  {{ item.name }}
                </span>
              </template>
              <template #item.kind="{ item }">
                <div class="d-flex ga-2 align-center">
                  <v-chip :color="item.kind === 'good' ? 'success' : 'error'" size="small" variant="tonal">
                    {{ item.kindLabel }}
                  </v-chip>
                  <v-chip v-if="item.isRestricted" color="warning" size="small" variant="tonal">
                    Restricted
                  </v-chip>
                </div>
              </template>
              <template #item.description="{ item }">
                <div>{{ item.description }}</div>
                <div v-if="item.isDisabledByCultTrait" class="text-red">
                  This trait is currently disabled as it conflicts with a cult trait.
                </div>
                <div v-else-if="item.isUnique" class="text-warning">
                  This is a unique trait and cannot be edited.
                </div>
              </template>
            </v-data-table-virtual>
          </v-card-text>
        </v-card>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn color="secondary" :disabled="shouldDisableResetButton" variant="outlined" @click="resetDraft">
          Reset
        </v-btn>
        <v-btn color="primary" :disabled="shouldDisableSaveButton" variant="outlined" @click="saveDraft">
          Save
        </v-btn>
        <v-spacer />
        <v-btn variant="plain" @click="closeDialog">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { FollowerInfo } from '@/generated/classes/FollowerInfo'
import type { FollowerDraft } from '@/types/follower'
import _ from 'lodash'
import { computed, getCurrentInstance, ref, toRaw, watch } from 'vue'
import FollowerSpinePreview from '@/components/followers/FollowerSpinePreview.vue'
import { FollowerLocation } from '@/generated/classes/FollowerLocation'
import { FollowerRole } from '@/generated/classes/FollowerRole'
import { FollowerTaskType } from '@/generated/classes/FollowerTaskType'
import { FollowerTrait_TraitType } from '@/generated/classes/FollowerTrait_TraitType'
import {
  createDefaultFollowerAppearance,
  getFollowerAppearanceFromFollower,
} from '@/followers/appearance'
import {
  loadFollowerAppearanceCatalog,
  type FollowerAppearanceCatalog,
  type FollowerAppearanceClothingOption,
  type FollowerAppearanceFormOption,
} from '@/followers/appearance-catalog'
import { loadFollowerAnimationNames } from '@/followers/spine-resource'
import { UniqueFollowerIDs } from '@/manual/followers'
import { ExclusiveTraits, GoodTraits, UniqueTraits } from '@/manual/traits'

type FollowerEditableKey = Exclude<keyof FollowerDraft, 'ID'>
type TraitKind = 'good' | 'bad'
type TraitKindFilter = 'all' | TraitKind

type TraitRow = {
  id: FollowerTrait_TraitType
  name: string
  description: string
  kind: TraitKind
  kindLabel: string
  isRestricted: boolean
  isUnique: boolean
  isDisabledByCultTrait: boolean
  isDisabled: boolean
}

type EnumOption<T> = {
  title: string
  value: T
}

const props = defineProps<{
  modelValue: boolean
  follower: FollowerInfo | null
  initialDraft: FollowerDraft | null
  cultTraits: FollowerTrait_TraitType[] | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', draft: FollowerDraft): void
}>()

const app = getCurrentInstance()
const uniqueFollowerIdSet = new Set<number>(UniqueFollowerIDs)

const draft = ref<FollowerDraft | null>(null)
const traitSearch = ref('')
const traitKindFilter = ref<TraitKindFilter>('all')
const showRestrictedTraits = ref(false)
const appearanceCatalog = ref<FollowerAppearanceCatalog | null>(null)
const appearanceLoadError = ref<string | null>(null)
const previewAnimation = ref<string | null>(null)
const animationOptions = ref<string[]>([])
const isAnimationLoading = ref(false)
const animationLoadError = ref<string | null>(null)

const editableKeys: FollowerEditableKey[] = [
  '_name',
  'XPLevel',
  'Age',
  'LifeExpectancy',
  'FollowerRole',
  'CurrentOverrideTaskType',
  'Location',
  'Adoration',
  '_happiness',
  '_faith',
  '_satiation',
  '_starvation',
  'AppearanceSkin',
  'AppearanceClothingType',
  'AppearanceClothingVariantIndex',
  'AppearanceFormColorIndex',
  'AppearanceClothingColorIndex',
  'Traits',
]

const dialogModel = computed({
  get() {
    return props.modelValue
  },
  set(value: boolean) {
    emit('update:modelValue', value)
  },
})

const goodTraitSet = new Set<FollowerTrait_TraitType>(GoodTraits)
const uniqueTraitSet = new Set<FollowerTrait_TraitType>(UniqueTraits)
const exclusiveTraitSet = new Set<FollowerTrait_TraitType>(ExclusiveTraits.flat())
const cultTraitSet = computed(() => {
  const cultTraits = props.cultTraits
  if (!cultTraits) {
    return new Set<FollowerTrait_TraitType>()
  }

  return new Set<FollowerTrait_TraitType>(cultTraits)
})

const traitKindOptions: EnumOption<TraitKindFilter>[] = [
  { title: 'All', value: 'all' },
  { title: 'Good', value: 'good' },
  { title: 'Bad', value: 'bad' },
]
const traitHeaders = [
  { title: 'Selected', key: 'selected', sortable: false },
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'kind' },
  { title: 'Description', key: 'description' },
]

const roleOptions = enumToOptions(FollowerRole)
const taskOptions = enumToOptions(FollowerTaskType)
const locationOptions = enumToOptions(FollowerLocation)
const formSkinOptions = computed((): EnumOption<string>[] => {
  if (!appearanceCatalog.value) {
    return []
  }

  return appearanceCatalog.value.forms.map(option => ({
    title: `${option.title} (${option.skin})`,
    value: option.skin,
  }))
})

const clothingTypeOptions = computed((): EnumOption<number>[] => {
  if (!appearanceCatalog.value) {
    return []
  }

  return appearanceCatalog.value.clothing.map(option => ({
    title: `${option.title} (Type ${option.clothingType})`,
    value: option.clothingType,
  }))
})

const selectedFormOption = computed<FollowerAppearanceFormOption | null>(() => {
  const currentDraft = draft.value
  if (!currentDraft || !appearanceCatalog.value) {
    return null
  }

  return appearanceCatalog.value.formBySkin.get(currentDraft.AppearanceSkin) ?? null
})

const selectedClothingOption = computed<FollowerAppearanceClothingOption | null>(() => {
  const currentDraft = draft.value
  if (!currentDraft || !appearanceCatalog.value) {
    return null
  }

  return appearanceCatalog.value.clothingByType.get(currentDraft.AppearanceClothingType) ?? null
})

const formColorOptions = computed(() => {
  return buildIndexOptions(selectedFormOption.value?.colorSets.length ?? 1)
})

const clothingColorOptions = computed(() => {
  return buildIndexOptions(selectedClothingOption.value?.colorSets.length ?? 1)
})

const clothingVariantOptions = computed(() => {
  return buildIndexOptions(selectedClothingOption.value?.variantSkins.length ?? 1)
})
const previewAnimationValue = computed(() => {
  const selectedAnimation = previewAnimation.value?.trim()
  if (selectedAnimation) {
    return selectedAnimation
  }

  return animationOptions.value[0] ?? 'idle'
})

const allTraitRows = computed(() => {
  const rows: TraitRow[] = []
  for (const option of enumToOptions(FollowerTrait_TraitType)) {
    const trait = option.value as FollowerTrait_TraitType
    if (trait === FollowerTrait_TraitType.None) {
      continue
    }

    const enumName = FollowerTrait_TraitType[trait]
    const nameKey = `Traits/${enumName}`
    const descriptionKey = `Traits/${enumName}/Description`
    const translatedName = $gt(nameKey)
    const translatedDescription = $gt(descriptionKey)
    const isGood = goodTraitSet.has(trait)
    const isUnique = uniqueTraitSet.has(trait)
    const isRestricted = isUnique || exclusiveTraitSet.has(trait) || cultTraitSet.value.has(trait)
    const isDisabledByCultTrait = cultTraitSet.value.has(trait)

    rows.push({
      id: trait,
      name: translatedName === nameKey ? enumName : translatedName,
      description: translatedDescription === descriptionKey ? enumName : translatedDescription,
      kind: isGood ? 'good' : 'bad',
      kindLabel: isGood ? 'Good' : 'Bad',
      isRestricted,
      isUnique,
      isDisabledByCultTrait,
      isDisabled: isDisabledByCultTrait || isUnique,
    })
  }

  return rows
})

const filteredTraitRows = computed(() => {
  const keyword = traitSearch.value.trim().toLowerCase()
  return allTraitRows.value.filter(item => {
    if (traitKindFilter.value !== 'all' && item.kind !== traitKindFilter.value) {
      return false
    }

    if (!showRestrictedTraits.value && item.isRestricted) {
      return false
    }

    if (!keyword) {
      return true
    }

    return (
      item.name.toLowerCase().includes(keyword)
      || item.description.toLowerCase().includes(keyword)
    )
  })
})

const hasChanges = computed(() => {
  if (!props.follower && props.initialDraft && draft.value) {
    return !_.isEqual(draft.value, props.initialDraft)
  }

  if (!props.follower || !draft.value) {
    return false
  }

  return editableKeys.some(key => {
    const sourceValue = normalizeSourceValue(props.follower as FollowerInfo, key)
    const draftValue = draft.value![key]
    return !_.isEqual(sourceValue, draftValue)
  })
})

const shouldDisableSaveButton = computed(() => {
  if (!props.follower && props.initialDraft) {
    return !draft.value
  }

  return !hasChanges.value
})
const shouldDisableResetButton = computed(() => !hasChanges.value)
const isUniqueFollowerId = computed(() => {
  return draft.value ? uniqueFollowerIdSet.has(draft.value.ID) : false
})

watch(() => props.modelValue, isOpen => {
  if (isOpen) {
    void ensureAppearanceCatalogLoaded()
    void ensureAnimationOptionsLoaded()
    resetPreviewAnimation()
    syncDraft()
    return
  }

  resetFilters()
  resetPreviewAnimation()
})

watch(() => props.follower, () => {
  if (props.modelValue) {
    syncDraft()
  }
})

watch(() => props.initialDraft, () => {
  if (props.modelValue) {
    syncDraft()
  }
})

watch(appearanceCatalog, () => {
  normalizeAppearanceFields()
})

watch(() => draft.value?.AppearanceSkin, () => {
  normalizeAppearanceFields()
})

watch(() => draft.value?.AppearanceClothingType, () => {
  normalizeAppearanceFields()
})

function enumToOptions<TEnum extends Record<string, number | string>>(
  enumObject: TEnum,
): EnumOption<number>[] {
  const options: EnumOption<number>[] = []
  for (const key of Object.keys(enumObject)) {
    if (!Number.isNaN(Number(key))) {
      continue
    }

    const value = enumObject[key as keyof TEnum]
    if (typeof value === 'number') {
      options.push({
        title: key,
        value,
      })
    }
  }

  return options
}

function toDraft(follower: FollowerInfo): FollowerDraft {
  const appearance = getFollowerAppearanceFromFollower(follower)

  return {
    ID: follower.ID,
    _name: follower._name ?? '',
    XPLevel: follower.XPLevel ?? 0,
    Age: follower.Age ?? 0,
    LifeExpectancy: follower.LifeExpectancy ?? 0,
    FollowerRole: follower.FollowerRole ?? FollowerRole.Worshipper,
    CurrentOverrideTaskType: follower.CurrentOverrideTaskType ?? FollowerTaskType.None,
    Location: follower.Location ?? FollowerLocation.None,
    Adoration: follower.Adoration ?? 0,
    _happiness: follower._happiness ?? 0,
    _faith: follower._faith ?? 0,
    _satiation: follower._satiation ?? 0,
    _starvation: follower._starvation ?? 0,
    Traits: follower.Traits ? [...new Set(follower.Traits)] : [],
    ...appearance,
  }
}

function normalizeSourceValue(follower: FollowerInfo, key: FollowerEditableKey): unknown {
  const appearance = getFollowerAppearanceFromFollower(follower)

  switch (key) {
    case '_name': {
      return follower._name ?? ''
    }
    case 'XPLevel': {
      return follower.XPLevel
    }
    case 'Age': {
      return follower.Age
    }
    case 'LifeExpectancy': {
      return follower.LifeExpectancy
    }
    case 'FollowerRole': {
      return follower.FollowerRole
    }
    case 'CurrentOverrideTaskType': {
      return follower.CurrentOverrideTaskType
    }
    case 'Location': {
      return follower.Location
    }
    case 'Adoration': {
      return follower.Adoration
    }
    case '_happiness': {
      return follower._happiness
    }
    case '_faith': {
      return follower._faith
    }
    case '_satiation': {
      return follower._satiation
    }
    case '_starvation': {
      return follower._starvation
    }
    case 'AppearanceSkin': {
      return appearance.AppearanceSkin
    }
    case 'AppearanceClothingType': {
      return appearance.AppearanceClothingType
    }
    case 'AppearanceClothingVariantIndex': {
      return appearance.AppearanceClothingVariantIndex
    }
    case 'AppearanceFormColorIndex': {
      return appearance.AppearanceFormColorIndex
    }
    case 'AppearanceClothingColorIndex': {
      return appearance.AppearanceClothingColorIndex
    }
    case 'Traits': {
      return follower.Traits ?? []
    }
  }
}

function getFollowerName(follower: Pick<FollowerDraft, 'ID' | '_name'>): string {
  const name = follower._name.trim()
  return name || `Follower ${follower.ID}`
}

function syncDraft() {
  if (props.follower) {
    draft.value = toDraft(props.follower)
    normalizeAppearanceFields()
    return
  }

  if (props.initialDraft) {
    draft.value = {
      ...createDefaultFollowerAppearance(),
      ...structuredClone(toRaw(props.initialDraft)),
    }
    normalizeAppearanceFields()
    return
  }

  draft.value = null
}

function buildIndexOptions(count: number): EnumOption<number>[] {
  const size = Math.max(1, count)
  return Array.from({ length: size }, (_value, index) => ({
    title: `${index}`,
    value: index,
  }))
}

function clampIndex(value: number, count: number): number {
  if (count <= 0 || !Number.isFinite(value)) {
    return 0
  }

  const clamped = Math.max(0, Math.min(Math.trunc(value), count - 1))
  return clamped
}

async function ensureAppearanceCatalogLoaded() {
  if (appearanceCatalog.value || appearanceLoadError.value) {
    return
  }

  try {
    appearanceCatalog.value = await loadFollowerAppearanceCatalog()
  } catch (error) {
    appearanceLoadError.value = error instanceof Error
      ? error.message
      : `${error}`
  }
}

async function ensureAnimationOptionsLoaded() {
  if (animationOptions.value.length > 0 || isAnimationLoading.value) {
    return
  }

  isAnimationLoading.value = true
  animationLoadError.value = null
  try {
    animationOptions.value = await loadFollowerAnimationNames()
    if (animationOptions.value.length === 0) {
      animationLoadError.value = 'No animations found in follower skeleton.'
    }
  } catch (error) {
    animationLoadError.value = error instanceof Error
      ? error.message
      : `${error}`
  } finally {
    isAnimationLoading.value = false
  }
}

function normalizeAppearanceFields() {
  const currentDraft = draft.value
  if (!currentDraft) {
    return
  }

  const catalog = appearanceCatalog.value
  if (!catalog) {
    return
  }

  const formOption = catalog.formBySkin.get(currentDraft.AppearanceSkin)
    ?? catalog.formBySkin.get(catalog.defaultSkin)
    ?? null
  if (formOption && formOption.skin !== currentDraft.AppearanceSkin) {
    currentDraft.AppearanceSkin = formOption.skin
  }
  currentDraft.AppearanceFormColorIndex = clampIndex(
    currentDraft.AppearanceFormColorIndex,
    formOption?.colorSets.length ?? 1,
  )

  const clothingOption = catalog.clothingByType.get(currentDraft.AppearanceClothingType)
    ?? catalog.clothingByType.get(catalog.defaultClothingType)
    ?? null
  if (clothingOption && clothingOption.clothingType !== currentDraft.AppearanceClothingType) {
    currentDraft.AppearanceClothingType = clothingOption.clothingType
  }
  currentDraft.AppearanceClothingVariantIndex = clampIndex(
    currentDraft.AppearanceClothingVariantIndex,
    clothingOption?.variantSkins.length ?? 1,
  )
  currentDraft.AppearanceClothingColorIndex = clampIndex(
    currentDraft.AppearanceClothingColorIndex,
    clothingOption?.colorSets.length ?? 1,
  )
}

function resetFilters() {
  traitSearch.value = ''
  traitKindFilter.value = 'all'
  showRestrictedTraits.value = false
}

function resetPreviewAnimation() {
  previewAnimation.value = null
}

function closeDialog() {
  dialogModel.value = false
  resetFilters()
  resetPreviewAnimation()
}

function saveDraft() {
  if (!draft.value) {
    return
  }

  emit('save', structuredClone(toRaw(draft.value)))
  syncDraft()
}

function resetDraft() {
  syncDraft()
}

function isTraitSelected(trait: FollowerTrait_TraitType): boolean {
  return draft.value?.Traits.includes(trait) ?? false
}

function setTraitSelected(trait: FollowerTrait_TraitType, selected: boolean) {
  if (!draft.value) {
    return
  }

  const traitRow = allTraitRows.value.find(item => item.id === trait)
  if (traitRow?.isDisabled) {
    return
  }

  const current = new Set(draft.value.Traits)
  if (selected) {
    current.add(trait)
  } else {
    current.delete(trait)
  }

  draft.value.Traits = _.sortBy([...current])
}

function $gt(key: string): string {
  return app?.appContext.config.globalProperties.$gt(key) ?? key
}
</script>
