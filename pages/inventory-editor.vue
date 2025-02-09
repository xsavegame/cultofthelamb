<template>
    <div v-if="saveStore.saveData">
        <div class="row">
            <div class="col-12 col-md-4 offset-md-8">
                <input type="text" class="form-control" v-model="search" placeholder="Search" />
            </div>
        </div>
        <hr />
        <div v-for="itemList in filteredItems" :key="`inventory-group-${itemList.name}`">
            <h2>{{ itemList.name }}</h2>
            <hr />
            <div class="row row-cols-2 row-cols-sm-4 row-cols-lg-6 g-4 mb-4">
                <div v-for="item in itemList.items" class="col" :key="`inventory-item-${item.id}`">
                    <div class="card">
                        <div class="text-center bg-light center-container">
                            <NuxtImg loading="eager" class="card-img-top small-size image-inner"
                                alt="Image not available" :src="item.image" width="64px" height="64px" fit="inside" />
                        </div>
                        <div class="card-body">
                            <h5 class="card-title">{{ item.name }}</h5>
                        </div>
                        <div class="card-footer">
                            <div class="input-group">
                                <span class="input-group-text">x</span>
                                <input :value="itemQuantity(item.id)" type="number" class="form-control" min="0"
                                    @input="(e) => setItemQuantity(item.id, parseInt((e.target as HTMLInputElement)?.value) ?? 0)" :max="item.max">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import { getPropertyCaseInsensitive, setPropertyCaseInsensitive } from '~/utils/utility';
import { useSaveData } from '~/stores/saveData';

const { data: itemData } = useFetch<{ name: string, items: { id: number, image: string, name: string, max?: number }[] }[]>('/data/itemData.json');

const saveStore = useSaveData();
const search = ref('');

const filteredItems = computed(() => {
    if (search.value === '') {
        return itemData.value;
    }

    const items = [];
    for (const itemList of itemData.value ?? []) {
        const group = {
            name: itemList.name,
            items: itemList.items.filter((item) => item.name.toLowerCase().includes(search.value.toLowerCase()))
        }

        items.push(group);
    }

    return items;
});

const itemQuantity = (id: number) => getPropertyCaseInsensitive(saveStore.saveData, "items")?.find((item: any) => item.type === id)?.quantity ?? 0;

const setItemQuantity = (id: number, quantity: number) => {
    if (!saveStore.saveData) return;

    setPropertyCaseInsensitive(saveStore.saveData, "items", getPropertyCaseInsensitive(saveStore.saveData, "items")?.filter((item) => item.quantity > 0 && ((quantity <= 0 && item.type !== id) || quantity > 0)));
    if (quantity <= 0) return;

    const item = getPropertyCaseInsensitive(saveStore.saveData, "items")?.find((item: any) => item.type === id);

    if (item) {
        item.quantity = quantity;
        item.UnreservedQuantity = quantity;
    } else {
        getPropertyCaseInsensitive(saveStore.saveData, "items")?.push({ type: id, quantity, QuantityReserved: 0, UnreservedQuantity: quantity });
    }
}
</script>