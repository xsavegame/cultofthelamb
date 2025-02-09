<template>
    <div v-if="saveStore.saveData">
        <div v-if="getPropertyCaseInsensitive(saveStore.saveData, 'Followers').length > 0">
            <FollowerModalEdit v-if="selectedFollower" ref="followerModalEdit" :follower-data="selectedFollower"
                v-model="shouldShowModal" @save="saveFollower" />
            <div class="row mb-3">
                <div class="col-12 col-lg-6 offset-lg-6">
                    <input type="text" class="form-control" id="searchFollower" v-model="searchFollower"
                        placeholder="Search follower">
                </div>
            </div>
            <div class="row row-cols-1 row-cols-sm-2 row-cols-md-4 row-cols-lg-6 mb-4 gap-3">
                <div v-for="follower in filteredFollowers" class="card">
                    <div class="center-container">
                        <NuxtImg loading="eager" :src='constructFollowerPreviewUrl(follower, true)'
                            class="card-img-top image-inner small-size" alt="Image not available" width="64" height="64"
                            quality="100" fit="inside" />
                    </div>
                    <div class="card-body">
                        <p class="card-title h6">
                            {{ getPropertyCaseInsensitive(follower, 'Name') }}
                        </p>
                        <p class="card-text">
                            Level: <span class="fw-bold">{{ getPropertyCaseInsensitive(follower, 'XPLevel') }}</span>
                        </p>
                        <div class="row">
                            <div class="col">
                                <button type="button" class="btn btn-danger"
                                    @click="() => deleteFollower(getPropertyCaseInsensitive(follower, 'ID'))">
                                    Delete
                                </button>
                            </div>
                            <div class="col text-end">
                                <button type="button" class="btn btn-primary" @click="() => editFollower(follower)">
                                    Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <p v-else>You have no follower!</p>
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { constructFollowerPreviewUrl, getPropertyCaseInsensitive, setPropertyCaseInsensitive } from '~/utils/utility';
import { useSaveData } from '~/stores/saveData';
import type { Follower } from '~/types/save';
import type { FollowerEditEvent } from '~/components/FollowerModalEdit.vue';

const selectedFollower = ref<any>();
const followerModalEdit = ref<HTMLElement & { modal: any | undefined }>();
const shouldShowModal = ref(false);
const searchFollower = ref("");
const saveStore = useSaveData();

const editFollower = async (followerData: Follower) => {
    selectedFollower.value = followerData;

    await new Promise<void>(async (resolve) => {
        while (!followerModalEdit.value) {
            await new Promise<void>((r) => setTimeout(r, 1));
        }
        resolve();
    });

    shouldShowModal.value = true;
}

const filteredFollowers = computed(() => {
    if (!searchFollower.value) {
        return getPropertyCaseInsensitive(saveStore.saveData, "Followers");
    }

    const search = searchFollower.value.toLowerCase();

    return getPropertyCaseInsensitive(saveStore.saveData, "Followers")
        .filter((follower) => getPropertyCaseInsensitive(follower, "Name").toLowerCase().includes(search));
});

const deleteFollower = (id: number) => {
    if (!saveStore.saveData) return;
    setPropertyCaseInsensitive(saveStore.saveData, "Followers", getPropertyCaseInsensitive(saveStore.saveData, "Followers").filter((follower: any) => getPropertyCaseInsensitive(follower, "ID") === id));
}

const saveFollower = (followerData: FollowerEditEvent, oldID: number) => {
    if (!saveStore.saveData) {
        console.error("No save data found ?");
        return;
    }

    const followers = getPropertyCaseInsensitive(saveStore.saveData, "Followers");
    const index = followers.findIndex((follower: any) => getPropertyCaseInsensitive(follower, "ID") === oldID);
    if (index === -1) {
        console.error("Follower with ID " + oldID + " not found ?");
        return;
    }

    // copy the follower data
    for (const key in followerData) {
        setPropertyCaseInsensitive(followers[index], key, followerData[key as keyof typeof followerData]);
    }

    saveStore.checkCultTraits(followerData.ID);
}

</script>