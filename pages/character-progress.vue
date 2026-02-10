<template>
    <div v-if="saveStore.saveData">
        <h2>Character &amp; Progress</h2>
        <hr />
        <h4>Hearts</h4>
        <div class="row mb-4">
            <div class="col-md-3">
                <label for="PLAYER_HEALTH">Red Hearts:</label>
                <input v-model="playerHealth" type="number" step="0.5" class="form-control" id="PLAYER_HEALTH">
            </div>
            <div class="col-md-3">
                <label for="PLAYER_SPIRIT_HEARTS">Spirit Hearts:</label>
                <input v-model="playerSpiritHealth" type="number" step="0.5" class="form-control" id="PLAYER_SPIRIT_HEARTS">
            </div>
            <div class="col-md-3">
                <label for="PLAYER_BLACK_HEARTS">Diseased Hearts:</label>
                <input v-model="playerBlackHealth" type="number" step="0.5" class="form-control" id="PLAYER_BLACK_HEARTS">
            </div>
            <div class="col-md-3">
                <label for="PLAYER_BLUE_HEARTS">Blue Hearts:</label>
                <input v-model="playerBlueHealth" type="number" step="0.5" class="form-control" id="PLAYER_BLUE_HEARTS">
            </div>
        </div>

        <h4>Stats</h4>
        <div class="row mb-4">
            <div class="col-md-3">
                <label for="playerDeaths">Player Deaths:</label>
                <input v-model="playerDeaths" type="number" class="form-control" id="playerDeaths">
            </div>
            <div class="col-md-3">
                <label for="killsInGame">Kills in Game:</label>
                <input v-model="killsInGame" type="number" class="form-control" id="killsInGame">
            </div>
        </div>

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

        <h4>Dungeon Progress</h4>
        <table class="table table-sm">
            <thead>
                <tr>
                    <th>Dungeon</th>
                    <th>Beaten?</th>
                    <th>Depth</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="d in dungeonProgress" :key="d.field">
                    <td>{{ d.name }}</td>
                    <td><input v-model="d.beaten.value" type="checkbox" class="form-check-input"></td>
                    <td><input v-model="d.layer.value" type="number" min="1" class="form-control form-control-sm d-inline-block" style="width: 5em;"></td>
                </tr>
            </tbody>
        </table>

        <h4>Boss Progress</h4>
        <div class="row mb-3">
            <div class="col-md-6">
                <h6>Bishop Rematches</h6>
                <div v-for="b in bishopProgress" :key="b.field">
                    <input v-model="b.model.value" type="checkbox" class="form-check-input" :id="b.field">
                    <label :for="b.field">&nbsp;{{ b.name }}</label>
                </div>
            </div>
            <div class="col-md-6">
                <h6>Mystic Keepers</h6>
                <div v-for="m in mysticProgress" :key="m.field">
                    <input v-model="m.model.value" type="checkbox" class="form-check-input" :id="m.field">
                    <label :for="m.field">&nbsp;{{ m.name }}</label>
                </div>
            </div>
        </div>

        <h4>Witness Dungeons (Post-Game)</h4>
        <div class="row mb-3">
            <div v-for="w in witnessProgress" :key="w.field" class="col-auto">
                <input v-model="w.model.value" type="checkbox" class="form-check-input" :id="w.field">
                <label :for="w.field">&nbsp;{{ w.name }}</label>
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
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { generateObjectInsensitiveComputed, getPropertyCaseInsensitive, setPropertyCaseInsensitive } from "~/utils/utility";
import { useSaveData } from "~/stores/saveData";
import { useSiteData } from "~/stores/siteData";

const { data: dungeonData } = useFetch<{ id: number, name: string }[][]>('/data/dungeonData.json');

const saveStore = useSaveData();
const siteData = useSiteData();

const unlockedDungeonDoor = generateObjectInsensitiveComputed(() => saveStore.saveData, "UnlockedDungeonDoor");

const deathCatBeaten = generateObjectInsensitiveComputed(() => saveStore.saveData, "DeathCatBeaten");
const ratauKilled = generateObjectInsensitiveComputed(() => saveStore.saveData, "RatauKilled");

