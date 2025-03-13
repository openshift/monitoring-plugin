const LAST_LANGUAGE_LOCAL_STORAGE_KEY = 'bridge/last-language';
export const getLastLanguage = (): string => localStorage.getItem(LAST_LANGUAGE_LOCAL_STORAGE_KEY);
