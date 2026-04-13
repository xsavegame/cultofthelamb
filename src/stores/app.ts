import { DataManager } from '@/generated/classes';
import { createDecoder, createEncoder } from '@/utils/file';
import { defineStore } from 'pinia';
import { useDataStore } from './data';
import { computed, ref } from 'vue';

export enum FileType {
  Json,
  MsgPack,
}

export const useAppStore = defineStore('app', function () {
  const dataStore = useDataStore();
  const selectFileDialog = ref(true);
  const proccessing = ref(false);
  const fileType = ref<FileType | null>(null);
  const fileName = ref<string | null>(null);

  const closeSelectFileDialog = () => {
    selectFileDialog.value = false;
  };

  const showSelectFileDialog = () => {
    selectFileDialog.value = true;
  };

  const setSaveData = (newSaveData: DataManager | null) => {
    dataStore.data = newSaveData;
  };

  const isDataLoaded = computed(() => dataStore.data !== null);

  const parseFile = async (file: File) => {
    const decoder = await createDecoder(file);
    const saveData = await decoder.toObject();
    return { saveData, decoder };
  };

  const setFile = async (file: File) => {
    try {
      proccessing.value = true;
      const { saveData, decoder } = await parseFile(file);
      if (saveData) {
        setSaveData(saveData);
        fileType.value = decoder.getFileType();
        fileName.value = file.name;
      }
    } catch (error) {
      console.error(error);
    } finally {
      proccessing.value = false;
    }
  };

  const reset = () => {
    setSaveData(null);
    fileType.value = null;
    fileName.value = null;
  };

  const exportSave = async () => {
    if (!dataStore.data) {
      throw new Error('No save data to export');
    }

    const encoder = await createEncoder(fileName.value!, dataStore.data);

    const data = await encoder.toFile();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.value!;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    fileName,
    fileType,
    selectFileDialog,
    closeSelectFileDialog,
    showSelectFileDialog,
    setFile,
    isDataLoaded,
    proccessing,
    reset,
    exportSave,
    parseFile,
  };
});
