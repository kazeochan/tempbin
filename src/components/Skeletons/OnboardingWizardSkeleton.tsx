import React from 'react';
import '../OnboardingWizard/OnboardingWizard.css';
import './Skeleton.css';
import './OnboardingWizardSkeleton.css';

const OnboardingWizardSkeleton: React.FC = () => {
  return (
    <div className="wizard-container skeleton-wizard-container">
      <div className="wizard-inner">
        <div className="wizard-main">
          <div className="wizard-header">
            <div className="wizard-progress">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="skeleton-pulse skeleton-dot"></div>
              ))}
            </div>
          </div>
          <div className="wizard-content">
            <div className="skeleton-pulse skeleton-wizard-icon"></div>
            <div className="skeleton-pulse skeleton-wizard-title"></div>
            <div className="skeleton-pulse skeleton-wizard-desc"></div>
            
            <div className="wizard-form" style={{ width: '100%', marginTop: '20px' }}>
              <div className="form-group">
                <div className="skeleton-pulse skeleton-label"></div>
                <div className="skeleton-pulse skeleton-input"></div>
              </div>
            </div>

            <div className="wizard-actions">
              <div className="skeleton-pulse skeleton-button"></div>
              <div className="skeleton-pulse skeleton-button" style={{ flex: 1 }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizardSkeleton;
