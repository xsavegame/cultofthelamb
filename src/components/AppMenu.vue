<template>
  <v-app-bar color="primary">
    <v-app-bar-nav-icon variant="text" @click.stop="drawer = !drawer"></v-app-bar-nav-icon>

    <v-toolbar-title>Cult of the Lamb Save Editor</v-toolbar-title>

    <template v-if="$vuetify.display.mdAndUp">
      <v-btn icon="mdi-content-save" variant="text" title="Save file" @click="saveFile"></v-btn>

      <v-btn icon="mdi-upload" variant="text" title="Choose new file" @click="chooseFile"></v-btn>
    </template>

    <v-btn
      icon="mdi-information-outline"
      variant="text"
      title="Application info"
      @click="isInfoDialogOpen = true"
    ></v-btn>
  </v-app-bar>

  <v-navigation-drawer permanent>
    <v-list-item title="Cult of the Lamb Save Editor"></v-list-item>
    <v-divider></v-divider>
    <v-list nav v-model:opened="menuOpened" :lines="false">
      <template v-for="item in menu" :key="item.title">
        <v-list-item v-if="!item.children" :prepend-icon="item.icon" :title="item.title" :to="item.to"></v-list-item>
        <v-list-group v-else :value="item.title" :prepend-icon="item.icon">
          <template v-slot:activator="{ props }">
            <v-list-item v-bind="props" :title="item.title"></v-list-item>
          </template>
          <template v-for="child in item.children" :key="child.title">
            <v-list-item :prepend-icon="child.icon" :title="child.title" :to="child.to"></v-list-item>
          </template>
        </v-list-group>
      </template>
    </v-list>
  </v-navigation-drawer>

  <v-dialog v-model="isInfoDialogOpen" max-width="560">
    <v-card title="Application Info">
      <v-card-text>
        <v-list v-if="infoEntries.length > 0" density="compact">
          <v-list-item
            v-for="entry in infoEntries"
            :key="entry.label"
            :title="entry.label"
            :subtitle="entry.value"
          ></v-list-item>
        </v-list>
        <div v-else class="text-medium-emphasis">
          No application info available.
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="isInfoDialogOpen = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { EXTRACTED_GAME_VERSION } from "@/generated/version";
import { useAppStore } from "@/stores/app";
import { computed, onMounted, ref } from "vue";

const appStore = useAppStore();

const drawer = ref(true)
const menuOpened = ref<string[]>([]);
const isInfoDialogOpen = ref(false);
const contributors = ref<string[]>([]);

type MenuItem = {
  icon: string;
  title: string;
  to?: string;
  children?: MenuItem[];
};

const menu: MenuItem[] = [
  {
    icon: "mdi-folder",
    title: "Main Data",
    to: "/",
  },
  {
    icon: "mdi-package-variant-closed",
    title: "Inventory",
    to: "/items",
  },
  {
    icon: "mdi-account-multiple",
    title: "Followers",
    to: "/followers",
  },
  {
    icon: "mdi-cards-playing-outline",
    title: "Tarot Cards",
    to: "/tarot-cards",
  },
];

type InfoEntry = {
  label: string;
  value: string;
};

const DEFAULT_REPOSITORY_URL = "https://github.com/xsavegame/cultofthelamb/";

const owner = sanitizeOptionalString(import.meta.env.VITE_APP_OWNER);
const repositoryUrl =
  sanitizeOptionalString(import.meta.env.VITE_APP_REPOSITORY_URL) ??
  DEFAULT_REPOSITORY_URL;
const commitHash = sanitizeOptionalString(import.meta.env.VITE_APP_COMMIT_HASH);
const appVersion = sanitizeOptionalString(import.meta.env.VITE_APP_VERSION);
const builtDate = sanitizeOptionalString(import.meta.env.VITE_APP_BUILT_DATE);
const gameVersion = sanitizeOptionalString(EXTRACTED_GAME_VERSION);

const infoEntries = computed<InfoEntry[]>(() => {
  const entries: InfoEntry[] = [];

  if (owner) {
    entries.push({ label: "Owner", value: owner });
  }

  if (contributors.value.length > 0) {
    entries.push({ label: "Contributors", value: contributors.value.join(", ") });
  }

  entries.push({ label: "Repository URL", value: repositoryUrl });

  if (commitHash) {
    entries.push({ label: "Commit Hash", value: commitHash });
  }

  if (gameVersion) {
    entries.push({ label: "Game Version", value: gameVersion });
  }

  if (appVersion) {
    entries.push({ label: "Version", value: appVersion });
  }

  if (builtDate) {
    entries.push({ label: "Built Date", value: builtDate });
  }

  return entries;
});

onMounted(async () => {
  contributors.value = await loadContributors();
});

function saveFile() {
  appStore.exportSave();
}

function chooseFile() {
  appStore.showSelectFileDialog();
}

function sanitizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeContributor(value: unknown): string | null {
  if (typeof value === "string") {
    return sanitizeOptionalString(value);
  }

  if (value && typeof value === "object") {
    const named = value as { name?: unknown };
    if (typeof named.name === "string") {
      return sanitizeOptionalString(named.name);
    }
  }

  return null;
}

function parseContributors(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeContributor).filter((entry): entry is string => entry !== null);
  }

  if (payload && typeof payload === "object") {
    const objectPayload = payload as { contributors?: unknown };
    if (Array.isArray(objectPayload.contributors)) {
      return objectPayload.contributors
        .map(normalizeContributor)
        .filter((entry): entry is string => entry !== null);
    }
  }

  return [];
}

async function loadContributors(): Promise<string[]> {
  try {
    const contributorsPath = `${import.meta.env.BASE_URL}contributors.json`;
    const response = await fetch(contributorsPath, { cache: "no-cache" });
    if (!response.ok) {
      return [];
    }

    const payload: unknown = await response.json();
    return parseContributors(payload);
  } catch {
    return [];
  }
}

</script>
