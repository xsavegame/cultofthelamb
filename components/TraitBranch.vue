<template>
    <div class="tab-content my-3">
        <div class="tab-pane fade show active" id="nav-cult-traits-sustenance" role="tabpanel"
            aria-labelledby="nav-cult-traits-sustenance-tab">
            <div class="row">
                <div class="col">
                    <h3>Left Branch</h3>
                    <hr>
                    <table class="table">
                        <thead>
                            <tr>
                                <th class="col">Unlocked?</th>
                                <th class="col">Image</th>
                                <th class="col">Name</th>
                                <th class="col">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(traitData, index) in props.leftBranch">
                                <td class="col">
                                    <input type="checkbox" class="form-check-input" :value="traitData.id" v-model="currentCultTraits">
                                </td>
                                <td class="col" style="background-color:black;">
                                    <div class="center-container">
                                        <NuxtImg loading="eager" :src="traitData.image" class="image-inner small-size"
                                            alt="Image not available" width="64" height="64" quality="100"
                                            fit="inside" />
                                    </div>
                                </td>
                                <td class="col">
                                    <label class="form-check-label" :for="`CultTraits_${traitData.id}`">{{
                                        traitData.name
                                    }}</label>
                                </td>
                                <td class="col">
                                    <label class="form-check-label" :for="`CultTraits_${traitData.id}`">{{
                                        traitData.description
                                    }}</label>
                                </td>
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
                                <th class="col">Image</th>
                                <th class="col">Name</th>
                                <th class="col">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(traitData, index) in props.rightBranch">
                                <td class="col">
                                    <input type="checkbox" class="form-check-input" :value="traitData.id" v-model="currentCultTraits">
                                </td>
                                <td class="col" style="background-color:black;">
                                    <div class="center-container">
                                        <NuxtImg loading="eager" :src="traitData.image" class="image-inner small-size"
                                            alt="Image not available" width="64" height="64" quality="100"
                                            fit="inside" />
                                    </div>
                                </td>
                                <td class="col">
                                    <label class="form-check-label" :for="`CultTraits_${traitData.id}`">{{
                                        traitData.name
                                    }}</label>
                                </td>
                                <td class="col">
                                    <label class="form-check-label" :for="`CultTraits_${traitData.id}`">{{
                                        traitData.description
                                    }}</label>
                                </td>
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
import { getPropertyCaseInsensitive, setPropertyCaseInsensitive } from '~/utils/utility';
import { useSaveData } from '~/stores/saveData';

type TraitData = {
    id: number;
    image: string;
    name: string;
    description: string;
}

const selectedTrait = ref<number[]>([]);
const saveStore = useSaveData();

const props = defineProps<{
    leftBranch: TraitData[];
    rightBranch: TraitData[];
    saveData: JsonSaveFile;
}>();

const currentCultTraits = generateObjectInsensitiveComputed(() => saveStore.saveData, "CultTraits");

// const updateClick = () => {
//     const checkTrait = (id: number, value: boolean) => {

//         const cultTraits = getPropertyCaseInsensitive(props.saveData, "CultTraits");

//         if (value && cultTraits) cultTraits.push(id);
//         else if (!value) {
//             setPropertyCaseInsensitive(props.saveData, "CultTraits", cultTraits.filter(
//                 (traitId: number) => traitId !== id
//             ));

//             saveStore.checkCultTraits();
//         }
//     }

//     for (const [index, value] of selectedTrait.value.entries()) {
//         if (props.leftBranch[index]) checkTrait(props.leftBranch[index].id, value === 1);
//         if (props.rightBranch[index]) checkTrait(props.rightBranch[index].id, value === 2);
//     }
// }

// const updateSelected = () => {
//     if (props.saveData) {
//         const checkBranch = (traits: TraitData[], value: number) => {
//             const cultTraits = getPropertyCaseInsensitive(props.saveData, "CultTraits");

//             for (const [index, trait] of traits.entries())
//                 if (cultTraits.includes(trait.id))
//                     selectedTrait.value[index] = value;
//         }

//         selectedTrait.value = [];
//         checkBranch(props.leftBranch, 1);
//         checkBranch(props.rightBranch, 2);
//     }
// }

// watch(() => props.leftBranch, updateSelected);
// watch(() => props.rightBranch, updateSelected);
// watch(() => props.saveData, updateSelected);

// onMounted(() => {
//     updateSelected();
// })
</script>