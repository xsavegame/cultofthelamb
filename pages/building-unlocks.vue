<template>
    <div v-if="saveStore.saveData">
        <h2>Building Unlocks</h2>
        <hr />
        <div v-for="category in buildingData" :key="category.category" class="mb-4">
            <h4>{{ category.category }}</h4>
            <table class="table">
                <thead>
                    <tr>
                        <th>Unlocked?</th>
                        <th>Name</th>
                        <th>ID</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="structure in category.structures" :key="structure.id"
                        :class="{ 'text-muted': structure.legacy }">
                        <td>
                            <input v-model="unlockedUpgrades" type="checkbox" class="form-check-input"
                                :value="structure.id">
                        </td>
                        <td>
                            {{ structure.name }}
                            <span v-if="structure.legacy" class="badge bg-secondary ms-1">Legacy</span>
                        </td>
                        <td><code>{{ structure.id }}</code></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { generateObjectInsensitiveComputed } from "~/utils/utility";
import { useSaveData } from "~/stores/saveData";

const { data: buildingData } = useFetch<{ category: string, structures: { id: number, name: string, legacy?: boolean }[] }[]>('/data/buildingData.json');

const saveStore = useSaveData();

const unlockedUpgrades = generateObjectInsensitiveComputed(() => saveStore.saveData, "UnlockedUpgrades");
</script>
