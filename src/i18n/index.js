import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './ja.json';
import en from './en.json';

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: navigator.language.startsWith('ja') ? 'ja' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
