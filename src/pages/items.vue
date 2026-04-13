<template>
  <v-card class="mx-auto px-6">
    <v-card-title class="d-flex align-center px-0 pt-6">
      <span>Inventory</span>
      <v-spacer />
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" variant="flat" @click="openAddDialog">
        Add Item
      </v-btn>
    </v-card-title>

    <v-card-text class="px-0">
      <v-text-field v-model="search" class="mb-4" hide-details label="Search by name, enum, or type ID"
        prepend-inner-icon="mdi-magnify" single-line variant="outlined" />

      <v-alert v-if="allRows.length === 0" text="No inventory items found in this save file." type="info"
        variant="tonal" />

      <v-data-table-virtual v-else fixed-header :headers="headers" height="520" hide-default-footer item-value="type"
        :items="filteredRows">
        <template #item.name="{ item }">
          <div class="font-weight-medium">{{ item.name }}</div>
          <div class="text-medium-emphasis text-caption">
            {{ item.enumName }} ({{ item.type }})
          </div>
        </template>

        <template #item.quantity="{ item }">
          <span>{{ item.quantity }}</span>
        </template>

        <template #item.quantityReserved="{ item }">
          <span>{{ item.quantityReserved }}</span>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn color="warning" icon="mdi-pencil-outline" size="small" variant="tonal"
              @click="openEditDialog(item.type)" />
            <v-btn color="red" icon="mdi-delete-outline" size="small" variant="tonal" @click="removeItem(item.type)" />
          </div>
        </template>
      </v-data-table-virtual>

      <v-alert v-if="allRows.length > 0 && filteredRows.length === 0" class="mt-4"
        text="No inventory items match your search." type="warning" variant="tonal" />
    </v-card-text>
  </v-card>

  <v-dialog v-model="dialogOpen" max-width="640" persistent>
    <v-card>
      <v-card-title>
        {{ dialogMode === 'add' ? 'Add Inventory Item' : 'Edit Inventory Item' }}
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <v-autocomplete v-model="draft.type" density="comfortable" :disabled="dialogMode === 'edit'" hide-details
              item-title="title" item-value="value" :items="typeOptions" label="Type" variant="outlined" />
          </v-col>

          <v-col cols="12" md="6">
            <v-number-input v-model="draft.quantity" control-variant="split" density="comfortable" hide-details
              label="Quantity" :max="draftQuantityMax ?? undefined" variant="outlined" />
          </v-col>

          <v-col cols="12" md="6">
            <v-number-input v-model="draft.QuantityReserved" control-variant="split" density="comfortable" hide-details
              label="Quantity Reserved" :max="draftQuantityMax ?? undefined" variant="outlined" />
          </v-col>

          <v-col cols="12" v-if="draft.type">
            {{ translateInventoryDescription(toEnumName(draft.type)) }}
          </v-col>

          <v-col v-if="showTypeWarning" cols="12">
            <v-alert :text="`Warning: ${warningTypeDisplay} is a sensitive item type. Edit carefully.`" type="warning"
              variant="tonal" />
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn color="warning" :disabled="!hasDraftChanges" variant="tonal" @click="resetDraft">
          Reset
        </v-btn>
        <v-btn color="success" :disabled="!canSaveDraft" variant="flat" @click="saveDraft">
          Save
        </v-btn>
        <v-spacer />
        <v-btn color="secondary" variant="text" @click="closeDialog">
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { InventoryItem } from '@/generated/classes/InventoryItem'
import { InventoryItem_ITEM_TYPE } from '@/generated/classes/InventoryItem_ITEM_TYPE'
import {
  InventoryCreateDisallowedTypes,
  InventoryLimitedQuantityMax,
  InventoryUnlimitedQuantityTypes,
  InventoryWarnOnEditTypes,
} from '@/manual/items'
import { useDataStore } from '@/stores/data'
import { useTranslationStore } from '@/stores/translation'

type TypeOption = {
  title: string
  value: number
  description: string
}

type InventoryRow = {
  type: number
  quantity: number
  quantityReserved: number
  enumName: string
  name: string
  searchText: string
}

type DraftItem = {
  type: number
  quantity: number
  QuantityReserved: number
}

type DialogMode = 'add' | 'edit'
const createDisallowedTypeSet = new Set<number>(InventoryCreateDisallowedTypes)
const unlimitedQuantityTypeSet = new Set<number>(InventoryUnlimitedQuantityTypes)

const dataStore = useDataStore()
const translationStore = useTranslationStore()
const search = ref('')
const dialogOpen = ref(false)
const dialogMode = ref<DialogMode>('add')
const editTargetType = ref<number | null>(null)
const draft = ref<DraftItem>(createDefaultDraft())
const initialDraft = ref<DraftItem>(createDefaultDraft())

