<template>
  <!-- <v-sheet elevation="4"> -->
  <v-card class="mx-auto px-6">
    <v-form v-model="form">
      <v-card-text>
        <v-tabs color="primary" v-model="tab">
          <v-tab value="cult-info">Cult Information & Character Stats</v-tab>
          <v-tab value="cult-traits">Cult Traits</v-tab>
          <v-tab value="cooking-recipes">Cooking Recipes</v-tab>
        </v-tabs>

        <v-tabs-window v-model="tab">
          <v-tabs-window-item value="cult-info">
            <v-card class="mt-5" title="Basic Information" variant="tonal">
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-text-field v-model="formData.CultName" label="Cult Name" :rules="[rules.required()]"
                      variant="outlined" density="comfortable"></v-text-field>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-number-input v-model="formData.CurrentDayIndex" :min="1" label="Current Day"
                      :rules="[rules.required()]" control-variant="split" density="comfortable"
                      variant="outlined"></v-number-input>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
            <v-card class="mt-5" title="Hearts" variant="tonal">
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-number-input v-model="formData.PLAYER_HEALTH" :min="1" :label="$gt('Inventory/RED_HEART')"
                      :rules="[rules.required()]" control-variant="split" density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-number-input v-model="formData.PLAYER_BLUE_HEARTS" :min="0" :label="$gt('Inventory/BLUE_HEART')"
                      :rules="[rules.required()]" control-variant="split" density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-number-input v-model="formData.PLAYER_BLACK_HEARTS" :min="0"
                      :label="$gt('Inventory/BLACK_HEART')" :rules="[rules.required()]" control-variant="split"
                      density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2" v-if="dataStore.isWoolHavenUnlocked">
                    <v-number-input v-model="formData.PLAYER_FIRE_HEARTS" :min="0" :label="$gt('Inventory/FIRE_HEART')"
                      :rules="[rules.required()]" control-variant="split" density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2" v-if="dataStore.isWoolHavenUnlocked">
                    <v-number-input v-model="formData.PLAYER_ICE_HEARTS" :min="0" :label="$gt('Inventory/ICE_HEART')"
                      :rules="[rules.required()]" control-variant="split" density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                  <v-col cols="12" md="4" lg="3" xxl="2">
                    <v-number-input v-model="formData.PLAYER_SPIRIT_HEARTS" :min="0" label="Spirit Heart"
                      :rules="[rules.required()]" control-variant="split" density="comfortable" variant="outlined"
                      v-tooltip="'1 unit = half a heart (i.e 10 = 5 hearts)'"></v-number-input>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-tabs-window-item>
          <v-tabs-window-item value="cult-traits">
            <Doctrine v-model="formData.DoctrineUnlockedUpgrades"></Doctrine>
          </v-tabs-window-item>
          <v-tabs-window-item value="cooking-recipes">
            <Recipe v-model="formData.RecipesDiscovered"></Recipe>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions>
        <v-btn :disabled="shouldDisableSaveButton" color="primary" @click="save" variant="outlined">Save</v-btn>
        <v-btn :disabled="shouldDisableResetButton" color="secondary" @click="reset" variant="outlined">Reset</v-btn>
      </v-card-actions>

    </v-form>
  </v-card>
  <!-- </v-sheet> -->
</template>

<script lang="ts" setup>
import { useDataStore } from '@/stores/data'
import { useRules } from 'vuetify/labs/rules';
import type { DataManager } from '@/generated/classes';
import type { MakeRequired } from '@/utils/type';
import Doctrine from '@/components/Doctrine.vue';
import _ from 'lodash';
import Recipe from '@/components/Recipe.vue';
import { computed, onMounted, ref } from 'vue';

const rules = useRules()

const dataStore = useDataStore()

const tab = ref('cult-info')
const form = ref(false)

type RequiredDataKeys =
  | 'PLAYER_HEALTH'
  | 'PLAYER_BLUE_HEARTS'
  | 'PLAYER_BLACK_HEARTS'
  | 'CultName'
  | 'CurrentDayIndex'
  | 'PLAYER_FIRE_HEARTS'
  | 'PLAYER_ICE_HEARTS'
  | 'PLAYER_SPIRIT_HEARTS'
  | 'DoctrineUnlockedUpgrades'
  | 'RecipesDiscovered';

type Data = Omit<MakeRequired<DataManager, RequiredDataKeys>, 'DoctrineUnlockedUpgrades' | 'RecipesDiscovered'> & {
  DoctrineUnlockedUpgrades: NonNullable<DataManager['DoctrineUnlockedUpgrades']>;
  RecipesDiscovered: NonNullable<DataManager['RecipesDiscovered']>;
};

const defaultFormData: () => Data = () => ({
  CultName: '',
  CurrentDayIndex: 0,
  PLAYER_HEALTH: 0,
  PLAYER_BLUE_HEARTS: 0,
  PLAYER_BLACK_HEARTS: 0,
  PLAYER_FIRE_HEARTS: 0,
  PLAYER_ICE_HEARTS: 0,
  PLAYER_SPIRIT_HEARTS: 0,
  DoctrineUnlockedUpgrades: [],
  RecipesDiscovered: [],
});

const formData = ref<Data>(defaultFormData());

const isFormChanged = computed(() => {
  return Object.keys(formData.value).some((key) => {
    return !_.isEqual(formData.value[key as keyof typeof formData.value], dataStore.data![key as keyof DataManager]);
  })
})

const shouldDisableSaveButton = computed(() => {
  if (!form.value) {
    return true;
  }

  return !isFormChanged.value;
})

const shouldDisableResetButton = computed(() => {
  return !isFormChanged.value;
})

const save = () => {
  Object.entries(formData.value).forEach(([key, value]) => {
    (dataStore.data as any)[key] = value;
  });
}

const reset = () => {
  Object.entries(formData.value).forEach(([key]) => {
    (formData.value as any)[key] = _.cloneDeep((dataStore.data as any)[key]);
  });
  formData.value.DoctrineUnlockedUpgrades = _.cloneDeep(
    dataStore.data?.DoctrineUnlockedUpgrades ?? [],
  );
  formData.value.RecipesDiscovered = _.cloneDeep(
    dataStore.data?.RecipesDiscovered ?? [],
  );
}

onMounted(() => {
  reset();
});

</script>
