<template>
    <div v-if="saveStore.saveData">
        <h2>Cult Information</h2>
        <hr />
        <div class="row mb-4">
            <div class="col-md-4">
                <label for="CultName">Cult Name:</label>
                <input v-model="cultName" type="text" class="form-control" id="CultName" />
            </div>
            <div class="col-md-4">
                <label for="CurrentDayIndex">Current Day:</label>
                <input v-model="currentDayIndex" type="number" class="form-control" id="CurrentDayIndex" />
            </div>
            <div class="col-md-4">
                <label for="missionariesCompleted">Missionaries Completed:</label>
                <input v-model="missionariesCompleted" type="number" class="form-control" id="missionariesCompleted" />
            </div>
        </div>
        <h2>Doctrine Upgrades</h2>
        <hr />
        <nav>
            <div class="nav nav-tabs" id="nav-tab" role="tablist">
                <button v-for="(data, index) of traitData"
                    :class="[SelectedTraitTab === index ? 'active' : '', 'nav-link']" data-bs-toggle="tab" type="button"
                    tabindex="-1" role="tab" :aria-selected="SelectedTraitTab === index"
                    @click="() => SelectedTraitTab = index">
                    {{ data.name }}
                </button>
            </div>
        </nav>
        <TraitBranch v-if="traitData" :left-branch="traitData[SelectedTraitTab].leftBranch"
            :right-branch="traitData[SelectedTraitTab].rightBranch" :save-data="saveStore.saveData" />
        <h2>Cooking Recipes</h2>
        <hr />
        <table class="table">
            <thead>
                <tr>
                    <th>Unlocked?</th>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Effects</th>
                    <th>Ingredients</th>
                    <th>Category</th>
                    <th>Quality</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="recipe in recipeData">
                    <td>
                        <input v-model="recipesDiscovered" type="checkbox" class="form-check-input" :value="recipe.id">
                    </td>
                    <td>
                        <div class="center-container">
                            <NuxtImg loading="eager" :src="recipe.image" alt="Image not available"
                                class="image-inner smalls-ize" quality="100" width="64px" height="64px" fit="inside" />
                        </div>
                    </td>
                    <td>
                        {{ recipe.name }}
                    </td>
                    <td>
                        {{ recipe.description }}
                    </td>
                    <td>
                        {{ recipe.effect }}
                    </td>
                    <td>
                        {{ recipe.ingredient }}
                    </td>
                    <td>
                        {{ recipe.category }}
                    </td>
                    <td>
                        {{ recipe.quality }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { generateObjectInsensitiveComputed } from "~/utils/utility";
import { useSaveData } from "~/stores/saveData";

const { data: traitData } = useFetch<{ name: string, leftBranch: { id: number, name: string, description: string, type: string }[], rightBranch: { id: number, name: string, description: string, type: string }[] }[]>('/data/traitData.json');
const { data: recipeData } = useFetch<{ id: number, image: string, name: string, description: string, effect: string, ingredient: string, category: string, quality: string }[]>('/data/cookingRecipe.json');

const saveStore = useSaveData();

const currentDayIndex = generateObjectInsensitiveComputed(() => saveStore.saveData, "CurrentDayIndex");
const cultName = generateObjectInsensitiveComputed(() => saveStore.saveData, "CultName");
const missionariesCompleted = generateObjectInsensitiveComputed(() => saveStore.saveData, "MissionariesCompleted");

const recipesDiscovered = generateObjectInsensitiveComputed(() => saveStore.saveData, "RecipesDiscovered");

const SelectedTraitTab = ref<number>(0);
</script>
