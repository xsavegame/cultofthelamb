<template>
  <v-card>
    <v-card-text>
      <v-text-field v-model="search" hide-details label="Search" prepend-inner-icon="mdi-magnify" single-line
        variant="outlined" />
    </v-card-text>
    <v-data-table-virtual :headers="headers" hide-default-footer :items="tableData" :search="search">
      <template #item.id="{ item }">
        <v-checkbox v-model="model" :value="item.id" />
      </template>
      <template #item.ingredients="{ item }">
        <ul>
          <li v-for="v in item.ingredients" :key="v">{{ v }}</li>
        </ul>
      </template>
      <template #item.effects="{ item }">
        <ul v-if="item.effects.length > 0">
          <li v-for="(v, index) in item.effects" :key="`${index}-${v}`">{{ v }}</li>
        </ul>
        <span v-else>-</span>
      </template>
    </v-data-table-virtual>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CookingData } from '@/generated/classes/CookingData'
import { CookingData_MealEffectType } from '@/generated/classes/CookingData_MealEffectType'
import { InventoryItem_ITEM_TYPE } from '@/generated/classes/InventoryItem_ITEM_TYPE'
import { DLC_RECIPES, RECIPES } from '@/manual/cook_data'
import { useDataStore } from '@/stores/data'
import { useI18n } from 'vue-i18n'

const dataStore = useDataStore()
const model = defineModel<InventoryItem_ITEM_TYPE[]>()
const search = ref('')
const i18n = useI18n();

const headers = [
  { title: 'Unlocked?', key: 'id', sortable: false },
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description' },
  { title: 'Ingredients', key: 'ingredients' },
  { title: 'Effects', key: 'effects' },
]

const manualRecipeIds = Object.keys(RECIPES).map(
  v => +v as InventoryItem_ITEM_TYPE,
)
const generatedRecipeIds = [...CookingData.GetAllMeals(), ...CookingData.GetAllDrinks()]

const manualRecipeSet = new Set(manualRecipeIds)
const generatedRecipeSet = new Set(generatedRecipeIds)

const missingFromGenerated = manualRecipeIds.filter(v => !generatedRecipeSet.has(v))
const missingFromManual = generatedRecipeIds.filter(v => !manualRecipeSet.has(v))

const recipeIds = (missingFromGenerated.length === 0 && missingFromManual.length === 0)
  ? generatedRecipeIds
  : manualRecipeIds

const table = computed(() => {
  return recipeIds.map(id => {
    const enumName = InventoryItem_ITEM_TYPE[id as any]
    const recipeIngredients = CookingData.GetRecipe(id)
    const effects = CookingData.GetMealEffects(id).map(effect => {
      const effectEnumName = CookingData_MealEffectType[effect.MealEffectType]
      return i18n.t(`CookingData/${effectEnumName}/Description`, [effect.Chance])
    })

    return {
      id,
      name: i18n.t(`CookingData/${enumName}/Name`),
      description: i18n.t(`CookingData/${enumName}/Description`),
      ingredients: (recipeIngredients.length > 0 ? recipeIngredients[0] : []).map((item) => {
        const enumName = InventoryItem_ITEM_TYPE[item.type as any]
        return `${i18n.t(`Inventory/${enumName}`)} x${item.quantity}`
      }),
      effects,
    }
  })
})

const tableData = computed(() => {
  return table.value.filter(v => {
    if (dataStore.isWoolHavenUnlocked) {
      return true
    }

    return !DLC_RECIPES.includes(v.id)
  })
})

</script>
