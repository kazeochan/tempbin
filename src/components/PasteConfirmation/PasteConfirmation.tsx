import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './PasteConfirmation.css';
import FileIcon from '../FileIcon/FileIcon';

interface PasteConfirmationProps {
  files: File[];
  onConfirm: () => void;
  onCancel: () => void;
}

const PasteConfirmation: React.FC<PasteConfirmationProps> = ({ files, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>('text');
  const [isClosing, setIsClosing] = useState(false);
  const isDarkMode = document.documentElement.classList.contains('theme-dark') || 
                     (!document.documentElement.classList.contains('theme-light') && 
                      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const singleFile = files.length === 1 ? files[0] : null;

  useEffect(() => {
    if (!singleFile) return;

    if (singleFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(singleFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else if (
      singleFile.type.startsWith('text/') || 
      singleFile.type === 'application/json' ||
      singleFile.type === 'application/javascript' ||
      singleFile.type === 'application/xml' ||
      /\.(txt|md|json|js|jsx|ts|tsx|css|html|xml|yml|yaml|py|rb|java|c|cpp|h|cs|go|rs|php|sh|bat|ps1)$/i.test(singleFile.name)
    ) {
      // Detect language
      const ext = singleFile.name.split('.').pop()?.toLowerCase();
      let lang = 'text';
      if (ext) {
        const langMap: Record<string, string> = {
          'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
          'py': 'python', 'rb': 'ruby', 'java': 'java', 'c': 'c', 'cpp': 'cpp',
          'cs': 'csharp', 'go': 'go', 'rs': 'rust', 'php': 'php', 'sh': 'bash',
          'html': 'html', 'css': 'css', 'json': 'json', 'xml': 'xml',
          'yml': 'yaml', 'yaml': 'yaml', 'md': 'markdown'
        };
        if (langMap[ext]) lang = langMap[ext];
      }
      setLanguage(lang);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setPreviewText(text.slice(0, 2000) + (text.length > 2000 ? '\n... (truncated)' : ''));
      };
      reader.readAsText(singleFile.slice(0, 2000));
    }
  }, [singleFile]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onCancel();
    }, 300);
  };

  const handleConfirm = () => {
    setIsClosing(true);
    setTimeout(() => {
      onConfirm();
    }, 300);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className={`paste-overlay ${isClosing ? 'closing' : ''}`} onClick={handleOverlayClick} role="presentation">
      <div 
        className={`paste-modal ${isClosing ? 'closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paste-dialog-title"
      >
        <div className="paste-header">
          <h2 className="paste-title" id="paste-dialog-title">
            {files.length > 1 
              ? t('paste.titleMulti', { count: files.length, defaultValue: 'Confirm Upload ({{count}} files)' }) 
              : t('paste.title', 'Confirm Upload')}
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

        <div className="paste-content">
          {singleFile ? (
            <>
              <div className="file-preview-container">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="file-preview-image" />
                ) : previewText ? (
                  <div className="code-preview-wrapper">
                    <div className="code-language-label">{language}</div>
                    <SyntaxHighlighter
                      language={language}
                      style={isDarkMode ? vscDarkPlus : vs}
                      customStyle={{
                        margin: 0,
                        padding: '1rem',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        maxHeight: '300px',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {previewText}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <div className="file-preview-icon">
                    <FileIcon fileName={singleFile.name} />
                  </div>
                )}
              </div>

              <div className="file-details">
                <div className="detail-row">
                  <span className="detail-label">{t('paste.fileName', 'Name')}:</span>
                  <span className="detail-value">{singleFile.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('paste.fileSize', 'Size')}:</span>
                  <span className="detail-value">{formatFileSize(singleFile.size)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('paste.fileType', 'Type')}:</span>
                  <span className="detail-value">{singleFile.type || 'Unknown'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="multi-file-preview">
              <div className="file-list-preview">
                {files.map((f, i) => (
                  <div key={i} className="file-preview-item">
                    <div className="file-preview-item-icon">
                      <FileIcon fileName={f.name} />
                    </div>
                    <div className="file-preview-item-details">
                      <div className="file-preview-item-name">{f.name}</div>
                      <div className="file-preview-item-size">{formatFileSize(f.size)}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="total-size">
                {t('paste.totalSize', 'Total Size')}: {formatFileSize(files.reduce((acc, f) => acc + f.size, 0))}
              </div>
            </div>
          )}

          <div className="paste-actions">
            <button className="button secondary" onClick={handleClose} type="button">
              {t('paste.cancel', 'Cancel')}
            </button>
            <button 
              className="button primary" 
              onClick={handleConfirm}
              type="button"
            >
              {t('paste.upload', 'Upload')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteConfirmation;
