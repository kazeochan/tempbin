import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './OnboardingWizard.css';
import { R2Config } from '../../types';
import { persistence } from '../../utils/persistence';
import { getBucketCors, putBucketLifecycle } from '../../services/r2Service';
import { 
  validateAccountId, 
  validateBucketName, 
  validateAccessKeyId, 
  validateSecretAccessKey, 
  validatePublicUrl 
} from '../../utils/validation';

interface OnboardingWizardProps {
  onComplete: () => void;
  initialConfig?: Partial<R2Config>;
  highContrast?: boolean;
  onHighContrastChange?: (enabled: boolean) => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ 
  onComplete, 
  initialConfig,
  highContrast,
  onHighContrastChange 
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Partial<R2Config>>(initialConfig || {});
  const [storageLimit, setStorageLimit] = useState<number>(10);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [corsStatus, setCorsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [corsMessage, setCorsMessage] = useState<string>('');
  
  // Lifecycle State
  const [lifecycleEnabled, setLifecycleEnabled] = useState(true);
  const [lifecycleRuleName, setLifecycleRuleName] = useState('Delete after 1 day');
  const [lifecyclePrefix, setLifecyclePrefix] = useState('');
  const [lifecycleDays, setLifecycleDays] = useState(1);
  const [lifecycleAbortMultipart, setLifecycleAbortMultipart] = useState(true);
  const [lifecycleAbortDays, setLifecycleAbortDays] = useState(7);
  const [lifecycleStatus, setLifecycleStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lifecycleMessage, setLifecycleMessage] = useState<string>('');

  const innerRef = useRef<HTMLDivElement>(null);
  const isDarkMode = document.documentElement.classList.contains('theme-dark') || 
                     (!document.documentElement.classList.contains('theme-light') && 
                      window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    if (!innerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    observer.observe(innerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleChange = (field: keyof R2Config, value: string) => {
    const newValue = value.trim();
    setConfig(prev => ({ ...prev, [field]: newValue }));
    
    // Validate on change if touched
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
      case 'accountId':
        error = validateAccountId(value);
        break;
      case 'bucketName':
        error = validateBucketName(value);
        break;
      case 'accessKeyId':
        error = validateAccessKeyId(value);
        break;
      case 'secretAccessKey':
        error = validateSecretAccessKey(value);
        break;
      case 'publicUrl':
        error = validatePublicUrl(value);
        break;
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      if (error) {
        newErrors[field] = error;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
    return !error;
  };

  const isStep1Valid = () => {
    return !validateAccountId(config.accountId || '') && !validateBucketName(config.bucketName || '');
  };

  const isStep2Valid = () => {
    return !validateAccessKeyId(config.accessKeyId || '') && !validateSecretAccessKey(config.secretAccessKey || '');
  };

  const handleFinish = async () => {
    if (config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName) {
      await persistence.setItem('r2Config', JSON.stringify(config));
      await persistence.setItem('storageLimit', storageLimit.toString());
      onComplete();
    }
  };

  const handleDebugFill = () => {
    const env = import.meta.env;
    const debugConfig: Partial<R2Config> = {
      accountId: env.VITE_R2_ACCOUNT_ID || '',
      accessKeyId: env.VITE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.VITE_R2_SECRET_ACCESS_KEY || '',
      bucketName: env.VITE_R2_BUCKET_NAME || '',
      publicUrl: env.VITE_R2_PUBLIC_URL || '',
    };
    
    setConfig(debugConfig);
    setStep(5); // Jump to CORS step
  };

  const renderStep0_Welcome = () => (
    <div className="wizard-step">
      <svg className="welcome-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="100" height="100" rx="22" ry="22" />
        <path d="m35 50 15-20 15 20Z" fill="#fff" />
        <path d="M62 76a16 16 0 0 0 13-28 22 22 0 0 0-50 0 16 16 0 0 0 7 28c10 0 18-5 18-20v-8" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="wizard-title">{t('wizard.welcome.title')}</h2>
      <p className="wizard-description">{t('wizard.welcome.subtitle')}</p>
      <div className="wizard-actions">
        <button className="btn-primary" onClick={handleNext}>
          {t('wizard.welcome.start')}
        </button>
        {import.meta.env.DEV && (
          <button 
            className="btn-secondary" 
            onClick={handleDebugFill}
            style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.7 }}
          >
            Debug: Fill & Jump to CORS
          </button>
        )}
      </div>
    </div>
  );

  const renderStep1_Account = () => (
    <div className="wizard-step">
      <h2 className="wizard-title">{t('wizard.step1.title')}</h2>
      <p className="wizard-description">{t('wizard.step1.description')}</p>
      <div className="wizard-form">
        <div className="form-group">
          <label htmlFor="accountId">{t('settings.accountId')}</label>
          <input
            id="accountId"
            type="text"
            value={config.accountId || ''}
            onChange={(e) => handleChange('accountId', e.target.value)}
            onBlur={() => handleBlur('accountId')}
            placeholder={t('settings.accountIdPlaceholder')}
            className={errors.accountId ? 'error' : ''}
            autoFocus
          />
          {errors.accountId && <span className="error-message">{t(errors.accountId)}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="bucketName">{t('settings.bucketName')}</label>
          <input
            id="bucketName"
            type="text"
            value={config.bucketName || ''}
            onChange={(e) => handleChange('bucketName', e.target.value)}
            onBlur={() => handleBlur('bucketName')}
            placeholder={t('settings.bucketNamePlaceholder')}
            className={errors.bucketName ? 'error' : ''}
          />
          {errors.bucketName && <span className="error-message">{t(errors.bucketName)}</span>}
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
        <button 
          className="btn-primary" 
          onClick={handleNext}
          disabled={!isStep1Valid()}
        >
          {t('wizard.next')}
        </button>
      </div>
    </div>
  );

  const renderStep2_Credentials = () => (
    <div className="wizard-step">
      <h2 className="wizard-title">{t('wizard.step2.title')}</h2>
      <p className="wizard-description">{t('wizard.step2.description')}</p>
      <div className="wizard-form">
        <div className="form-group">
          <label htmlFor="accessKeyId">{t('settings.accessKeyId')}</label>
          <input
            id="accessKeyId"
            type="text"
            value={config.accessKeyId || ''}
            onChange={(e) => handleChange('accessKeyId', e.target.value)}
            onBlur={() => handleBlur('accessKeyId')}
            placeholder={t('settings.accessKeyIdPlaceholder')}
            className={errors.accessKeyId ? 'error' : ''}
            autoFocus
          />
          {errors.accessKeyId && <span className="error-message">{t(errors.accessKeyId)}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="secretAccessKey">{t('settings.secretAccessKey')}</label>
          <input
            id="secretAccessKey"
            type="password"
            value={config.secretAccessKey || ''}
            onChange={(e) => handleChange('secretAccessKey', e.target.value)}
            onBlur={() => handleBlur('secretAccessKey')}
            placeholder={t('settings.secretAccessKeyPlaceholder')}
            className={errors.secretAccessKey ? 'error' : ''}
          />
          {errors.secretAccessKey && <span className="error-message">{t(errors.secretAccessKey)}</span>}
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
        <button 
          className="btn-primary" 
          onClick={handleNext}
          disabled={!isStep2Valid()}
        >
          {t('wizard.next')}
        </button>
      </div>
    </div>
  );

  const renderStep3_PublicUrl = () => {
    const getDisplayUrl = () => {
      if (!config.publicUrl) return '';
      return config.publicUrl.replace(/^https?:\/\//, '');
    };

    return (
      <div className="wizard-step">
        <h2 className="wizard-title">{t('wizard.step3.title')}</h2>
        <p className="wizard-description">{t('wizard.step3.description')}</p>
        <div className="wizard-form">
          <div className="form-group">
            <label htmlFor="publicUrl">{t('settings.publicUrl')}</label>
            <div className="url-input-group">
              <span className="url-prefix">https://</span>
              <input
                id="publicUrl"
                type="text"
                value={getDisplayUrl()}
                onChange={(e) => handleChange('publicUrl', e.target.value ? `https://${e.target.value}` : '')}
                placeholder="your-domain.com"
                autoFocus
                className="url-input"
              />
            </div>
            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}>
              {t('settings.publicUrlHint')}
            </small>
          </div>
        </div>
        <div className="wizard-actions">
          <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
          <button className="btn-primary" onClick={handleNext}>
            {t('wizard.next')}
          </button>
        </div>
      </div>
    );
  };

  const renderStep4_StorageLimit = () => (
    <div className="wizard-step">
      <h2 className="wizard-title">{t('wizard.step4.title')}</h2>
      <p className="wizard-description">{t('wizard.step4.description')}</p>
      <div className="wizard-form">
        <div className="form-group">
          <label htmlFor="storageLimit">{t('settings.storageLimit')} (GB)</label>
          <input
            id="storageLimit"
            type="number"
            min="1"
            value={storageLimit}
            onChange={(e) => setStorageLimit(Math.max(1, parseInt(e.target.value, 10) || 0))}
            className="storage-input"
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '1rem'
            }}
          />
          <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}>
            {t('settings.storageLimitHint')}
          </small>
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
        <button className="btn-primary" onClick={handleNext}>
          {t('wizard.next')}
        </button>
      </div>
    </div>
  );

  const renderStep5_CORS = () => {
    const origin = window.location.origin;
    const corsConfig = [
      {
        "AllowedOrigins": [
          origin
        ],
        "AllowedMethods": [
          "GET",
          "PUT",
          "POST",
          "DELETE",
          "HEAD"
        ],
        "AllowedHeaders": [
          "*"
        ],
        "ExposeHeaders": [
          "ETag"
        ],
        "MaxAgeSeconds": 3000
      }
    ];
    const corsString = JSON.stringify(corsConfig, null, 2);

    const copyToClipboard = () => {
      navigator.clipboard.writeText(corsString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleCheckCors = async () => {
      setCorsStatus('loading');
      setCorsMessage('');
      try {
        const r2Config = config as R2Config;
        const exists = await getBucketCors(r2Config);
        if (exists) {
          setCorsStatus('success');
          setCorsMessage(t('wizard.step5.checkSuccess'));
        } else {
          setCorsStatus('error');
          setCorsMessage(t('wizard.step5.checkNotFound'));
        }
      } catch (error: any) {
        setCorsStatus('error');
        setCorsMessage(t('wizard.step5.checkError') + ': ' + error.message);
      }
    };

    return (
      <div className="wizard-step">
        <h2 className="wizard-title">{t('wizard.step5.title')}</h2>
        <p className="wizard-description">{t('wizard.step5.description')}</p>
        
        <div className="wizard-form">
          <div className="cors-actions" style={{ marginBottom: '1.5rem', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className={`btn-secondary cors-check-button ${corsStatus}`} 
              onClick={handleCheckCors}
              disabled={corsStatus === 'loading' || corsStatus === 'success'}
              style={{ flex: 1 }}
            >
              {corsStatus === 'idle' && t('wizard.step5.checkConfig')}
              {corsStatus === 'loading' && (
                <>
                  <span className="spinner-small"></span> {t('wizard.step5.checkConfig')}...
                </>
              )}
              {corsStatus === 'success' && (
                <>
                  <span className="check-icon">✓</span> {t('wizard.step5.checkSuccess')}
                </>
              )}
              {corsStatus === 'error' && (
                <>
                  <span className="error-icon">✕</span> {corsMessage || t('wizard.step5.checkError')}
                </>
              )}
            </button>
          </div>

          <div className="form-group">
            <label>{t('wizard.step5.manualLabel')}</label>
            <div style={{ position: 'relative' }}>
              <SyntaxHighlighter
                language="json"
                style={isDarkMode ? vscDarkPlus : vs}
                customStyle={{
                  margin: 0,
                  padding: '1rem',
                  borderRadius: '8px',
                  fontSize: '12px',
                  height: '150px',
                  backgroundColor: isDarkMode ? 'var(--bg-secondary)' : '#f5f5f5',
                  border: '1px solid var(--border-color)',
                }}
              >
                {corsString}
              </SyntaxHighlighter>
              <button 
                className="btn-secondary"
                style={{ 
                  position: 'absolute', 
                  top: '8px', 
                  right: '8px', 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: copied ? '#4caf50' : 'inherit',
                  borderColor: copied ? '#4caf50' : 'var(--border-color)',
                  zIndex: 10
                }}
                onClick={copyToClipboard}
              >
                {copied ? t('fileCard.copied') : t('wizard.step5.copy')}
              </button>
            </div>
            <small style={{ display: 'block', marginTop: '4px', color: 'var(--text-secondary)' }}>
              {t('wizard.step5.pasteHint')}
            </small>
          </div>
        </div>
        <div className="wizard-actions">
          <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
          <button 
            className="btn-primary" 
            onClick={handleNext}
            disabled={corsStatus !== 'success'}
          >
            {t('wizard.next')}
          </button>
        </div>
      </div>
    );
  };

  const renderStep6_Lifecycle = () => {
    const handleApplyLifecycle = async () => {
      setLifecycleStatus('loading');
      setLifecycleMessage('');
      try {
        const rules = [{
          id: lifecycleRuleName,
          prefix: lifecyclePrefix,
          status: lifecycleEnabled ? 'Enabled' : 'Disabled',
          expirationDays: lifecycleDays,
          abortIncompleteMultipartUpload: lifecycleAbortMultipart ? lifecycleAbortDays : undefined
        }];
        
        await putBucketLifecycle(config as R2Config, rules);
        setLifecycleStatus('success');
        setLifecycleMessage('Lifecycle policy applied successfully!');
      } catch (error: any) {
        setLifecycleStatus('error');
        setLifecycleMessage('Error applying policy: ' + error.message);
      }
    };

    return (
      <div className="wizard-step">
        <h2 className="wizard-title">{t('wizard.step6.title')}</h2>
        <p className="wizard-description">{t('wizard.step6.description')}</p>
        
        <div className="wizard-form lifecycle-form">
          <div className="lifecycle-card">
            <div className="form-group toggle-group">
              <label htmlFor="lifecycle-toggle" className="toggle-label">
                Object lifecycle rule is {lifecycleEnabled ? 'enabled' : 'disabled'}
              </label>
              <label className="switch">
                <input 
                  id="lifecycle-toggle"
                  type="checkbox" 
                  checked={lifecycleEnabled}
                  onChange={(e) => setLifecycleEnabled(e.target.checked)}
                />
                <span className="switch-slider"></span>
              </label>
            </div>

            <div className={`lifecycle-settings ${!lifecycleEnabled ? 'disabled' : ''}`}>
              <div className="form-group">
                <label htmlFor="rule-name">Rule name</label>
                <input
                  id="rule-name"
                  type="text"
                  value={lifecycleRuleName}
                  onChange={(e) => setLifecycleRuleName(e.target.value)}
                  placeholder="e.g., Delete temp files"
                  disabled={!lifecycleEnabled}
                />
              </div>

              <div className="form-group">
                <label htmlFor="rule-prefix">Rule scope: Apply to objects with the following prefix (optional)</label>
                <input
                  id="rule-prefix"
                  type="text"
                  value={lifecyclePrefix}
                  onChange={(e) => setLifecyclePrefix(e.target.value)}
                  placeholder="e.g., logs/"
                  disabled={!lifecycleEnabled}
                />
              </div>

              <div className="form-group lifecycle-actions">
                <label className="section-label">Lifecycle action: Select at least one lifecycle action.</label>
                
                <div className="checkbox-group">
                  <div className="checkbox-row">
                    <input 
                      id="delete-objects"
                      type="checkbox" 
                      checked={true} 
                      readOnly
                      disabled={!lifecycleEnabled}
                    />
                    <label htmlFor="delete-objects">Delete uploaded objects after:</label>
                  </div>
                  <div className="input-row">
                    <input 
                      type="number" 
                      min="1" 
                      value={lifecycleDays}
                      onChange={(e) => setLifecycleDays(parseInt(e.target.value) || 1)}
                      className="days-input"
                      disabled={!lifecycleEnabled}
                    />
                    <span className="unit">Days</span>
                  </div>
                </div>

                <div className="checkbox-group">
                  <div className="checkbox-row">
                    <input 
                      id="abort-multipart"
                      type="checkbox" 
                      checked={lifecycleAbortMultipart}
                      onChange={(e) => setLifecycleAbortMultipart(e.target.checked)}
                      disabled={!lifecycleEnabled}
                    />
                    <label htmlFor="abort-multipart">Abort incomplete multipart uploads after:</label>
                  </div>
                  {lifecycleAbortMultipart && (
                    <div className="input-row">
                      <input 
                        type="number" 
                        min="1" 
                        value={lifecycleAbortDays}
                        onChange={(e) => setLifecycleAbortDays(parseInt(e.target.value) || 1)}
                        className="days-input"
                        disabled={!lifecycleEnabled}
                      />
                      <span className="unit">Days</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          <div className="cors-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
            {lifecycleStatus === 'success' ? (
              <>
                <div className="success-message" style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, fontWeight: 500 }}>
                  <span className="check-icon">✓</span> Policy Applied!
                </div>
                <button 
                  className="btn-secondary"
                  onClick={handleApplyLifecycle}
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  Reapply
                </button>
              </>
            ) : (
              <button 
                className={`btn-secondary cors-check-button ${lifecycleStatus}`} 
                onClick={handleApplyLifecycle}
                disabled={lifecycleStatus === 'loading'}
                style={{ width: '100%' }}
              >
                {lifecycleStatus === 'idle' && 'Apply Lifecycle Policy'}
                {lifecycleStatus === 'loading' && (
                  <>
                    <span className="spinner-small"></span> Applying...
                  </>
                )}
                {lifecycleStatus === 'error' && (
                  <>
                    <span className="error-icon">✕</span> {lifecycleMessage || 'Error'} - Retry
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="wizard-actions">
          <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
          <button className="btn-primary" onClick={handleNext}>
            {t('wizard.next')}
          </button>
        </div>
      </div>
    );
  };

  const renderStep7_Completion = () => (
    <div className="wizard-step">
      <svg className="completion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <h2 className="wizard-title">{t('wizard.completion.title')}</h2>
      <p className="wizard-description">{t('wizard.completion.subtitle')}</p>
      <div className="wizard-actions">
        <button className="btn-primary" onClick={handleFinish}>
          {t('wizard.completion.finish')}
        </button>
      </div>
    </div>
  );

  const steps = [
    renderStep0_Welcome,
    renderStep1_Account,
    renderStep2_Credentials,
    renderStep3_PublicUrl,
    renderStep4_StorageLimit,
    renderStep5_CORS,
    renderStep6_Lifecycle,
    renderStep7_Completion
  ];

  const renderInstructions = () => {
    if (step === 0 || step === 7) return null;

    const instructionKey = `wizard.step${step}.instructions`;
    
    return (
      <div className="wizard-instructions">
        <div key={step} className="instruction-animation-wrapper">
          <h3 className="instructions-title">{t(`${instructionKey}.title`)}</h3>
          <ol className="instructions-list">
            <li>{t(`${instructionKey}.step1`)}</li>
            <li>{t(`${instructionKey}.step2`)}</li>
            <li>{t(`${instructionKey}.step3`)}</li>
            {step !== 3 && step !== 4 && <li>{t(`${instructionKey}.step4`)}</li>}
          </ol>
        </div>
      </div>
    );
  };

  const hasInstructions = step > 0 && step < 7;

  return (
    <div 
      className={`wizard-container ${hasInstructions ? 'has-instructions' : ''}`}
      style={{ height: height ? `${height}px` : 'auto' }}
    >
      {step === 0 && onHighContrastChange && (
        <button 
          className="high-contrast-toggle-corner"
          onClick={() => onHighContrastChange(!highContrast)}
          title={highContrast ? t('settings.highContrastOff') : t('settings.highContrastOn')}
          aria-label={highContrast ? t('settings.highContrastOff') : t('settings.highContrastOn')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-2V4a8 8 0 1 1 0 16z"/>
          </svg>
        </button>
      )}
      <div 
        className={`wizard-inner ${hasInstructions ? 'has-instructions' : ''}`}
        ref={innerRef}
      >
        <div className="wizard-main">
          <div className="wizard-header">
            <div className="wizard-progress">
              {steps.map((_, index) => (
                <div 
                  key={index} 
                  className={`progress-dot ${index === step ? 'active' : ''} ${index < step ? 'completed' : ''}`}
                />
              ))}
            </div>
          </div>
          <div className="wizard-content">
            <div key={step} className="step-animation-wrapper">
              {steps[step]()}
            </div>
          </div>
        </div>
        {renderInstructions()}
      </div>
    </div>
  );
};

export default OnboardingWizard;
