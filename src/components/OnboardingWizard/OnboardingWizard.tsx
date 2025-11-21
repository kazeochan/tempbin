import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './OnboardingWizard.css';
import { R2Config } from '../../types';
import { persistence } from '../../utils/persistence';

interface OnboardingWizardProps {
  onComplete: () => void;
  initialConfig?: Partial<R2Config>;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, initialConfig }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Partial<R2Config>>(initialConfig || {});

  const handleNext = () => {
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleChange = (field: keyof R2Config, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleFinish = async () => {
    if (config.accountId && config.accessKeyId && config.secretAccessKey && config.bucketName) {
      await persistence.setItem('r2Settings', JSON.stringify(config));
      onComplete();
    }
  };

  const renderStep0_Welcome = () => (
    <div className="wizard-step">
      <svg className="welcome-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <h2 className="wizard-title">{t('wizard.welcome.title')}</h2>
      <p className="wizard-description">{t('wizard.welcome.subtitle')}</p>
      <div className="wizard-actions">
        <button className="btn-primary" onClick={handleNext}>
          {t('wizard.welcome.start')}
        </button>
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
            placeholder={t('settings.accountIdPlaceholder')}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="bucketName">{t('settings.bucketName')}</label>
          <input
            id="bucketName"
            type="text"
            value={config.bucketName || ''}
            onChange={(e) => handleChange('bucketName', e.target.value)}
            placeholder={t('settings.bucketNamePlaceholder')}
          />
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
        <button 
          className="btn-primary" 
          onClick={handleNext}
          disabled={!config.accountId || !config.bucketName}
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
            placeholder={t('settings.accessKeyIdPlaceholder')}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="secretAccessKey">{t('settings.secretAccessKey')}</label>
          <input
            id="secretAccessKey"
            type="password"
            value={config.secretAccessKey || ''}
            onChange={(e) => handleChange('secretAccessKey', e.target.value)}
            placeholder={t('settings.secretAccessKeyPlaceholder')}
          />
        </div>
      </div>
      <div className="wizard-actions">
        <button className="btn-secondary" onClick={handleBack}>{t('wizard.back')}</button>
        <button 
          className="btn-primary" 
          onClick={handleNext}
          disabled={!config.accessKeyId || !config.secretAccessKey}
        >
          {t('wizard.next')}
        </button>
      </div>
    </div>
  );

  const renderStep3_PublicUrl = () => (
    <div className="wizard-step">
      <h2 className="wizard-title">{t('wizard.step3.title')}</h2>
      <p className="wizard-description">{t('wizard.step3.description')}</p>
      <div className="wizard-form">
        <div className="form-group">
          <label htmlFor="publicUrl">{t('settings.publicUrl')}</label>
          <input
            id="publicUrl"
            type="text"
            value={config.publicUrl || ''}
            onChange={(e) => handleChange('publicUrl', e.target.value)}
            placeholder={t('settings.publicUrlPlaceholder')}
            autoFocus
          />
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

  const renderStep4_Completion = () => (
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
    renderStep4_Completion
  ];

  const renderInstructions = () => {
    if (step === 0 || step === 4) return null;

    const instructionKey = `wizard.step${step}.instructions`;
    
    return (
      <div className="wizard-instructions">
        <h3 className="instructions-title">{t(`${instructionKey}.title`)}</h3>
        <ol className="instructions-list">
          <li>{t(`${instructionKey}.step1`)}</li>
          <li>{t(`${instructionKey}.step2`)}</li>
          <li>{t(`${instructionKey}.step3`)}</li>
          {step !== 3 && <li>{t(`${instructionKey}.step4`)}</li>}
        </ol>
      </div>
    );
  };

  return (
    <div className={`wizard-container ${step > 0 && step < 4 ? 'has-instructions' : ''}`}>
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
          {steps[step]()}
        </div>
      </div>
      {renderInstructions()}
    </div>
  );
};

export default OnboardingWizard;
