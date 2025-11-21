import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './App.css';
import UploadZone from './components/UploadZone/UploadZone';
import FileList from './components/FileList/FileList';
import Header from './components/Header/Header';
import Settings from './components/Settings/Settings';
import OnboardingWizard from './components/OnboardingWizard/OnboardingWizard';
import { FileItem, R2Config } from './types';
import { uploadFileToR2, deleteFileFromR2, getFilesList } from './services/r2Service';
import { persistence } from './utils/persistence';

function App() {
  const { t, i18n } = useTranslation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notificationFadeOut, setNotificationFadeOut] = useState(false);
  const [fileListFadeOut, setFileListFadeOut] = useState(false);
  const [expirationMinutes, setExpirationMinutes] = useState(10);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hashFilenames, setHashFilenames] = useState(true);

  useEffect(() => {
    loadFiles();
    checkExpiredFiles();
    checkR2Settings();
    const interval = setInterval(checkExpiredFiles, 10000); // Check every 10 seconds
    
    const savedExpiration = localStorage.getItem('fileExpirationMinutes');
    if (savedExpiration) {
      setExpirationMinutes(parseInt(savedExpiration, 10));
    }
    
    const savedHashFilenames = localStorage.getItem('hashFilenames');
    if (savedHashFilenames !== null) {
      setHashFilenames(savedHashFilenames === 'true');
    }
    
    // Check for accessibility preferences
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const highContrastPref = localStorage.getItem('highContrast') === 'true';
    const reducedMotionPref = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setHighContrast(highContrastPref);
    setReducedMotion(reducedMotionPref);
    
    // Listen for system preference changes
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener('change', handleMotionChange);
    
    // Handle Escape key to close modals
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      clearInterval(interval);
      motionQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showSettings]);

  // Update document title when language changes
  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

  const loadFiles = async () => {
    try {
      const savedFiles = await persistence.getItem('files');
      if (savedFiles) {
        const parsedFiles: FileItem[] = JSON.parse(savedFiles);
        setFiles(parsedFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const checkR2Settings = async () => {
    try {
      const savedSettings = await persistence.getItem('r2Settings');
      if (!savedSettings) {
        setShowWizard(true);
      } else {
        const config: R2Config = JSON.parse(savedSettings);
        if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
          setShowWizard(true);
        }
      }
    } catch (error) {
      console.error('Error checking R2 settings:', error);
      setShowWizard(true);
    }
  };

  const saveFiles = async (updatedFiles: FileItem[]) => {
    try {
      await persistence.setItem('files', JSON.stringify(updatedFiles));
    } catch (error) {
      console.error('Error saving files:', error);
    }
  };

  const checkExpiredFiles = async () => {
    try {
      const savedFiles = await persistence.getItem('files');
      if (!savedFiles) return;

      const parsedFiles: FileItem[] = JSON.parse(savedFiles);
      const now = Date.now();
      const validFiles: FileItem[] = [];

      for (const file of parsedFiles) {
        if (now >= file.expiresAt) {
          // Delete expired file
          await deleteFileFromR2(file.id);
        } else {
          validFiles.push(file);
        }
      }

      if (validFiles.length !== parsedFiles.length) {
        setFiles(validFiles);
        await saveFiles(validFiles);
      }
    } catch (error) {
      console.error('Error checking expired files:', error);
    }
  };

  const handleExpirationChange = (minutes: number) => {
    setExpirationMinutes(minutes);
    localStorage.setItem('fileExpirationMinutes', minutes.toString());
  };

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    handleThemeChange(newTheme);
  };

  const handleHighContrastChange = (enabled: boolean) => {
    setHighContrast(enabled);
    localStorage.setItem('highContrast', enabled.toString());
  };

  const handleHashFilenamesChange = (enabled: boolean) => {
    setHashFilenames(enabled);
    localStorage.setItem('hashFilenames', enabled.toString());
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadFileToR2(file, hashFilenames);
      
      const expirationMs = expirationMinutes * 60 * 1000;
      
      const newFile: FileItem = {
        id: result.fileId,
        name: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        expiresAt: Date.now() + expirationMs,
        url: result.url,
      };

      const updatedFiles = [newFile, ...files];
      setFiles(updatedFiles);
      await saveFiles(updatedFiles);

      showNotification(t('notifications.uploadSuccess'), 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showNotification(t('notifications.uploadError'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFileFromR2(fileId);
      const updatedFiles = files.filter(f => f.id !== fileId);
      
      // If this is the last file, trigger fade-out animation
      if (updatedFiles.length === 0) {
        setFileListFadeOut(true);
        setTimeout(() => {
          setFiles(updatedFiles);
          setFileListFadeOut(false);
        }, 400);
      } else {
        setFiles(updatedFiles);
      }
      
      await saveFiles(updatedFiles);
      showNotification(t('notifications.deleteSuccess'), 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showNotification(t('notifications.deleteError'), 'error');
    }
  };

  const handleDeleteSelected = async (fileIds: string[]) => {
    try {
      await Promise.all(fileIds.map(id => deleteFileFromR2(id)));
      const updatedFiles = files.filter(f => !fileIds.includes(f.id));
      
      // If all files are being deleted, trigger fade-out animation
      if (updatedFiles.length === 0) {
        setFileListFadeOut(true);
        setTimeout(() => {
          setFiles(updatedFiles);
          setFileListFadeOut(false);
        }, 400);
      } else {
        setFiles(updatedFiles);
      }
      
      await saveFiles(updatedFiles);
      showNotification(t('notifications.deleteMultiSuccess', { count: fileIds.length }), 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showNotification(t('notifications.deleteMultiError'), 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setNotificationFadeOut(false);
    setTimeout(() => {
      setNotificationFadeOut(true);
      setTimeout(() => setNotification(null), 300);
    }, 2700);
  };

  return (
    <div className={`app theme-${theme} ${highContrast ? 'high-contrast' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}>
      <Header 
        onSettingsClick={() => setShowSettings(true)} 
        theme={theme}
        onThemeToggle={toggleTheme}
        showSettingsButton={!showWizard}
      />
      
      <main id="main-content" className="main-content" role="main" aria-label="File sharing application">
        <div className="container">
          {showWizard ? (
            <OnboardingWizard 
              onComplete={() => setShowWizard(false)} 
            />
          ) : (
            <>
              <div className="hero-section">
                <h1 className="hero-title">{t('hero.title')}</h1>
                <p className="hero-subtitle">
                  {t('hero.subtitle', { count: expirationMinutes, minutes: expirationMinutes })}
                </p>
              </div>

              <div className="controls-card">
                <div className="expiration-control" role="group" aria-labelledby="expiration-label">
                  <label id="expiration-label" htmlFor="mainExpirationSlider">
                    {t('expiration.label')} <strong aria-live="polite">{t('expiration.minutes', { count: expirationMinutes })}</strong>
                  </label>
                  <input
                    id="mainExpirationSlider"
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={expirationMinutes}
                    onChange={(e) => handleExpirationChange(parseInt(e.target.value, 10))}
                    className="expiration-slider"
                    aria-valuemin={1}
                    aria-valuemax={10}
                    aria-valuenow={expirationMinutes}
                    aria-valuetext={`${expirationMinutes} minute${expirationMinutes !== 1 ? 's' : ''}`}
                  />
                  <div className="slider-labels">
                    <span>{t('expiration.min1')}</span>
                    <span>{t('expiration.min5')}</span>
                    <span>{t('expiration.min10')}</span>
                  </div>
                </div>

                <div className="hash-filename-control" role="group" aria-labelledby="hash-filename-label">
                  <div className="hash-filename-item">
                    <div className="hash-filename-info">
                      <label id="hash-filename-label" htmlFor="hashFilenameToggle">{t('hashFilename.label')}</label>
                      <small>{t('hashFilename.hint')}</small>
                    </div>
                    <label className="switch">
                      <input
                        id="hashFilenameToggle"
                        type="checkbox"
                        checked={hashFilenames}
                        onChange={(e) => handleHashFilenamesChange(e.target.checked)}
                        aria-label={t('hashFilename.label')}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <UploadZone 
                onFileUpload={handleFileUpload} 
                isUploading={isUploading}
                expirationMinutes={expirationMinutes}
              />

              {files.length > 0 && (
                <FileList 
                  files={files} 
                  onDeleteFile={handleDeleteFile}
                  onDeleteSelected={handleDeleteSelected}
                  fadeOut={fileListFadeOut}
                />
              )}

              {files.length === 0 && !isUploading && (
                <div className="empty-state" role="status" aria-live="polite">
                  <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" role="img" aria-label="No files uploaded">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <h3>{t('empty.title')}</h3>
                  <p>{t('empty.subtitle')}</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {showSettings && (
        <Settings 
          onClose={() => setShowSettings(false)} 
          theme={theme}
          onThemeChange={handleThemeChange}
          highContrast={highContrast}
          onHighContrastChange={handleHighContrastChange}
        />
      )}

      {notification && (
        <div 
          className={`notification notification-${notification.type} ${notificationFadeOut ? 'fade-out' : ''}`}
          role="alert"
          aria-live="polite"
          aria-atomic="true"
        >
          {notification.message}
        </div>
      )}
    </div>
  );
}

export default App;
