<template>
  <v-app>
    <v-progress-linear v-show="showLoading" indeterminate color="primary" height="3" absolute top />
    <DefaultLayout />
  </v-app>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { useTranslationStore } from './stores/translation';
import { computed, onMounted, ref } from 'vue';
import DefaultLayout from '@/layouts/default.vue';
import { loadWorshipperData } from './generated/parser/worshipper-data';
import { loadClothingDataMap } from './generated/parser/clothing-data';
const router = useRouter()
const translationStore = useTranslationStore()

const isLoading = ref(false)
const showLoading = computed(() => isLoading.value || !translationStore.isLoaded)

router.beforeEach(() => {
  isLoading.value = true
})

router.afterEach(() => {
  isLoading.value = false
})

onMounted(async () => {
  await translationStore.loadTranslations();
  // console.log(await loadWorshipperData());
  // console.log(await loadClothingDataMap());
});

</script>
