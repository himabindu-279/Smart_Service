import React from 'react';
import { languageNames } from '../i18n/translations';
import { useI18n } from '../context/I18nContext';

export default function LanguageSelector({ className, style }) {
  const { language, languages, setLanguage, preferenceError, t } = useI18n();

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', ...style }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>{t('common.language')}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          aria-label={t('common.language')}
          style={{ width: 'auto', minWidth: '8rem' }}
        >
          {languages.map((option) => (
            <option value={option} key={option}>{languageNames[option]}</option>
          ))}
        </select>
      </label>
      {preferenceError && <span role="alert" style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{preferenceError}</span>}
    </div>
  );
}
