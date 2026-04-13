import { defineStore } from 'pinia'
import { ref } from 'vue'
import i18n from '@/plugins/i18n'

export const useTranslationStore = defineStore('translation', function () {
  const isLoaded = ref(false)

  const $t = (key: string) => {
    const translated = i18n.global.t(key)
    return typeof translated === 'string' ? translated : String(translated)
  }

  const loadTranslations = async () => {
    if (isLoaded.value) {
      return
    }

    isLoaded.value = false

    try {
      const { default: v } = await import(
        `@/generated/translations/English.json`,
      )
      i18n.global.setLocaleMessage('en', v as Record<string, string>)
      i18n.global.locale.value = 'en'
      isLoaded.value = true
    } catch {
      isLoaded.value = false
    }
  }

  return {
    isLoaded,
    $t,
    loadTranslations,
  }
})
