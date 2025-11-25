
import React, { useState, useEffect } from 'react';
import './FileCard.css';
import { FileItem } from '../../types';
import FileIcon from '../FileIcon/FileIcon';

interface FileCardProps {
  file: FileItem;
  onDelete: (fileId: string) => void;
}

const FileCard: React.FC<FileCardProps> = ({ file, onDelete }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [progress, setProgress] = useState<number>(100);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const remaining = file.expiresAt - now;
      const total = file.expiresAt - file.uploadedAt;
      
      if (remaining <= 0) {
        setTimeLeft('Expired');
        setProgress(0);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        setProgress((remaining / total) * 100);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [file]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(file.url);
      const button = document.getElementById(`copy-${file.id}`);
      if (button) {
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = 'Copy Link';
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete(file.id);
    }, 500);
  };

  return (
    <div className={`file-card ${isDeleting ? 'deleting' : ''}`}>
      <div className="file-header">
        <div className="file-icon">
          <FileIcon fileName={file.name} />
        </div>
        <button 
          className="delete-button"  
          onClick={handleDelete}
          title="Delete file"
          aria-label={`Delete ${file.name}`}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="file-info">
        <h3 className="file-name" title={file.name}>{file.name}</h3>
        <p className="file-size">{formatFileSize(file.size)}</p>
      </div>

      <div className="file-timer">
        <div className="timer-header">
          <svg className="timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="time-left">{timeLeft}</span>
        </div>
        <div 
          className="progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Time remaining: ${timeLeft}`}
        >
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="file-actions">
        <button 
          id={`copy-${file.id}`}
          className="action-button primary" 
          onClick={handleCopyLink}
          aria-label={`Copy link for ${file.name}`}
          type="button"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Copy Link
        </button>
        <a 
          href={file.url} 
          className="action-button secondary" 
          target="_blank" 
          rel="noopener noreferrer"
          aria-label={`Open ${file.name} in new tab`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open
        </a>
      </div>
    </div>
  );
};

export default FileCard;
