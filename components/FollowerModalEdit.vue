<template>
    <div ref="followerModalElement" class="modal fade show" tabindex="-1" aria-modal="true" role="dialog">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header modal-header--sticky">
                    <h5 class="modal-title">{{ getPropertyCaseInsensitive(props.followerData, "Name") }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row row-cols-1 row-cols-md-2 g-3">
                        <div class="col">
                            <label :for="makeFormId('ID')" class="form-label">Follower ID:</label>
                            <input v-model.number="formData.ID" type="number" class="form-control"
                                :id="makeFormId('ID')">
                            <span class="text-danger fw-bold" style="font-size:14px;">Changing IDs is dangerous
                                and can
                                corrupt your save file, back up your save first.</span>
                        </div>
                        <div class="col">
                            <label :for="makeFormId('Name')" class="form-label">Follower Name:</label>
                            <input v-model.number="formData.Name" type="text" class="form-control"
                                :id="makeFormId('Name')">
                        </div>
                        <div class="col">
                            <label :for="makeFormId('XPLevel')" class="form-label">Follower Level:</label>
                            <input v-model.number="formData.XPLevel" type="number" class="form-control" min="0" max="10"
                                :id="makeFormId('XPLevel')">
                        </div>
                        <div class="col">
                            <label :for="makeFormId('DayJoined')" class="form-label">Day Joined:</label>
                            <input v-model.number="formData.DayJoined" type="number" class="form-control" min="0"
                                :id="makeFormId('DayJoined')">
                        </div>
                        <div class="col">
                            <label :for="makeFormId('Age')" class="form-label">Follower
                                Age:</label>
                            <input v-model.number="formData.Age" type="number" class="form-control" min="0"
                                :id="makeFormId('Age')">

                        </div>
                        <div class="col">
                            <label :for="makeFormId('MemberDuration')" class="form-label">Days in your Cult:</label>
                            <input v-model.number="formData.MemberDuration" type="number" class="form-control" min="0"
                                :id="makeFormId('MemberDuration')">
                        </div>
                        <div class="col">
                            <label :for="makeFormId('LifeExpectancy')" class="form-label">Follower Life
                                Expectancy:</label>
                            <input v-model.number="formData.LifeExpectancy" type="number" class="form-control" min="0"
                                :id="makeFormId('LifeExpectancy')">
                        </div>
                        <div class="col">
                            <label :for="makeFormId('SacrificialValue')" class="form-label">Sacrificial
                                Value:</label>
                            <input v-model.number="formData.SacrificialValue" type="number" class="form-control" min="0"
                                :id="makeFormId('SacrificialValue')">
                        </div>

                    </div>
                    <hr>
                    <div class="row row-cols-1 row-cols-md-2 row-cols-lg-4 g-3 mb-3">
                        <div class="col">
                            <label :for="makeFormId('Outfit')">Follower Outfit:</label>
                            <select v-model.number="formData.Outfit" class="form-select" :id="makeFormId('Outfit')">
                                <option v-for="outfit of outfitList" :value="outfit.id"
                                    :key="`Outfit-${formData.ID}-${outfit.id}`">{{ outfit.name }}</option>
                            </select>
                        </div>
                        <div v-if="followerSkinList" class="col">
                            <label :for="makeFormId('SkinCharacter')">Follower Skin:</label>
                            <select v-model.number="formData.SkinCharacter" class="form-select"
                                :id="makeFormId('SkinCharacter')">
                                <option v-for="(followerSkin, index) of followerSkinList" :value="index"
                                    :key="`SkinCharacter-${formData.ID}-${index}`">{{
                                        followerSkin.name
                                    }}</option>
                            </select>
                        </div>
                        <div v-if="followerSkinList" class="col">
                            <label :for="makeFormId('SkinVariation')">Follower Variant:</label>
                            <select v-model.number="formData.SkinVariation" class="form-select"
                                :id="makeFormId('SkinVariation')">
                                <option v-for="(name, index) of followerSkinList[formData.SkinCharacter]?.variant ?? []"
                                    :value="index" :key="`SkinVariation-${formData.ID}-${index}`">{{ name }}</option>
                            </select>
                        </div>
                        <div class="col">
                            <label :for="makeFormId('Necklace')">Follower Necklace: </label>
                            <select v-model.number="formData.Necklace" class="form-select" :id="makeFormId('Necklace')">
                                <option v-for="necklace of necklaceList" :value="necklace.id"
                                    :key="`Necklace-${formData.ID}-${necklace.id}`">{{ necklace.name }}</option>
                            </select>
                        </div>
                    </div>
                    <br />
                    <div class="row">
                        <label>Follower Attribute: </label>
                        <div class="col">
                            <input v-model="formData.IsStarving" type="checkbox" class="form-check-input"
                                id="stravingIndicator">
                            <label class="form-check-label" for="stravingIndicator">&nbsp;Starving Indicator</label><br>
                            <input v-model="formData.MarriedToLeader" type="checkbox" class="form-check-input"
                                id="marriedToLeader">
                            <label class="form-check-label" for="marriedToLeader">&nbsp;Married to
                                Leader</label><br>
                        </div>
                        <div class="col">
                            <input v-model="formData.TaxEnforcer" type="checkbox" class="form-check-input"
                                id="taxEnforcer">
                            <label class="form-check-label" for="taxEnforcer">&nbsp;Tax Enforcer</label><br>
                            <input v-model="formData.FaithEnforcer" type="checkbox" class="form-check-input"
                                id="faithEnforcer">
                            <label class="form-check-label" for="faithEnforcer">&nbsp;Faith Enforcer</label><br>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col">
                            <div class="d-grid align-items-center justify-content-center py-3">
                                <NuxtImg loading="eager"
                                    :src='constructFollowerPreviewUrl(formData, false, props.isDead)'
                                    alt="Preview not available" quality="100" fit="inside" />
                            </div>
                        </div>
                    </div>
                    <hr />
                    <div class="row row-cols-1 row-cols-md-2 g-3 mb-3">
                        <div class="col">
                            You selected <span class="text-success"><span class="fw-bold">{{ totalPositiveTraits
                                    }}</span> positive trait(s)</span>, and <span class="text-danger"><span
                                    class="fw-bold">{{ totalNegativeTraits }}</span> negative trait(s)</span>.
                        </div>
                        <div class="col">
                            <input type="text" placeholder="Search..." class="form-control" v-model="serachTrait">
                        </div>
                    </div>
                    <div class="row">
                        <div class="col">
                            <table class="table table-striped">
                                <thead class="thead-dark">
                                    <tr>
                                        <th class="col">Unlocked?</th>
                                        <th class="col">Image</th>
                                        <th class="col">Effect</th>
                                        <th class="col">Name</th>
                                        <th class="col">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-if="['idle', 'pending', 'error'].includes(followerTraitLoading)">
                                        <td colspan="5" class="text-center">
                                            <div v-if="followerTraitLoading === 'error'">
                                                There was an error loading the follower traits
                                            </div>
                                            <div v-else class="spinner-border text-primary" role="status">
                                                <span class="visually-hidden">Loading...</span>
                                            </div>

                                        </td>
                                    </tr>
                                    <tr v-else v-for="trait in followerTraitListFiltered"
                                        :class="{ 'table-warning': trait.cultTrait }">
                                        <td class="col-1">
                                            <input v-model="formData.Traits" type="checkbox" class="form-check-input"
                                                :value="trait.id" :disabled="currentCultTraits?.includes(trait.id)">
                                        </td>
                                        <td class="col-1">
                                            <div class="center-container">
                                                <NuxtImg loading="eager" :src="trait.image"
                                                    class="image-inner small-size img-trait" alt="Image not available"
                                                    width="64" height="64" quality="100" fit="inside"
                                                    :title="trait.name" />
                                            </div>
                                        </td>
                                        <td class="col-1">
                                            <span v-if="trait.effect === 'Positive'"
                                                class="text-success">Positive</span>
                                            <span v-else class="text-danger">Negative</span>
                                        </td>
                                        <td class="col">
                                            {{ trait.name }}
                                        </td>
                                        <td class="col">
                                            <p>{{ trait.description }}</p>
                                            <p v-if="trait.cultTrait" class="fw-bold">This should be disable if thecult
                                                trait is enabled</p>
                                            <p v-if="currentCultTraits?.includes(trait.id)" class="text-danger fw-bold">
                                                This trait is currently disabled as it conflicts with a cult trait</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <hr>
                    <div class="row">
                        <div class="col">
                            <label>Adoration (XP to next level): </label>
                            <input v-model.number="formData.Adoration" type="range" class="form-range" min="0" max="100"
                                step="1">
                            <p>{{ formData.Adoration }}</p>
                            <label>Faith: </label>
                            <input v-model.number="formData.Faith" type="range" class="form-range" min="0" max="100"
                                step="1">
                            <p>{{ formData.Faith }}</p>
                            <label>Happiness: </label>
                            <input v-model.number="formData.Happiness" type="range" class="form-range" min="0" max="100"
                                step="1">
                            <p>{{ formData.Happiness }}</p>
                            <label>Illness: </label>
                            <input v-model.number="formData.Illness" type="range" class="form-range" min="0" max="100"
                                step="1" />
                            <p>{{ formData.Illness }}</p>
                            <label>Reeducation: </label>
                            <input v-model.number="formData.Reeducation" type="range" class="form-range" min="0"
                                max="100" step="1" />
                            <p>{{ formData.Reeducation }}</p>
                        </div>
                        <div class="col">
                            <label>Exhaustion: </label>
                            <input v-model.number="formData.Exhaustion" type="range" class="form-range" min="0"
                                max="100" step="1" />
                            <p>{{ formData.Exhaustion }}</p>
                            <label>Rest: </label>
                            <input v-model.number="formData.Rest" type="range" class="form-range" min="0" max="100"
                                step="1" />
                            <p>{{ formData.Rest }}</p>
                            <label>Starvation: </label>
                            <input v-model.number="formData.Starvation" type="range" class="form-range" min="0" max="75"
                                step="1" />
                            <p>{{ formData.Starvation }}</p>
                            <label>Satiation: </label>
                            <input v-model.number="formData.Satiation" type="range" class="form-range" min="0" max="100"
                                step="1" />
                            <p>{{ formData.Satiation }}</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer modal-footer--sticky">
                    <button type="button" class="btn btn-success" v-show="isChanged" @click="save">Save changes</button>
                    <button type="button" class="btn btn-warning" v-show="isChanged" @click="reset">Reset</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { constructFollowerPreviewUrl, getPropertyCaseInsensitive, setPropertyCaseInsensitive } from '~/utils/utility';
import { Modal } from "bootstrap";
import type { Follower, JsonSaveFile } from '~/types/save';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';

const showModal = defineModel<boolean>();
const followerModalElement = ref<HTMLElement>();
const followerModal = ref<Modal>();
const serachTrait = ref("");
const dataStore = useSaveData();

type FollowerTrait = {
    id: number;
    image: string;
    effect: "Positive" | "Negative";
    name: string;
    description: string;
}

const { data: followerTraitList, status: followerTraitLoading } = useFetch<FollowerTrait[]>("/data/followerTrait.json");
const { data: followerSkinList } = useFetch<{ name: string; variant: string[]; }[]>("/data/followerSkin.json");
const { data: traitData } = useFetch<Array<{ name: string, leftBranch: Array<{ id: number }>, rightBranch: Array<{ id: number }> }>>("/data/traitData.json");
const { data: necklaceList } = useFetch<{ id: number, name: string }[]>("/data/necklaces.json");
const { data: outfitList } = useFetch<{ id: number, name: string }[]>("/data/followerOutfit.json");

const props = defineProps<{ followerData: Follower, isDead?: boolean }>();
// copy from props
const formData = ref({
    ID: props.followerData.ID,
    XPLevel: props.followerData.XPLevel,
    Age: props.followerData.Age,
    LifeExpectancy: props.followerData.LifeExpectancy,
    Name: props.followerData.Name,
    DayJoined: props.followerData.DayJoined,
    MemberDuration: props.followerData.MemberDuration,
    SacrificialValue: props.followerData.SacrificialValue,
    Outfit: props.followerData.Outfit,
    SkinCharacter: props.followerData.SkinCharacter,
    SkinVariation: props.followerData.SkinVariation,
    SkinColour: props.followerData.SkinColour,
    SkinName: props.followerData.SkinName,
    Necklace: props.followerData.Necklace,
    IsStarving: props.followerData.IsStarving,
    MarriedToLeader: props.followerData.MarriedToLeader,
    TaxEnforcer: props.followerData.TaxEnforcer,
    FaithEnforcer: props.followerData.FaithEnforcer,
    Traits: Array.from(props.followerData.Traits),
    Adoration: props.followerData.Adoration,
    Faith: props.followerData.Faith,
    Happiness: props.followerData.Happiness,
    Illness: props.followerData.Illness,
    Reeducation: props.followerData.Reeducation,
    Exhaustion: props.followerData.Exhaustion,
    Rest: props.followerData.Rest,
    Starvation: props.followerData.Starvation,
    Satiation: props.followerData.Satiation,
});

const allCultTraits = computed(() => {
    const traits = new Set<number>();

    traitData.value?.forEach(trait => {
        trait.leftBranch?.forEach(trait => traits.add(trait.id));
        trait.rightBranch?.forEach(trait => traits.add(trait.id));
    });

    return Array.from(traits);
});

const currentCultTraits = computed(() => {
    return getPropertyCaseInsensitive(dataStore.saveData, "CultTraits");
});

const allFollowerTraits = computed(() => {
    const traits: Array<FollowerTrait & { cultTrait?: boolean }> = followerTraitList.value ?? [];


    traits.forEach(trait => {
        trait.cultTrait = allCultTraits.value.includes(trait.id);
    });

    return traits.sort((a, b) => {
        // sort by effect, positive first
        const effectSort = { Positive: 0, Negative: 1 };

        if (effectSort[a.effect] != effectSort[b.effect]) {
            return effectSort[a.effect] - effectSort[b.effect];
        }

        // sort by name
        return a.name.localeCompare(b.name);
    });
});

const followerTraitListFiltered = computed(() => {
    const filtered = allFollowerTraits.value.filter(trait => {
        if (trait.name.toLowerCase().includes(serachTrait.value.toLowerCase())) {
            return true;
        }

        return trait.description.toLowerCase().includes(serachTrait.value.toLowerCase());
    });

    return filtered;
});

const makeFormId = (name: string) => `follower-modal-edit-${name}-${props.followerData.ID}`;

const totalPositiveTraits = computed(() => {
    return formData.value.Traits.filter(traitID => followerTraitList.value?.find(trait => trait.id === traitID)?.effect === "Positive").length;
});

const totalNegativeTraits = computed(() => {
    return formData.value.Traits.filter(traitID => followerTraitList.value?.find(trait => trait.id === traitID)?.effect === "Negative").length;
});

const reset = () => {
    for (const key of Object.keys(formData.value) as Array<keyof typeof formData.value>) {
        Reflect.set(formData.value, key, cloneDeep(props.followerData[key]));
    }
};

const isChanged = computed(() => {
    for (const [key, value] of Object.entries(formData.value)) {
        if (!isEqual(value, getPropertyCaseInsensitive(props.followerData, key))) {
            return true;
        }
    }

    return false;
});

onMounted(() => {
    if (!followerModalElement.value) return;

    followerModal.value = new Modal(followerModalElement.value, {
        keyboard: false
    });

    followerModalElement.value.addEventListener("show.bs.modal", () => showModal.value = true);
    followerModalElement.value.addEventListener("hide.bs.modal", () => showModal.value = false);
});

const updateSkin = () => {
    if (!followerSkinList.value) {
        return;
    }

    let skinName = followerSkinList.value[getPropertyCaseInsensitive(props.followerData, "SkinCharacter")]?.variant[getPropertyCaseInsensitive(props.followerData, "SkinVariation")];
    if (!skinName) {
        props.followerData.SkinVariation = 0;
        skinName = followerSkinList.value[getPropertyCaseInsensitive(props.followerData, "SkinCharacter")]?.variant[getPropertyCaseInsensitive(props.followerData, "SkinVariation")];
    };

    if (!skinName || /^Unknown Skin/.test(skinName)) {
        alert("Please not use the unknown skin, it may break the game. Add a new skin in Github instead.");
        formData.value.SkinCharacter = props.followerData.SkinCharacter;
        formData.value.SkinVariation = props.followerData.SkinVariation;
        formData.value.SkinName = props.followerData.SkinName;
        formData.value.SkinColour = props.followerData.SkinColour;
        return;
    }

    formData.value.SkinName = skinName;
}

type RefData<T> = T extends Ref<infer U> ? U : T;
export type FollowerEditEvent = RefData<typeof formData>;

const saveEvent = defineEmits<{ save: [FollowerEditEvent, number] }>();


const save = () => {
    saveEvent("save", cloneDeep(formData.value), props.followerData.ID);
    showModal.value = false;
}

watch(() => formData.value?.SkinCharacter, updateSkin);
watch(() => formData.value?.SkinVariation, updateSkin);
watch(() => props.followerData, () => reset());
watch(showModal, (newValue) => {
    if (newValue) {
        followerModal.value?.show();
    } else {
        followerModal.value?.hide();
    }
});


defineExpose({
    modal: followerModal
});

</script>