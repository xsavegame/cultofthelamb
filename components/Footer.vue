<template>
    <footer class="row fixed-bottom p-3">
        <div class="col mt-3">
            <span class="text-muted text-center">Made with ❤ by SavagE & hayper. Updated by thestrangedev</span>
        </div>
        <div class="col text-center">
            <button class="btn btn-lg btn-success me-1 mb-1" form="form"
                @click="downloadSaveFile">Save</button>
            <button type="button" class="btn btn-lg btn-primary" form="form"
                @click="loadNewFile">Load A New File</button>
        </div>
        <div class="col"></div>
    </footer>
</template>

<script setup lang="ts">
import { useSaveData } from "~/stores/saveData";

const saveStore = useSaveData();

const downloadSaveFile = async (e: MouseEvent) => {
    e.preventDefault();
    if (!document) return;
    const blob = new Blob([await saveStore.exportSave()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = saveStore.fileData!.name;
    anchor.click();
    URL.revokeObjectURL(url);
};

const emit = defineEmits();

const loadNewFile = () => {
    emit('loadNewFile');
};

</script>