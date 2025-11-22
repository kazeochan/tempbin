import React from 'react';
import './Skeleton.css';
import './MainSkeleton.css';

const MainSkeleton: React.FC = () => {
  return (
    <div className="main-skeleton skeleton-overlay">
      {/* Header Skeleton */}
      <div className="skeleton-header-container">
        <div className="skeleton-logo skeleton-shimmer"></div>
        <div className="skeleton-header-actions">
          <div className="skeleton-action-btn skeleton-shimmer"></div>
          <div className="skeleton-action-btn skeleton-shimmer"></div>
          <div className="skeleton-action-btn skeleton-shimmer"></div>
          <div className="skeleton-action-btn skeleton-shimmer"></div>
        </div>
      </div>

      <main className="main-content">
        <div className="container">
          {/* Hero Skeleton */}
          <div className="skeleton-hero">
            <div className="skeleton-title skeleton-shimmer"></div>
            <div className="skeleton-subtitle skeleton-shimmer"></div>
          </div>

          {/* Controls Skeleton */}
          <div className="skeleton-controls">
            <div className="skeleton-control-item">
              <div className="skeleton-label skeleton-shimmer"></div>
              <div className="skeleton-slider skeleton-shimmer"></div>
              <div className="skeleton-label skeleton-shimmer" style={{ width: '100%', marginTop: '0.5rem' }}></div>
            </div>
            <div className="skeleton-control-item">
              <div className="skeleton-label skeleton-shimmer"></div>
              <div className="skeleton-toggle skeleton-shimmer"></div>
            </div>
          </div>

          {/* Upload Zone Skeleton */}
          <div className="skeleton-upload-zone">
            <div className="skeleton-upload-icon skeleton-shimmer"></div>
            <div className="skeleton-upload-text skeleton-shimmer"></div>
            <div className="skeleton-upload-text skeleton-shimmer" style={{ width: '150px', height: '16px' }}></div>
          </div>

          {/* File List Skeleton */}
          <div className="skeleton-file-list">
            <div className="skeleton-list-header">
              <div className="skeleton-list-title skeleton-shimmer"></div>
            </div>
            <div className="skeleton-table">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton-checkbox skeleton-shimmer"></div>
                  <div className="skeleton-cell skeleton-shimmer" style={{ width: '60%' }}></div>
                  <div className="skeleton-cell skeleton-shimmer"></div>
                  <div className="skeleton-cell skeleton-shimmer"></div>
                  <div className="skeleton-cell skeleton-shimmer"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainSkeleton;
