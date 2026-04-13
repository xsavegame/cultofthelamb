<template>
  <v-card class="mx-auto px-6">
    <v-card-title class="d-flex align-center px-0 pt-6">
      <span>Tarot Cards</span>
      <v-spacer />
      <v-chip color="primary" variant="tonal">
        {{ unlockedCount }} / {{ tableData.length }} unlocked
      </v-chip>
    </v-card-title>

    <v-card-text class="px-0">
      <v-text-field v-model="search" class="mb-4" hide-details label="Search by ID, enum, name, or description"
        prepend-inner-icon="mdi-magnify" single-line variant="outlined" />

      <v-data-table-virtual :headers="headers" hide-default-footer :items="tableData" :search="search">
        <template #item.unlocked="{ item }">
          <v-checkbox-btn :model-value="isCardUnlocked(item.id)"
            @update:model-value="setCardUnlocked(item.id, !!$event)" />
        </template>
        <template #item.description="{ item }">
          <div class="tarot-description" :class="{ 'text-warning': item.isCorrupted }">
            {{ item.description }}
          </div>
        </template>
      </v-data-table-virtual>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { TarotCards_Card } from '@/generated/classes/TarotCards_Card'
import { useDataStore } from '@/stores/data'
import { useTranslationStore } from '@/stores/translation'
import { TarotCards } from '@/generated/classes/TarotCards'
import { useI18n } from 'vue-i18n'
import { DataManager } from '@/generated/classes'

type TarotRow = {
  id: TarotCards_Card
  unlocked: boolean
  enumName: string
  name: string
  description: string
  isCorrupted: boolean
}

const dataStore = useDataStore()
const translationStore = useTranslationStore()
const search = ref('')
const i18n = useI18n();

const headers = [
  { title: 'Unlocked?', key: 'unlocked', sortable: false },
  { title: 'ID', key: 'id' },
  { title: 'Enum', key: 'enumName' },
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description', sortable: false },
]

const allCardIds = Object.values(DataManager.AllTrinkets)
  .sort((a, b) => a - b)

const foundCardsModel = computed<TarotCards_Card[]>({
  get() {
    return dataStore.data?.PlayerFoundTrinkets ?? []
  },
  set(value: TarotCards_Card[]) {
    if (!dataStore.data) {
      return
    }

    dataStore.data.PlayerFoundTrinkets = [...new Set(value)].sort((a, b) => a - b)
  },
})

const foundCardSet = computed(() => new Set(foundCardsModel.value))
const unlockedCount = computed(() => foundCardsModel.value.length)

const tableData = computed<TarotRow[]>(() => {
  return allCardIds.map(id => {
    const enumName = TarotCards_Card[id]
    const nameKey = `TarotCards/${enumName}/Name`
    const translatedName = translationStore.$t(nameKey)
    const translatedDescription = formatTarotDescription(id, enumName)

    return {
      id,
      unlocked: foundCardSet.value.has(id),
      enumName,
      name: translatedName === nameKey ? enumName : translatedName,
      isCorrupted: TarotCards.CorruptedCards.includes(id),
      description: translatedDescription,
    }
  })
})

function isCardUnlocked(card: TarotCards_Card): boolean {
  return foundCardSet.value.has(card)
}

function setCardUnlocked(card: TarotCards_Card, unlocked: boolean) {
  const next = new Set(foundCardsModel.value)
  if (unlocked) {
    next.add(card)
  } else {
    next.delete(card)
  }

  foundCardsModel.value = [...next].sort((a, b) => a - b)
}

function formatTarotDescription(card: TarotCards_Card, enumName: string): string {
  const basePath = `TarotCards/${enumName}`
  const descriptionKey = `${basePath}/Description`
  return i18n.t(descriptionKey, [i18n.t(`TarotCards/${enumName}/Positive`), i18n.t(`TarotCards/${enumName}/Negative`)]);
}

function readVariant(basePath: string, suffixes: string[]): string | null {
  for (const suffix of suffixes) {
    const key = `${basePath}/${suffix}`
    const value = translationStore.$t(key)
    if (value !== key) {
      return value
    }
  }

  return null
}
</script>

<style scoped>
.tarot-description {
  white-space: pre-line;
}
</style>
