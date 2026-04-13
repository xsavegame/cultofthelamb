<template>
  <v-card class="d-flex">
    <v-tabs color="secondary" direction="vertical" v-model="tab">
      <v-tab :value="key" v-for="(_, key) in doctrineList" :key="key">{{ $gt(`DoctrineUpgradeSystem/${key}`)
      }}</v-tab>
    </v-tabs>

    <v-divider vertical></v-divider>

    <v-tabs-window v-model="tab">
      <v-tabs-window-item :value="key" v-for="(items, key) in doctrineList" :key="`${key}-tab`">
        <v-card :title="$gt(`DoctrineUpgradeSystem/${key}`)" :subtitle="$gt(`DoctrineUpgradeSystem/${key}/Description`)"
          class="pa-5">
          <v-data-table-virtual :headers="headers" :items="toTableData(items)" :group-by="groupBy" hide-default-footer>
            <template v-slot:group-header="{ item, columns, toggleGroup, isGroupOpen }">
              <tr>
                <td :colspan="columns.length" class="cursor-pointer" v-ripple @click="toggleGroup(item)">
                  <div class="d-flex align-center">
                    <v-btn :icon="isGroupOpen(item) ? '$expand' : '$next'" color="medium-emphasis" density="comfortable"
                      size="small" variant="outlined"></v-btn>

                    <span class="ms-4">{{ $gt(`DoctrineUpgradeSystem/${key}${item.value}`) }}</span>
                  </div>
                </td>
              </tr>
            </template>
            <template #item.id="{ item }">
              <v-checkbox v-model="model" :value="item.id"></v-checkbox>
            </template>
            <!-- <template #item.branch="{ item }">
                            <v-chip :color="item.color">{{ item.branch }}</v-chip>
                        </template> -->
          </v-data-table-virtual>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>
  </v-card>
</template>

<script setup lang="ts">
import { DoctrineUpgradeSystem_DoctrineType } from '@/generated/classes/DoctrineUpgradeSystem_DoctrineType';
import { useDataStore } from '@/stores/data';
import _ from 'lodash';
import { computed, getCurrentInstance, ref } from 'vue';

const model = defineModel<DoctrineUpgradeSystem_DoctrineType[]>();
const dataStore = useDataStore();

const tab = ref('one');

const DoctrineMap = {
  Afterlife: [
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_TraitSacrificeEnthusiast,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_TraitDesensitisedToDeath,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_RessurectionRitual,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_Funeral,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_TraitRespectElders,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_TraitOldDieYoung,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_BuildingReturnToEarth,
    DoctrineUpgradeSystem_DoctrineType.DeathSacrifice_BuildingGoodGraves,
  ],
  Food: [
    DoctrineUpgradeSystem_DoctrineType.Sustenance_Fast,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_Feast,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_TraitMushroomEncouraged,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_TraitMushroomBanned,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_TraitCannibal,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_TraitGrassEater,
    DoctrineUpgradeSystem_DoctrineType.Sustenance_TraitHarvestRitual,
  ],

  LawAndOrder: [
    DoctrineUpgradeSystem_DoctrineType.LawOrder_MurderFollower,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_AscendFollower,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_FightPitRitual,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_JudgementRitual,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_AssignFaithEnforcerRitual,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_AssignTaxCollectorRitual,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_TraitDisciplinarian,
    DoctrineUpgradeSystem_DoctrineType.LawOrder_TraitLibertarian
  ],
  Possession: [
    DoctrineUpgradeSystem_DoctrineType.Possessions_ExtortTithes,
    DoctrineUpgradeSystem_DoctrineType.Possessions_Bribe,
    DoctrineUpgradeSystem_DoctrineType.Possessions_MoreFaithFromHomes,
    DoctrineUpgradeSystem_DoctrineType.Possessions_MoreFaithFromRituals,
    DoctrineUpgradeSystem_DoctrineType.Possessions_TraitMaterialistic,
    DoctrineUpgradeSystem_DoctrineType.Possessions_TraitFalseIdols,
    DoctrineUpgradeSystem_DoctrineType.Possessions_AlmsToPoorRitual,
    DoctrineUpgradeSystem_DoctrineType.Possessions_DonationRitual
  ],
  WorkAndWorship: [
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_Inspire,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_Intimidate,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_FasterBuilding,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_Enlightenment,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_FaithfulTrait,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_GoodWorkerTrait,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_WorkThroughNightRitual,
    DoctrineUpgradeSystem_DoctrineType.WorkWorship_HolidayRitual
  ],
  Pleasure: [
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Nudist,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Purge,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_AtoneSin,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Cannibal,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Doctrinal_Extremist,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Violent_Extremist,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Fertility,
    DoctrineUpgradeSystem_DoctrineType.Pleasure_Allegiance
  ],
  Winter: [
    DoctrineUpgradeSystem_DoctrineType.Winter_FurnaceFollower,
    DoctrineUpgradeSystem_DoctrineType.Winter_FurnaceAnimal,
    DoctrineUpgradeSystem_DoctrineType.Winter_ConvertToRot,
    DoctrineUpgradeSystem_DoctrineType.Winter_RemoveRot,
    DoctrineUpgradeSystem_DoctrineType.Winter_WorkThroughBlizzard_Trait,
    DoctrineUpgradeSystem_DoctrineType.Winter_ColdEnthusiast_Trait,
    DoctrineUpgradeSystem_DoctrineType.Winter_RanchHarvest,
    DoctrineUpgradeSystem_DoctrineType.Winter_RanchMeat
  ],
};

const DLCKeys: Array<keyof typeof DoctrineMap> = ['Winter'];

const doctrineList = computed(() => {
  return _.pickBy(DoctrineMap, (v, k) => {
    if (DLCKeys.includes(k as any)) {
      return dataStore.isWoolHavenUnlocked;
    }

    return true;
  });
})

const headers = [
  { title: 'Unlocked?', key: 'id', sortable: false },
  { title: 'Name', key: 'name' },
  { title: 'Description', key: 'description' },
];

const groupBy = [{ key: 'group' }];


const app = getCurrentInstance()!;

function mapItem(v: DoctrineUpgradeSystem_DoctrineType, allGroup: DoctrineUpgradeSystem_DoctrineType[]) {
  const nameEnum = DoctrineUpgradeSystem_DoctrineType[v];

  const prefix = nameEnum.split('_')[0] as string;
  const prefixWithUnderscore = `${prefix}_`;

  // get all enum that start with prefix
  const group = Object.entries(DoctrineUpgradeSystem_DoctrineType)
    .filter(([k, v]) => k.startsWith(prefixWithUnderscore) && typeof v === 'number' && allGroup.includes(v as unknown as DoctrineUpgradeSystem_DoctrineType))
    .map(([_, v]) => v as unknown as DoctrineUpgradeSystem_DoctrineType);

  // const min = Math.min(...group);
  const currentIndex = group.indexOf(v);
  const groupIndex = Math.floor(currentIndex / 2) + 1;

  const name = app.appContext.config.globalProperties.$gt(`DoctrineUpgradeSystem/${nameEnum}`);
  const description = app.appContext.config.globalProperties.$gt(`DoctrineUpgradeSystem/${nameEnum}/Description`);

  return {
    name,
    description,
    nameEnum,
    id: v,
    group: groupIndex,
  };
}

function toTableData(data: DoctrineUpgradeSystem_DoctrineType[]) {
  return data.map((v) => mapItem(v, data));
}
</script>
