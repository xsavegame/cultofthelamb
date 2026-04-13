<template>
  <v-layout class="rounded rounded-md border" v-if="appStore.isDataLoaded">
    <AppMenu />
    <v-main>
      <v-container>
        <router-view />
      </v-container>
    </v-main>
    <AppFooter />
  </v-layout>
  <UploadDialog />
</template>

<script lang="ts" setup>
import UploadDialog from "@/components/UploadDialog.vue";
import AppMenu from "@/components/AppMenu.vue";
import AppFooter from "@/components/AppFooter.vue";
import { useAppStore } from "@/stores/app";

const appStore = useAppStore();

</script>
