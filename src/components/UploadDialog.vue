<template>
  <v-dialog v-model="dialog" max-width="900">
    <v-card prepend-icon="mdi-folder-image" title="Select Save File">
      <v-card-text>
        <v-row v-show="!appStore.proccessing">
          <v-col cols="12">
            <p>Upload your save file below and start editing your save file to your liking.</p>
            <p class="font-weight-bold text-red">Make sure you always backup your original save file.</p>
            <p>After you are done, replace your old save file with the new one.</p>
            <p class="mb-3">File name (NEW) <v-chip>slot_{save slot 0-indexed}.mp</v-chip></p>
            <p><small>File name (OLD) <v-chip>slot_{save slot 0-indexed}.json</v-chip></small></p>
          </v-col>
          <v-col cols="12" v-if="errMessage">
            <v-alert type="error" :text="errMessage" icon="$error" title="Error"></v-alert>
          </v-col>
          <v-col cols="12">
            <v-file-upload density="compact" variant="compact" v-model="file"
              :disabled="appStore.proccessing"></v-file-upload>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-text>
        <p class="mb-4">
          If you don't know where your save file is located, copy the below path and paste in your file explorer top bar
          or, if you are on Windows, hit Windows key + R and paste the path in the Run dialog box.
        </p>
        <template v-for="path in savePaths" :key="path.name">
          <v-text-field :label="`Save file location ${path.name}`" variant="outlined" :model-value="path.path" readonly
            class="mb-4" append-inner-icon="mdi-content-copy" @click:append-inner="copyToClipboard(path.path)">
          </v-text-field>
        </template>
      </v-card-text>
      <template v-if="chosenFile">
        <v-divider></v-divider>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text="Close" variant="plain" @click="appStore.closeSelectFileDialog()" :disabled="appStore.proccessing"
            :loading="appStore.proccessing"></v-btn>
        </v-card-actions>
      </template>
    </v-card>
  </v-dialog>
</template>


<script lang="ts" setup>
import { VFileUpload } from 'vuetify/labs/VFileUpload';
import { useAppStore } from '@/stores/app';
import { computed, ref, watch } from 'vue';

const appStore = useAppStore();

const dialog = computed(() => appStore.selectFileDialog);
const chosenFile = computed(() => appStore.fileName !== null);
const errMessage = ref<string | null>(null);

const file = ref<File | File[]>();

const savePaths = ref([
  {
    name: 'Windows',
    path: '%USERPROFILE%\\AppData\\LocalLow\\Massive Monster\\Cult Of The Lamb\\saves',
  },
  {
    name: 'Mac',
    path: '~/Library/Application Support/Massive Monster/Cult Of The Lamb/saves',
  },
]);

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

watch(file, async (value) => {
  if (value) {
    file.value = undefined;
    const jsonFile = Array.isArray(value) ? value[0] : value;

    if (!jsonFile) {
      return;
    }

    errMessage.value = null;

    appStore.setFile(jsonFile)
      .then(() => {
        appStore.closeSelectFileDialog();
      }).catch((error) => {
        errMessage.value = error?.message ?? `${error}`;
      });
  }
});

</script>
