<template>
    <div v-if="saveStore.saveData">
        <div v-if="getPropertyCaseInsensitive(saveStore.saveData, 'Followers_Dead')?.length > 0">
            <FollowerModalEdit v-if="selectedFollower" ref="followerModalEdit" :follower-data="selectedFollower"
                :is-dead="true" />
            <div class="row row-cols-5 g-4 mb-4 gap-3">
                <div v-for="follower in getPropertyCaseInsensitive(saveStore.saveData, 'Followers_Dead')" class="card"
                    style="width: 16rem;">
                    <div class="center-container">
                        <NuxtImg loading="eager" :src='constructFollowerPreviewUrl(follower, true, true)'
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
                                <button type="button" class="btn btn-primary" @click="() => editFollower(follower as any)">
                                    Edit
                                </button>
                            </div>
                        </div>
                        <div class="py-1" />
                        <div class="row">
                            <div class="col center-container">
                                <button type="button" class="btn btn-success"
                                    @click="() => reviveFollower(getPropertyCaseInsensitive(follower, 'ID'))">
                                    Revive
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <p v-else>You have no dead follower! Go kill some!</p>
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { constructFollowerPreviewUrl, getPropertyCaseInsensitive, setPropertyCaseInsensitive } from '~/utils/utility';
import { useSaveData } from '~/stores/saveData';

const selectedFollower = ref<any>();
const followerModalEdit = ref<HTMLElement & { modal: any | undefined }>();

const editFollower = async (followerData: number) => {
    console.log('followerData = ', followerData);
    selectedFollower.value = followerData;

    await new Promise<void>(async (resolve) => {
        while (!followerModalEdit.value) {
            await new Promise<void>((r) => setTimeout(r, 1));
        }
        resolve();
    });

    followerModalEdit.value?.modal?.toggle();
}

const reviveFollower = async (id: number) => {
    if (!saveStore.saveData) return;
    getPropertyCaseInsensitive(saveStore.saveData, "Followers").push(getPropertyCaseInsensitive(saveStore.saveData, "Followers_Dead").find((follower: any) => getPropertyCaseInsensitive(follower, "ID") === id)!);
    deleteFollower(id);
}

const deleteFollower = (id: number) => {
    if (!saveStore.saveData) return;
    setPropertyCaseInsensitive(saveStore.saveData, "Followers_Dead", getPropertyCaseInsensitive(saveStore.saveData, "Followers_Dead").filter((follower: any) => getPropertyCaseInsensitive(follower, "ID") !== id));
}

const saveStore = useSaveData();
</script>