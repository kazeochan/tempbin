import React from 'react';
import '../LimitExceededModal/LimitExceededModal.css';
import './Skeleton.css';
import './LimitExceededModalSkeleton.css';

const LimitExceededModalSkeleton: React.FC = () => {
  return (
    <div className="limit-overlay skeleton-overlay" role="presentation">
      <div className="limit-modal skeleton-limit-modal">
        <div className="limit-header">
          <div className="skeleton-pulse skeleton-title" style={{ width: '220px', margin: 0 }}></div>
          <div className="skeleton-pulse skeleton-close-button"></div>
        </div>

        <div className="limit-content">
          <div className="limit-warning-icon">
            <div className="skeleton-pulse skeleton-icon-circle"></div>
          </div>
          
          <div className="skeleton-pulse skeleton-text" style={{ height: '40px', marginBottom: '1.5rem' }}></div>
          
          <div className="skeleton-pulse skeleton-details-box"></div>

          <div className="limit-checkbox" style={{ justifyContent: 'center' }}>
            <div className="skeleton-pulse skeleton-text" style={{ width: '200px' }}></div>
          </div>

          <div className="limit-actions">
            <div className="skeleton-pulse skeleton-button"></div>
            <div className="skeleton-pulse skeleton-button"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LimitExceededModalSkeleton;
