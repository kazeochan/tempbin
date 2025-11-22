import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LimitExceededModal.css';

interface LimitExceededModalProps {
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
  currentUsage: number;
  uploadSize: number;
  limitGB: number;
}

const LimitExceededModal: React.FC<LimitExceededModalProps> = ({ 
  onConfirm, 
  onCancel, 
  currentUsage, 
  uploadSize, 
  limitGB 
}) => {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 300);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      onConfirm(dontShowAgain);
    }, 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const limitBytes = limitGB * 1024 * 1024 * 1024;
  const newTotal = currentUsage + uploadSize;
  const exceedAmount = newTotal - limitBytes;

  return (
    <div className={`limit-overlay ${isClosing ? 'closing' : ''}`} onClick={handleOverlayClick} role="presentation">
      <div 
        className={`limit-modal ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="limit-dialog-title"
      >
        <div className="limit-header">
          <h2 className="limit-title" id="limit-dialog-title">
            {t('limit.title', 'Storage Limit Exceeded')}
          </h2>
          <button 
            className="close-button" 
            onClick={handleClose} 
            aria-label="Close"
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="limit-content">
          <div className="limit-warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <p className="limit-message">
            {t('limit.message', 'Uploading these files will exceed your storage limit.')}
          </p>
          
          <div className="limit-details">
            <div className="limit-row">
              <span>{t('limit.currentUsage', 'Current Usage')}:</span>
              <span>{formatSize(currentUsage)}</span>
            </div>
            <div className="limit-row">
              <span>{t('limit.uploadSize', 'Upload Size')}:</span>
              <span>{formatSize(uploadSize)}</span>
            </div>
            <div className="limit-row total">
              <span>{t('limit.newTotal', 'New Total')}:</span>
              <span className="limit-exceeded-value">{formatSize(newTotal)}</span>
            </div>
            <div className="limit-row limit">
              <span>{t('limit.limit', 'Limit')}:</span>
              <span>{limitGB} GB</span>
            </div>
          </div>

          <div className="limit-checkbox">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
              />
              <span>{t('limit.dontShowAgain', 'Don\'t show again for today')}</span>
            </label>
          </div>

          <div className="limit-actions">
            <button className="button secondary" onClick={handleClose} type="button">
              {t('limit.cancel', 'Cancel')}
            </button>
            <button 
              className="button primary warning" 
              onClick={handleConfirm}
              type="button"
            >
              {t('limit.continue', 'Continue Upload')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimitExceededModal;
