import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import zhHK from './locales/zh-HK.json';
import zhCN from './locales/zh-CN.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enUS },
      'en-GB': { translation: enGB },
      'es': { translation: es },
      'fr': { translation: fr },
      'de': { translation: de },
      'zh-HK': { translation: zhHK },
      'zh-CN': { translation: zhCN },
      'zh-TW': { translation: zhCN },
      'zh': { translation: zhCN },
      'ja': { translation: ja },
      'ko': { translation: ko },
    },
    fallbackLng: 'en-US',
    lng: localStorage.getItem('language') || undefined,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
