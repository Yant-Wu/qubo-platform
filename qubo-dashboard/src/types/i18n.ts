export type AppLanguage = 'zh' | 'en';

export const NEXT_LANGUAGE: Record<AppLanguage, AppLanguage> = {
  zh: 'en',
  en: 'zh',
};

export const LANGUAGE_BUTTON_LABEL: Record<AppLanguage, string> = {
  zh: 'EN',
  en: 'CH',
};