const warnOnEditTypeSet = new Set<number>(InventoryWarnOnEditTypes)

const headers = [
  { title: 'Item', key: 'name' },
  { title: 'Description', key: 'description' },
  { title: 'Quantity', key: 'quantity', sortable: false, width: 160 },
  { title: 'Reserved', key: 'quantityReserved', sortable: false, width: 160 },
  { title: 'Actions', key: 'actions', sortable: false, width: 140, align: 'end' as const },
]

const typeOptions = computed<TypeOption[]>(() => {
  const options: TypeOption[] = []

  for (const key of Object.keys(InventoryItem_ITEM_TYPE)) {
    if (!Number.isNaN(Number(key))) {
      continue
    }

    const value = InventoryItem_ITEM_TYPE[key as keyof typeof InventoryItem_ITEM_TYPE]
    if (typeof value !== 'number') {
      continue
    }

    if (createDisallowedTypeSet.has(value)) {
      continue
    }

    options.push({
      value,
      title: `${translateInventoryName(key)} (${key} / ${value})`,
      description: translateInventoryDescription(key),
    })
  }

  options.sort((a, b) => a.value - b.value)
  return options
})

const allRows = computed<InventoryRow[]>(() => {
  const items = dataStore.data?.items ?? []

  return items.map(item => {
    const typeValue = toSafeInteger(item.type)
    const enumName = toEnumName(typeValue)
    const translatedName = translateInventoryName(enumName)
    const description = translateInventoryDescription(enumName)

    return {
      type: typeValue,
      quantity: toSafeInteger(item.quantity),
      quantityReserved: toSafeInteger(item.QuantityReserved),
      enumName,
      name: translatedName,
      description,
      searchText: `${translatedName} ${enumName} ${typeValue} ${description}`.toLowerCase(),
    }
  })
})

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) {
    return allRows.value
  }

  return allRows.value.filter(row => row.searchText.includes(keyword))
})

const hasDraftChanges = computed(() => {
  return (
    draft.value.type !== initialDraft.value.type
    || draft.value.quantity !== initialDraft.value.quantity
    || draft.value.QuantityReserved !== initialDraft.value.QuantityReserved
  )
})

const canSaveDraft = computed(() => {
  return Number.isFinite(draft.value.type)
    && Number.isFinite(draft.value.quantity)
    && Number.isFinite(draft.value.QuantityReserved)
    && (
      dialogMode.value === 'edit'
      || !createDisallowedTypeSet.has(toSafeInteger(draft.value.type))
    )
    && (dialogMode.value === 'add' || hasDraftChanges.value)
})

const draftQuantityMax = computed<number | null>(() => {
  return getQuantityMaxForType(toSafeInteger(draft.value.type))
})

const showTypeWarning = computed(() => {
  return warnOnEditTypeSet.has(toSafeInteger(draft.value.type))
})

const warningTypeDisplay = computed(() => {
  const type = toSafeInteger(draft.value.type)
  const enumName = toEnumName(type)
  return `${translateInventoryName(enumName)} (${enumName} / ${type})`
})

watch(() => dataStore.data, () => {
  mergeDuplicateItems()
  closeDialog()
}, { immediate: true })

watch(() => draft.value.type, nextType => {
  const normalizedType = toSafeInteger(nextType)
  draft.value.type = normalizedType
  draft.value.quantity = toBoundedQuantity(normalizedType, draft.value.quantity)
  draft.value.QuantityReserved = toBoundedQuantity(
    normalizedType,
    draft.value.QuantityReserved,
  )
})

function ensureItems(createIfMissing = true): InventoryItem[] | null {
  const data = dataStore.data
  if (!data) {
    return null
  }

  if (!data.items && createIfMissing) {
    data.items = []
  }

  return data.items ?? null
}

function mergeDuplicateItems() {
  const items = ensureItems(false)
  if (!items) {
    return
  }

  const aggregated = new Map<number, { quantity: number, quantityReserved: number }>()
  for (const item of items) {
    const type = toSafeInteger(item.type)
    const quantity = toBoundedQuantity(type, item.quantity)
    const quantityReserved = toBoundedQuantity(type, item.QuantityReserved)
    const existing = aggregated.get(type)
    if (existing) {
      existing.quantity = toBoundedQuantity(type, existing.quantity + quantity)
      existing.quantityReserved = toBoundedQuantity(
        type,
        existing.quantityReserved + quantityReserved,
      )
    } else {
      aggregated.set(type, { quantity, quantityReserved })
    }
  }

  const mergedItems: InventoryItem[] = []
  for (const [type, values] of aggregated.entries()) {
    const mergedItem = new InventoryItem()
    mergedItem.type = type
    mergedItem.quantity = values.quantity
    mergedItem.QuantityReserved = values.quantityReserved
    mergedItems.push(mergedItem)
  }

  dataStore.data!.items = mergedItems
}

