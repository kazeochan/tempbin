import React from 'react';
import '../Settings/Settings.css';
import './Skeleton.css';
import './SettingsSkeleton.css';

const SettingsSkeleton: React.FC = () => {
  return (
    <div className="settings-overlay skeleton-overlay" role="presentation">
      <div className="settings-modal skeleton-settings-modal">
        <div className="settings-header">
          <div className="skeleton-pulse skeleton-title" style={{ width: '150px', margin: 0 }}></div>
          <div className="skeleton-pulse skeleton-close-button"></div>
        </div>

        <div className="settings-content">
          <div className="r2-section">
            <div className="skeleton-pulse skeleton-section-title"></div>
            
            <div className="skeleton-pulse skeleton-info-box"></div>

            {[1, 2, 3, 4].map((i) => (
              <div className="form-group" key={i}>
                <div className="skeleton-pulse skeleton-label"></div>
                <div className="skeleton-pulse skeleton-input"></div>
              </div>
            ))}
          </div>

          <div className="appearance-section">
            <div className="skeleton-pulse skeleton-section-title"></div>
            
            <div className="toggle-group">
              {[1, 2, 3].map((i) => (
                <div className="toggle-item" key={i}>
                  <div className="toggle-info">
                    <div className="skeleton-pulse skeleton-label" style={{ width: '100px' }}></div>
                    <div className="skeleton-pulse skeleton-text" style={{ width: '180px', height: '12px' }}></div>
                  </div>
                  <div className="skeleton-pulse skeleton-toggle-control"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="settings-actions">
            <div className="skeleton-pulse skeleton-button" style={{ marginRight: 'auto', width: '120px' }}></div>
            <div className="skeleton-pulse skeleton-button"></div>
            <div className="skeleton-pulse skeleton-button"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsSkeleton;
