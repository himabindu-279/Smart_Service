import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getTranslation, supportedLanguages } from '../i18n/translations';

const STORAGE_KEY = 'smartservice.language';
const defaultTranslator = (key, values) => getTranslation('en', key, values);
const I18nContext = createContext({
  isProvided: false,
  language: 'en',
  languages: supportedLanguages,
  setLanguage: () => undefined,
  preferenceError: '',
  t: defaultTranslator,
});

function isSupportedLanguage(language) {
  return supportedLanguages.includes(language);
}

function getStoredLanguage() {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children, initialLanguage, onLanguageChange }) {
  const [language, setCurrentLanguage] = useState(() => (
    isSupportedLanguage(initialLanguage) ? initialLanguage : getStoredLanguage()
  ));
  const [preferenceError, setPreferenceError] = useState('');

  useEffect(() => {
    if (!isSupportedLanguage(initialLanguage)) return;
    setCurrentLanguage(initialLanguage);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, initialLanguage);
    } catch {
      // The in-memory preference still works when browser storage is unavailable.
    }
  }, [initialLanguage]);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (nextLanguage) => {
    if (!isSupportedLanguage(nextLanguage)) return;
    setPreferenceError('');
    setCurrentLanguage(nextLanguage);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, nextLanguage);
    } catch {
      // The in-memory preference still works when browser storage is unavailable.
    }
    if (onLanguageChange) {
      try {
        await onLanguageChange(nextLanguage);
      } catch {
        setPreferenceError(getTranslation(nextLanguage, 'common.preferenceSaveFailed'));
      }
    }
  }, [onLanguageChange]);

  const t = useCallback((key, values) => getTranslation(language, key, values), [language]);
  const value = useMemo(() => ({
    isProvided: true,
    language,
    languages: supportedLanguages,
    setLanguage,
    preferenceError,
    t,
  }), [language, setLanguage, preferenceError, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nBoundary({ children }) {
  const context = useContext(I18nContext);
  return context.isProvided ? children : <I18nProvider>{children}</I18nProvider>;
}
