import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSettingsStore = defineStore('settings', function () {
  const keepOriginalFormat = ref(true);
  const themeMode = ref<'light' | 'dark' | 'system'>('dark');

  const save = async function () {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        keepOriginalFormat: keepOriginalFormat.value,
        themeMode: themeMode.value,
      }),
    );
  };

  const load = async function () {
    const settings = localStorage.getItem('settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      keepOriginalFormat.value = parsed.keepOriginalFormat ?? true;
      themeMode.value = parsed.themeMode ?? 'system';
    }
  };

  return { keepOriginalFormat, themeMode, save, load };
});
