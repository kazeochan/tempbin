
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './UploadZone.css';

interface UploadZoneProps {
  onFileUpload: (files: File[]) => void;
  isUploading: boolean;
  expirationMinutes: number;
  progress?: number;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFileUpload, isUploading, expirationMinutes, progress }) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [cardRotation, setCardRotation] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isUploading) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate percentage position
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    setMousePosition({ x: xPercent, y: yPercent });
    
    // Calculate rotation based on mouse position (-8 to 8 degrees)
    const rotateY = ((x / rect.width) - 0.5) * 16;
    const rotateX = ((y / rect.height) - 0.5) * -16;
    
    setCardRotation({ x: rotateX, y: rotateY });
  };

  const handleMouseLeave = () => {
    setCardRotation({ x: 0, y: 0 });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(Array.from(files));
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div 
      ref={cardRef}
      className={`upload-zone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-label={t('upload.ariaLabel')}
      aria-busy={isUploading}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        transform: `perspective(1000px) rotateX(${cardRotation.x}deg) rotateY(${cardRotation.y}deg)`,
        transition: 'transform 0.15s ease-out'
      }}
    >
      <div 
        className="upload-light"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(255, 255, 255, 0.15) 0%, transparent 50%)`
        }}
      ></div>
      
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        aria-label="File upload input"
      />
      
      <div className={`upload-content ${isUploading ? 'fade-out' : 'fade-in'}`} aria-hidden={isUploading}>
        <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <h3 className="upload-title">{t('upload.title')}</h3>
        <p className="upload-subtitle">{t('upload.subtitle')}</p>
        <div className="upload-info">
          <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('upload.info', { count: expirationMinutes, minutes: expirationMinutes })}
        </div>
      </div>

      <div className={`upload-loading ${isUploading ? 'fade-in' : 'fade-out'}`} aria-live="polite" aria-atomic="true">
        <div className="upload-spinner" role="status" aria-label="Uploading file"></div>
        <p className="upload-text">{t('upload.uploading')}</p>
        {progress !== undefined && (
          <>
            <div 
              className="progress-container"
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-text">{Math.round(progress)}%</span>
          </>
        )}
      </div>
    </div>
  );
};

export default UploadZone;
