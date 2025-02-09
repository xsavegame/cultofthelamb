<template>
    <div v-if="saveStore.saveData">
        <h2>Cult Information &amp; Character Stats</h2>
        <hr />
        <div class="row mb-2">
            <div class="col">
                <label for="CultName">Cult Name:</label>
                <input v-model="cultName" type="text" class="form-control" id="CultName" />
                <br />
                <label for="CurrentDayIndex">Current Day:</label>
                <input v-model="currentDayIndex" type="number" class="form-control" id="CurrentDayIndex" />
                <br />
                <h4>Dungeon Doors Unlocked</h4>
                <div class="row mb-4">
                    <div v-for="dungeon in dungeonData" class="col">
                        <div v-for="dungeonData of dungeon">
                            <input v-model="unlockedDungeonDoor" type="checkbox" class="form-check-input"
                                :id="`dungeon_${dungeonData.id}`" :value="dungeonData.id">
                            <label class="form-check-label" :for="`dungeon_${dungeonData.id}`">&nbsp;{{
                                    dungeonData.name
                            }}</label>
                        </div>
                    </div>
                </div>
                <button class="btn btn-danger" type="button" data-bs-toggle="collapse" data-bs-target="#collapseExample"
                    aria-expanded="false" aria-controls="collapseExample">
                    Spoiler section
                </button>
                <p />
                <div class="collapse" id="collapseExample">
                    <div class="card card-body">
                        <div class="row">
                            <div class="col">
                                <input v-model="deathCatBeaten" type="checkbox" class="form-check-input"
                                    id="DeathCatBeaten" @click="deathCatClick">
                                <label for="DeathCatBeaten">&nbsp;The One Who Waits Beaten</label>
                            </div>
                            <div class="col">
                                <input v-model="ratauKilled" type="checkbox" class="form-check-input" id="RatauKilled">
                                <label for="RatauKilled">&nbsp;Ratau Killed</label>
                            </div>
                        </div>
                        <DeathCatBeatenWarningModal ref="deathCatBeatenWarningModal" />
                    </div>
                </div>
            </div>
            <div class="col">
                <label for="PLAYER_HEALTH">Red Hearts: <span class="text-muted" style="font-size:12px;">1 unit =
                        half a
                        heart (i.e 10 = 5 hearts)</span></label>
                <input v-model="playerHealth" type="number" class="form-control" id="PLAYER_HEALTH"><br>
                <label for="PLAYER_SPIRIT_HEARTS">Spirit Hearts:</label>
                <input v-model="playerSpiritHealth" type="number" class="form-control" id="PLAYER_SPIRIT_HEARTS"><br>
                <label for="PLAYER_BLACK_HEARTS">Diseased Hearts:</label>
                <input v-model="playerBlackHealth" type="number" class="form-control" id="PLAYER_BLACK_HEARTS"><br>
                <label for="PLAYER_BLUE_HEARTS">Blue Hearts:</label>
                <input v-model="playerBlueHealth" type="number" class="form-control" id="PLAYER_BLUE_HEARTS"><br>
            </div>
        </div>
        <h2>Cult Traits</h2>
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
import { useSiteData } from "~/stores/siteData";

const { data: traitData } = useFetch<{ name: string, leftBranch: { id: number, image: string, name: string, description: string }[], rightBranch: { id: number, image: string, name: string, description: string }[] }[]>('/data/traitData.json');
const { data: recipeData } = useFetch<{ id: number, image: string, name: string, description: string, effect: string, ingredient: string, category: string, quality: string }[]>('/data/cookingRecipe.json');
const { data: dungeonData } = useFetch<{ id: number, name: string }[][]>('/data/dungeonData.json');

const saveStore = useSaveData();
const siteData = useSiteData();

const unlockedDungeonDoor = generateObjectInsensitiveComputed(() => saveStore.saveData, "UnlockedDungeonDoor");
const currentDayIndex = generateObjectInsensitiveComputed(() => saveStore.saveData, "CurrentDayIndex");
const cultName = generateObjectInsensitiveComputed(() => saveStore.saveData, "CultName");

const deathCatBeaten = generateObjectInsensitiveComputed(() => saveStore.saveData, "DeathCatBeaten");
const ratauKilled = generateObjectInsensitiveComputed(() => saveStore.saveData, "RatauKilled");

const playerHealth = generateObjectInsensitiveComputed(() => saveStore.saveData, "PLAYER_HEALTH");
const playerSpiritHealth = generateObjectInsensitiveComputed(() => saveStore.saveData, "PLAYER_SPIRIT_HEARTS");
const playerBlackHealth = generateObjectInsensitiveComputed(() => saveStore.saveData, "PLAYER_BLACK_HEARTS");
const playerBlueHealth = generateObjectInsensitiveComputed(() => saveStore.saveData, "PLAYER_BLUE_HEARTS");

const recipesDiscovered = generateObjectInsensitiveComputed(() => saveStore.saveData, "RecipesDiscovered");

const deathCatBeatenWarningModal = ref(null);
const SelectedTraitTab = ref<number>(0);

const deathCatClick = () => {
    if (siteData.deathCatWarningAcknowledged || !deathCatBeatenWarningModal.value) return;
    (deathCatBeatenWarningModal.value as any).modal?.toggle();
    siteData.deathCatWarningAcknowledged = true;
}
</script>