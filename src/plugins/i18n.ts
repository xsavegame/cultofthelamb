import { createI18n } from 'vue-i18n'

const BR_TAG_REGEX = /<br\s*\/?>/gi
const HTML_TAG_REGEX = /<[^>]+>/g

export function stripTranslationTags (text: string): string {
  return text
    .replace(BR_TAG_REGEX, '\n')
    .replace(HTML_TAG_REGEX, '')
}

export default createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {},
  },
  postTranslation: translated => {
    if (typeof translated !== 'string') {
      return translated
    }

    return stripTranslationTags(translated)
  },
})