function openAddDialog() {
  dialogMode.value = 'add'
  editTargetType.value = null
  initialDraft.value = createDefaultDraft()
  draft.value = cloneDraft(initialDraft.value)
  dialogOpen.value = true
}

function openEditDialog(type: number) {
  const item = getItemByType(type)
  if (!item) {
    return
  }

  dialogMode.value = 'edit'
  editTargetType.value = type
  initialDraft.value = toDraft(item)
  draft.value = cloneDraft(initialDraft.value)
  dialogOpen.value = true
}

function removeItem(type: number) {
  const items = ensureItems()
  if (!items) {
    return
  }

  const filtered = items.filter(item => toSafeInteger(item.type) !== type)
  dataStore.data!.items = filtered
}

function saveDraft() {
  if (!canSaveDraft.value) {
    return
  }

  const items = ensureItems()
  if (!items) {
    return
  }

  if (dialogMode.value === 'add') {
    const newItem = new InventoryItem()
    const type = toSafeInteger(draft.value.type)
    newItem.type = type
    newItem.quantity = toBoundedQuantity(type, draft.value.quantity)
    newItem.QuantityReserved = toBoundedQuantity(type, draft.value.QuantityReserved)
    items.push(newItem)
  } else if (editTargetType.value !== null) {
    const target = items.find(item => toSafeInteger(item.type) === editTargetType.value)
    if (!target) {
      return
    }

    target.quantity = toBoundedQuantity(editTargetType.value, draft.value.quantity)
    target.QuantityReserved = toBoundedQuantity(
      editTargetType.value,
      draft.value.QuantityReserved,
    )
  }

  mergeDuplicateItems()
  closeDialog()
}

function resetDraft() {
  draft.value = cloneDraft(initialDraft.value)
}

function closeDialog() {
  dialogOpen.value = false
  editTargetType.value = null
}

function getItemByType(type: number): InventoryItem | null {
  const items = ensureItems(false)
  if (!items) {
    return null
  }

  return items.find(item => toSafeInteger(item.type) === type) ?? null
}

function toDraft(item: InventoryItem): DraftItem {
  return {
    type: toSafeInteger(item.type),
    quantity: toSafeInteger(item.quantity),
    QuantityReserved: toSafeInteger(item.QuantityReserved),
  }
}

function createDefaultDraft(): DraftItem {
  const defaultType = getDefaultCreatableType()
  return {
    type: defaultType,
    quantity: 1,
    QuantityReserved: 0,
  }
}

function cloneDraft(value: DraftItem): DraftItem {
  return {
    type: value.type,
    quantity: value.quantity,
    QuantityReserved: value.QuantityReserved,
  }
}

function translateInventoryName(enumName: string): string {
  let key = `Inventory/${enumName}`
  let translated = translationStore.$t(key)
  // if no translation is found, use CookingData/${enumName}
  if (translated === key) {
    key = `CookingData/${enumName}/Name`
    translated = translationStore.$t(key)
  }

  if (translated === key) {
    return enumName
  }

  return translated
}

function translateInventoryDescription(enumName: string): string {
  let key = `Inventory/${enumName}/Description`
  let translated = translationStore.$t(key)
  // if no translation is found, use CookingData/${enumName}/Name
  if (translated === key) {
    key = `CookingData/${enumName}/Description`
    translated = translationStore.$t(key)
  }

  if (translated === key) {
    return enumName
  }

  return translated
}

function toEnumName(typeValue: number): string {
  const enumName = InventoryItem_ITEM_TYPE[typeValue as InventoryItem_ITEM_TYPE]
  if (typeof enumName === 'string') {
    return enumName
  }

  return `UNKNOWN_${typeValue}`
}

function toSafeInteger(value: unknown): number {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  return Math.trunc(parsedValue)
}

function getDefaultCreatableType(): number {
  const values = Object.values(InventoryItem_ITEM_TYPE).filter(
    entry => typeof entry === 'number',
  ) as number[]

  values.sort((a, b) => a - b)
  return values.find(value => !createDisallowedTypeSet.has(value))
    ?? InventoryItem_ITEM_TYPE.LOG
}

function getQuantityMaxForType(type: number): number | null {
  if (unlimitedQuantityTypeSet.has(type)) {
    return null
  }

  return InventoryLimitedQuantityMax
}

function toBoundedQuantity(type: number, value: unknown): number {
  const normalized = toSafeInteger(value)
  const max = getQuantityMaxForType(type)
  if (max === null) {
    return normalized
  }

  return Math.min(normalized, max)
}
</script>
