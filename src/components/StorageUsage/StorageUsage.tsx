import React from 'react';
import { useTranslation } from 'react-i18next';
import './StorageUsage.css';

interface StorageUsageProps {
  usedBytes: number;
  limitGB: number;
}

const StorageUsage: React.FC<StorageUsageProps> = ({ usedBytes, limitGB }) => {
  const { t } = useTranslation();
  
  const limitBytes = limitGB * 1024 * 1024 * 1024;
  const percentage = Math.min((usedBytes / limitBytes) * 100, 100);
  
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const isWarning = percentage > 80;
  const isCritical = percentage > 95;

  return (
    <div className="storage-usage">
      <div className="storage-header">
        <label className="storage-label">
          {t('storage.usage', 'Storage Usage')}
          <strong className="storage-value">
            {formatSize(usedBytes)} / {limitGB} GB
          </strong>
        </label>
      </div>
      <div className="storage-bar-container">
        <div 
          className={`storage-bar ${isCritical ? 'critical' : isWarning ? 'warning' : ''}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default StorageUsage;
