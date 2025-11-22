import React from 'react';
import '../PasteConfirmation/PasteConfirmation.css';
import './Skeleton.css';
import './PasteConfirmationSkeleton.css';

const PasteConfirmationSkeleton: React.FC = () => {
  return (
    <div className="paste-overlay skeleton-overlay" role="presentation">
      <div className="paste-modal skeleton-paste-modal">
        <div className="paste-header">
          <div className="skeleton-pulse skeleton-title" style={{ width: '200px', margin: 0 }}></div>
          <div className="skeleton-pulse skeleton-close-button"></div>
        </div>

        <div className="paste-content">
          <div className="skeleton-pulse skeleton-preview-box"></div>

          <div className="skeleton-pulse skeleton-details-box"></div>

          <div className="paste-actions">
            <div className="skeleton-pulse skeleton-button"></div>
            <div className="skeleton-pulse skeleton-button"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteConfirmationSkeleton;
