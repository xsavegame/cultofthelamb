<template>
    <div v-if="saveStore.saveData">
        <JsonEditorVue v-model="saveStore.saveData" class="jse-theme-dark" />
    </div>
    <p v-else>Load a save file!</p>
</template>

<script setup lang="ts">
import JsonEditorVue from 'json-editor-vue'
import 'vanilla-jsoneditor/themes/jse-theme-dark.css'
import { useSaveData } from "~/stores/saveData";

const saveStore = useSaveData();
</script>