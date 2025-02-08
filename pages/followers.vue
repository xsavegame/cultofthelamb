<template>
    <div v-if="saveStore.saveData">
        <div v-if="getPropertyCaseInsensitive(saveStore.saveData, 'Followers').length > 0">
            <FollowerModalEdit v-if="selectedFollower" ref="followerModalEdit" :follower-data="selectedFollower"
                v-model="shouldShowModal" @save="saveFollower" />
            <div class="row row-cols-5 g-4 mb-4 gap-3">
                <div v-for="follower in getPropertyCaseInsensitive(saveStore.saveData, 'Followers')" class="card"
                    style="width: 16rem;">
                    <div class="center-container">
                        <NuxtImg loading="eager" :src='constructFollowerPreviewUrl(follower, true)'
                            class="card-img-top image-inner large-size" alt="Image not available" width="256"
                            height="256" quality="100" fit="inside" />
                    </div>
                    <div class="card-body">
                        <h5 class="card-title">
                            {{ getPropertyCaseInsensitive(follower, 'Name') }}
                        </h5>
                        <p class="card-text">
                            Level: <b>{{ getPropertyCaseInsensitive(follower, 'XPLevel') }}</b>
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