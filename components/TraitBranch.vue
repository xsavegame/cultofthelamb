<template>
    <div class="tab-content my-3">
        <div class="tab-pane fade show active" role="tabpanel">
            <div class="row">
                <div class="col">
                    <h3>Left Branch</h3>
                    <hr>
                    <table class="table">
                        <thead>
                            <tr>
                                <th class="col">Unlocked?</th>
                                <th class="col">Name</th>
                                <th class="col">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="traitData in props.leftBranch" :key="traitData.id">
                                <td class="col">
                                    <input type="checkbox" class="form-check-input" :value="traitData.id" v-model="doctrineUpgrades">
                                </td>
                                <td class="col">{{ traitData.name }} <span :class="badgeClass(traitData.type)">{{ traitData.type }}</span></td>
                                <td class="col">{{ traitData.description }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="col">
                    <h3>Right Branch</h3>
                    <hr>
                    <table class="table">
                        <thead>
                            <tr>
                                <th class="col">Unlocked?</th>
                                <th class="col">Name</th>
                                <th class="col">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="traitData in props.rightBranch" :key="traitData.id">
                                <td class="col">
                                    <input type="checkbox" class="form-check-input" :value="traitData.id" v-model="doctrineUpgrades">
                                </td>
                                <td class="col">{{ traitData.name }} <span :class="badgeClass(traitData.type)">{{ traitData.type }}</span></td>
                                <td class="col">{{ traitData.description }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { JsonSaveFile } from '~/types/save';
import { generateObjectInsensitiveComputed } from '~/utils/utility';
import { useSaveData } from '~/stores/saveData';

type TraitData = {
    id: number;
    name: string;
    description: string;
    type: string;
}

const saveStore = useSaveData();

const props = defineProps<{
    leftBranch: TraitData[];
    rightBranch: TraitData[];
    saveData: JsonSaveFile;
}>();

const doctrineUpgrades = generateObjectInsensitiveComputed(() => saveStore.saveData, "DoctrineUnlockedUpgrades");

const badgeClass = (type: string) => {
    switch (type) {
        case 'Trait': return 'badge bg-success';
        case 'Ritual': return 'badge bg-primary';
        case 'Building': return 'badge bg-warning text-dark';
        case 'Ability': return 'badge bg-info text-dark';
        default: return 'badge bg-secondary';
    }
};
</script>
