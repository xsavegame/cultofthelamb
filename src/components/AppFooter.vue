<template>
  <v-footer app height="40">
    <div>
      <span>Loaded file: <span class="font-weight-bold text-primary">{{ appStore.fileName }}</span>. </span>
      <span>Cult Name: <span class="font-weight-bold text-primary">{{ dataStore.data?.CultName }}</span>. </span>
      <span>Day: <span class="font-weight-bold text-primary">{{ dataStore.data?.CurrentDayIndex }}</span>. </span>
      <span>Wool Haven DLC Unlocked: <span class="font-weight-bold text-primary">{{ dataStore.isWoolHavenUnlocked ? '✅' : '❌' }}</span>. </span>
    </div>

    <div class="text-caption text-disabled" style="position: absolute; right: 16px;">
      &copy; 2026{{ year }} <span class="d-none d-sm-inline-block">{{ author }}</span>
      —
      <a class="text-decoration-none on-surface"
        href="https://github.com/thestrangerdev/cult-of-the-lamb-save-editor/blob/main/LICENSE"
        rel="noopener noreferrer" target="_blank">
        MIT License
      </a>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
import { useAppStore } from "@/stores/app";
import { useDataStore } from "@/stores/data";

const appStore = useAppStore();
const dataStore = useDataStore();

const author = import.meta.env.VITE_AUTHOR_NAME ?? "thestrangerdev";
const currentDate = new Date();
const year = currentDate.getFullYear() === 2026 ? "" : `-${currentDate.getFullYear()}`;
</script>

<style scoped lang="sass">
  .v-footer
    border-top: 1px solid var(--v-theme-surface-variant)
</style>
