import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './Settings.css';
import { R2Config } from '../../types';
import { getR2Config, saveR2Config } from '../../services/r2Service';
import { persistence } from '../../utils/persistence';
import { 
  validateAccountId, 
  validateBucketName, 
  validateAccessKeyId, 
  validateSecretAccessKey, 
  validatePublicUrl 
} from '../../utils/validation';

interface SettingsProps {
  onClose: () => void;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  highContrast: boolean;
  onHighContrastChange: (enabled: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ onClose, theme, onThemeChange, highContrast, onHighContrastChange }) => {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<R2Config>({
    accountId: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: '',
    publicUrl: '',
  });
  const [storageLimit, setStorageLimit] = useState<number>(10);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const savedConfig = await getR2Config();
    if (savedConfig) {
      setConfig({
        ...savedConfig,
        publicUrl: savedConfig.publicUrl || '',
      });
    }
    const savedLimit = await persistence.getItem('storageLimit');
    if (savedLimit) {
      setStorageLimit(parseInt(savedLimit, 10));
    }
  };

  const handleSave = async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    let isValid = true;

    const accountIdError = validateAccountId(config.accountId);
    if (accountIdError) { newErrors.accountId = accountIdError; isValid = false; }

    const bucketNameError = validateBucketName(config.bucketName);
    if (bucketNameError) { newErrors.bucketName = bucketNameError; isValid = false; }

    const accessKeyIdError = validateAccessKeyId(config.accessKeyId);
    if (accessKeyIdError) { newErrors.accessKeyId = accessKeyIdError; isValid = false; }

    const secretAccessKeyError = validateSecretAccessKey(config.secretAccessKey);
    if (secretAccessKeyError) { newErrors.secretAccessKey = secretAccessKeyError; isValid = false; }

    const publicUrlError = validatePublicUrl(config.publicUrl || '');
    if (publicUrlError) { newErrors.publicUrl = publicUrlError; isValid = false; }

    setErrors(newErrors);
    setTouched({
      accountId: true,
      bucketName: true,
      accessKeyId: true,
      secretAccessKey: true,
      publicUrl: true
    });

    if (!isValid) {
      setMessage({ text: t('settings.requiredFields'), type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      await saveR2Config(config);
      await persistence.setItem('storageLimit', storageLimit.toString());
      setMessage({ text: t('settings.saveSuccess'), type: 'success' });
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      setMessage({ text: t('settings.saveError'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearData = async () => {
    if (window.confirm(t('settings.clearDataConfirm'))) {
      await persistence.clear();
      setMessage({ text: t('settings.clearDataSuccess'), type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleResetLimitWarning = async () => {
    await persistence.removeItem('storageLimitPromptDismissedDate');
    setMessage({ text: 'Limit warning reset', type: 'success' });
  };

  const handleLogStorage = () => {
    console.group('Local Storage Dump');
    // Create a clean object from localStorage to display
    const storage: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storage[key] = localStorage.getItem(key) || '';
      }
    }
    console.table(storage);
    console.groupEnd();
    setMessage({ text: 'Storage logged to console', type: 'success' });
  };

  const handleFillDummyConfig = () => {
    setConfig({
      accountId: '00000000000000000000000000000000',
      accessKeyId: '00000000000000000000000000000000',
      secretAccessKey: '0000000000000000000000000000000000000000000000000000000000000000',
      bucketName: 'test-bucket',
      publicUrl: 'https://test.example.com'
    });
    setMessage({ text: 'Dummy config filled', type: 'success' });
  };

  const handleInjectFakeFiles = async () => {
    const fakeFiles = [
      {
        id: `fake-${Date.now()}-1`,
        name: 'debug-image.png',
        size: 2.5 * 1024 * 1024,
        uploadedAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
        url: 'https://example.com/debug-image.png'
      },
      {
        id: `fake-${Date.now()}-2`,
        name: 'debug-document.pdf',
        size: 500 * 1024,
        uploadedAt: Date.now(),
        expiresAt: Date.now() + 10 * 60 * 1000,
        url: 'https://example.com/debug-document.pdf'
      }
    ];
    
    const existing = await persistence.getItem('files');
    const files = existing ? JSON.parse(existing) : [];
    await persistence.setItem('files', JSON.stringify([...files, ...fakeFiles]));
    
    setMessage({ text: 'Fake files injected. Reloading...', type: 'success' });
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleResetOnboarding = async () => {
    await persistence.removeItem('r2Config');
    setMessage({ text: 'Onboarding reset. Reloading...', type: 'success' });
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleClearFiles = async () => {
    await persistence.removeItem('files');
    setMessage({ text: 'Files cleared. Reloading...', type: 'success' });
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleChange = (field: keyof R2Config, value: string) => {
    const newValue = value.trim();
    setConfig(prev => ({ ...prev, [field]: newValue }));
    
    if (touched[field]) {
      validateField(field, newValue);
    }
  };

  const handleBlur = (field: keyof R2Config) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, config[field] || '');
  };

  const validateField = (field: keyof R2Config, value: string) => {
    let error: string | null = null;
    switch (field) {
      case 'accountId': error = validateAccountId(value); break;
      case 'bucketName': error = validateBucketName(value); break;
      case 'accessKeyId': error = validateAccessKeyId(value); break;
      case 'secretAccessKey': error = validateSecretAccessKey(value); break;
      case 'publicUrl': error = validatePublicUrl(value); break;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) newErrors[field] = error;
      else delete newErrors[field];
      return newErrors;
    });
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleLanguageChange = (lang: string) => {
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const languages = [
    { code: 'en-US', name: 'English (US)' },
    { code: 'en-GB', name: 'English (UK)' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'zh-CN', name: '简体中文' },
    { code: 'zh-HK', name: '繁體中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
  ];

  return (
    <div className={`settings-overlay ${isClosing ? 'closing' : ''}`} onClick={handleOverlayClick} role="presentation">
      <div 
        className={`settings-modal ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        <div className="settings-header">
          <h2 className="settings-title" id="settings-dialog-title">{t('settings.title')}</h2>
          <button 
            className="close-button" 
            onClick={handleClose} 
            aria-label={t('settings.closeAria')}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="settings-content">
          <div className="r2-section">
            <h3 className="section-title">{t('settings.r2Title')}</h3>
            
            <div className="settings-info">
              <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong>{t('settings.infoTitle')}</strong>
                <p>{t('settings.infoDescription')}</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="accountId">{t('settings.accountId')} *</label>
              <input
                id="accountId"
                type="text"
                value={config.accountId}
                onChange={(e) => handleChange('accountId', e.target.value)}
                onBlur={() => handleBlur('accountId')}
                placeholder={t('settings.accountIdPlaceholder')}
                autoComplete="off"
                aria-required="true"
                className={errors.accountId ? 'error' : ''}
              />
              {errors.accountId && <span className="error-message">{t(errors.accountId)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="bucketName">{t('settings.bucketName')} *</label>
              <input
                id="bucketName"
                type="text"
                value={config.bucketName}
                onChange={(e) => handleChange('bucketName', e.target.value)}
                onBlur={() => handleBlur('bucketName')}
                placeholder={t('settings.bucketNamePlaceholder')}
                autoComplete="off"
                aria-required="true"
                className={errors.bucketName ? 'error' : ''}
              />
              {errors.bucketName && <span className="error-message">{t(errors.bucketName)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="accessKeyId">{t('settings.accessKeyId')} *</label>
              <input
                id="accessKeyId"
                type="text"
                value={config.accessKeyId}
                onChange={(e) => handleChange('accessKeyId', e.target.value)}
                onBlur={() => handleBlur('accessKeyId')}
                placeholder={t('settings.accessKeyIdPlaceholder')}
                autoComplete="off"
                aria-required="true"
                className={errors.accessKeyId ? 'error' : ''}
              />
              {errors.accessKeyId && <span className="error-message">{t(errors.accessKeyId)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="secretAccessKey">{t('settings.secretAccessKey')} *</label>
              <input
                id="secretAccessKey"
                type="password"
                value={config.secretAccessKey}
                onChange={(e) => handleChange('secretAccessKey', e.target.value)}
                onBlur={() => handleBlur('secretAccessKey')}
                placeholder={t('settings.secretAccessKeyPlaceholder')}
                autoComplete="new-password"
                aria-required="true"
                className={errors.secretAccessKey ? 'error' : ''}
              />
              {errors.secretAccessKey && <span className="error-message">{t(errors.secretAccessKey)}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="publicUrl">{t('settings.publicUrl')}</label>
              <div className={`url-input-group ${errors.publicUrl ? 'error' : ''}`}>
                <span className="url-prefix">https://</span>
                <input
                  id="publicUrl"
                  type="text"
                  value={config.publicUrl ? config.publicUrl.replace(/^https?:\/\//, '') : ''}
                  onChange={(e) => handleChange('publicUrl', `https://${e.target.value}`)}
                  onBlur={() => handleBlur('publicUrl')}
                  placeholder="your-domain.com"
                  autoComplete="url"
                  aria-describedby="publicUrl-hint"
                  className="url-input"
                />
              </div>
              {errors.publicUrl && <span className="error-message">{t(errors.publicUrl)}</span>}
              <small id="publicUrl-hint">{t('settings.publicUrlHint')}</small>
            </div>

            <div className="form-group">
              <label htmlFor="storageLimit">{t('settings.storageLimit')} (GB)</label>
              <input
                id="storageLimit"
                type="number"
                min="1"
                value={storageLimit}
                onChange={(e) => setStorageLimit(Math.max(1, parseInt(e.target.value, 10) || 0))}
                className="storage-input"
              />
              <small>{t('settings.storageLimitHint')}</small>
            </div>
          </div>

          <div className="appearance-section">
            <h3 className="section-title">{t('settings.appearance')}</h3>
            
            <div className="toggle-group">
              <div className="toggle-item">
                <div className="toggle-info">
                  <label htmlFor="themeToggle">{t('settings.themeMode')}</label>
                  <small>{t('settings.themeModeHint')}</small>
                </div>
                <div className="theme-toggle">
                  <button
                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => onThemeChange('light')}
                    aria-label={t('settings.lightMode')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z\" />
                    </svg>
                    <span>{t('settings.light')}</span>
                  </button>
                  <button
                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => onThemeChange('dark')}
                    aria-label={t('settings.darkMode')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                    <span>{t('settings.dark')}</span>
                  </button>
                </div>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <label htmlFor="contrastToggle">{t('settings.highContrast')}</label>
                  <small>{t('settings.highContrastHint')}</small>
                </div>
                <label className="switch">
                  <input
                    id="contrastToggle"
                    type="checkbox"
                    checked={highContrast}
                    onChange={(e) => onHighContrastChange(e.target.checked)}
                    aria-label={t('settings.highContrast')}
                  />
                  <span className="switch-slider"></span>
                </label>
              </div>

              <div className="toggle-item">
                <div className="toggle-info">
                  <label htmlFor="languageSelect">{t('settings.language')}</label>
                  <small>{t('settings.languageHint')}</small>
                </div>
                <select
                  id="languageSelect"
                  className="language-select"
                  value={currentLanguage}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  aria-label={t('settings.language')}
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {import.meta.env.DEV && (
            <div className="debug-section">
              <h3 className="section-title">Debug (Dev Only)</h3>
              <div className="settings-actions" style={{ justifyContent: 'flex-start', gap: '10px', marginTop: '1rem', flexWrap: 'wrap' }}>
                <button 
                  className="button secondary" 
                  onClick={handleResetLimitWarning} 
                  type="button"
                >
                  Reset Limit Warning
                </button>
                <button 
                  className="button secondary" 
                  onClick={handleLogStorage} 
                  type="button"
                >
                  Log Storage
                </button>
                <button 
                  className="button secondary" 
                  onClick={handleFillDummyConfig} 
                  type="button"
                >
                  Fill Dummy Config
                </button>
                <button 
                  className="button secondary" 
                  onClick={handleInjectFakeFiles} 
                  type="button"
                >
                  Inject Fake Files
                </button>
                <button 
                  className="button secondary" 
                  onClick={handleResetOnboarding} 
                  type="button"
                >
                  Reset Onboarding
                </button>
                <button 
                  className="button secondary" 
                  onClick={handleClearFiles} 
                  type="button"
                >
                  Clear Files
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`settings-message ${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="settings-actions">
            <button 
              className="button danger" 
              onClick={handleClearData} 
              type="button"
              style={{ marginRight: 'auto' }}
            >
              {t('settings.clearData')}
            </button>
            <button className="button secondary" onClick={handleClose} type="button">
              {t('settings.cancel')}
            </button>
            <button 
              className="button primary" 
              onClick={handleSave}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? t('settings.saving') : t('settings.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