function heartComputed(property: string) {
  return computed({
    get() {
      const raw = getPropertyCaseInsensitive(saveStore.saveData, property) as number;
      return raw != null ? raw / 2 : raw;
    },
    set(value: number) {
      setPropertyCaseInsensitive(saveStore.saveData, property, value * 2);
    },
  });
}

const playerHealth = heartComputed("PLAYER_HEALTH");
const playerSpiritHealth = heartComputed("PLAYER_SPIRIT_HEARTS");
const playerBlackHealth = heartComputed("PLAYER_BLACK_HEARTS");
const playerBlueHealth = heartComputed("PLAYER_BLUE_HEARTS");

const playerDeaths = generateObjectInsensitiveComputed(() => saveStore.saveData, "playerDeaths");
const killsInGame = generateObjectInsensitiveComputed(() => saveStore.saveData, "KillsInGame");

const dungeonProgressDefs = [
  { name: 'Darkwood (Leshy)', field: 'BeatenDungeon1' as const, layerField: 'Dungeon1_Layer' as const },
  { name: 'Anura (Heket)', field: 'BeatenDungeon2' as const, layerField: 'Dungeon2_Layer' as const },
  { name: 'Anchordeep (Kallamar)', field: 'BeatenDungeon3' as const, layerField: 'Dungeon3_Layer' as const },
  { name: 'Silk Cradle (Shamura)', field: 'BeatenDungeon4' as const, layerField: 'Dungeon4_Layer' as const },
  { name: 'Pilgrim\'s Passage (DLC)', field: 'BeatenDungeon5' as const, layerField: 'Dungeon5_Layer' as const },
  { name: 'Rot Realm (DLC)', field: 'BeatenDungeon6' as const, layerField: 'Dungeon6_Layer' as const },
];
const dungeonProgress = dungeonProgressDefs.map(d => ({
  ...d,
  beaten: generateObjectInsensitiveComputed(() => saveStore.saveData, d.field),
  layer: generateObjectInsensitiveComputed(() => saveStore.saveData, d.layerField),
}));

const bishopProgress = ([
  { name: 'Leshy', field: 'BeatenLeshyLayer2' as const },
  { name: 'Heket', field: 'BeatenHeketLayer2' as const },
  { name: 'Kallamar', field: 'BeatenKallamarLayer2' as const },
  { name: 'Shamura', field: 'BeatenShamuraLayer2' as const },
]).map(b => ({
  ...b,
  model: generateObjectInsensitiveComputed(() => saveStore.saveData, b.field),
}));

const mysticProgress = ([
  { name: 'Leshy', field: 'MysticKeeperBeatenLeshy' as const },
  { name: 'Heket', field: 'MysticKeeperBeatenHeket' as const },
  { name: 'Kallamar', field: 'MysticKeeperBeatenKallamar' as const },
  { name: 'Shamura', field: 'MysticKeeperBeatenShamura' as const },
  { name: 'Yngya', field: 'MysticKeeperBeatenYngya' as const },
  { name: 'All Keepers', field: 'MysticKeeperBeatenAll' as const },
]).map(m => ({
  ...m,
  model: generateObjectInsensitiveComputed(() => saveStore.saveData, m.field),
}));

const witnessProgress = ([
  { name: 'Witness 1', field: 'BeatenWitnessDungeon1' as const },
  { name: 'Witness 2', field: 'BeatenWitnessDungeon2' as const },
  { name: 'Witness 3', field: 'BeatenWitnessDungeon3' as const },
  { name: 'Witness 4', field: 'BeatenWitnessDungeon4' as const },
]).map(w => ({
  ...w,
  model: generateObjectInsensitiveComputed(() => saveStore.saveData, w.field),
}));

const deathCatBeatenWarningModal = ref(null);

const deathCatClick = () => {
    if (siteData.deathCatWarningAcknowledged || !deathCatBeatenWarningModal.value) return;
    (deathCatBeatenWarningModal.value as any).modal?.toggle();
    siteData.deathCatWarningAcknowledged = true;
}
</script>
