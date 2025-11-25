import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SpeedInsights } from "@vercel/speed-insights/react";
import './App.css';
import UploadZone from './components/UploadZone/UploadZone';
import FileList from './components/FileList/FileList';
import Header from './components/Header/Header';
import StorageUsage from './components/StorageUsage/StorageUsage';
import { FileItem, R2Config } from './types';
import { uploadFileToR2, deleteFileFromR2, calculateFileHash } from './services/r2Service';
import { persistence } from './utils/persistence';
import SettingsSkeleton from './components/Skeletons/SettingsSkeleton';
import OnboardingWizardSkeleton from './components/Skeletons/OnboardingWizardSkeleton';
import PasteConfirmationSkeleton from './components/Skeletons/PasteConfirmationSkeleton';
import LimitExceededModalSkeleton from './components/Skeletons/LimitExceededModalSkeleton';
import MainSkeleton from './components/Skeletons/MainSkeleton';

// Lazy load heavy or conditional components
const Settings = lazy(() => import('./components/Settings/Settings'));
const OnboardingWizard = lazy(() => import('./components/OnboardingWizard/OnboardingWizard'));
const PasteConfirmation = lazy(() => import('./components/PasteConfirmation/PasteConfirmation'));
const LimitExceededModal = lazy(() => import('./components/LimitExceededModal/LimitExceededModal'));

interface UploadItem {
  file: File;
  hash: string;
  displayName: string;
}

function App() {
  const { t, i18n } = useTranslation();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [pastedFiles, setPastedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notificationFadeOut, setNotificationFadeOut] = useState(false);
  const [fileListFadeOut, setFileListFadeOut] = useState(false);
  const [expirationMinutes, setExpirationMinutes] = useState(10);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hashFilenames, setHashFilenames] = useState(true);
  const [storageLimit, setStorageLimit] = useState<number>(10);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadItem[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await Promise.all([
          loadFiles(),
          checkR2Config(),
          loadStorageLimit()
        ]);
        await checkExpiredFiles();
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        // Small delay to ensure smooth transition
        setTimeout(() => setIsInitializing(false), 500);
      }
    };

    initializeApp();
    
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
    
    // Handle paste events
    const handlePaste = (e: ClipboardEvent) => {
      if (showSettings || showWizard || isUploading || pastedFiles.length > 0) return;
      
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const files = Array.from(e.clipboardData.files);
        setPastedFiles(files);
      }
    };
    window.addEventListener('paste', handlePaste);
    
    return () => {
      clearInterval(interval);
      motionQuery.removeEventListener('change', handleMotionChange);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('paste', handlePaste);
    };
  }, [showSettings, showWizard, isUploading, pastedFiles]);

  // Update document title when language changes
  useEffect(() => {
    document.title = t('app.title');
    document.documentElement.lang = i18n.language;
  }, [i18n.language, t]);

  // Update html/body background and theme-color meta tag when theme changes
  useEffect(() => {
    const bgColor = theme === 'dark' ? '#000000' : '#f5f5f5';
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
    
    // Update theme-color meta tag for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', bgColor);
    }
  }, [theme]);

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

  const checkR2Config = async () => {
    try {
      const savedConfig = await persistence.getItem('r2Config');
      if (!savedConfig) {
        setShowWizard(true);
      } else {
        const config: R2Config = JSON.parse(savedConfig);
        if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
          setShowWizard(true);
        }
      }
    } catch (error) {
      console.error('Error checking R2 config:', error);
      setShowWizard(true);
    }
  };

  const loadStorageLimit = async () => {
    try {
      const savedLimit = await persistence.getItem('storageLimit');
      if (savedLimit) {
        setStorageLimit(parseInt(savedLimit, 10));
      }
    } catch (error) {
      console.error('Error loading storage limit:', error);
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

  const handleExpirationChange = useCallback((minutes: number) => {
    setExpirationMinutes(minutes);
    localStorage.setItem('fileExpirationMinutes', minutes.toString());
  }, []);

  const handleThemeChange = useCallback((newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  const handleHighContrastChange = useCallback((enabled: boolean) => {
    setHighContrast(enabled);
    localStorage.setItem('highContrast', enabled.toString());
  }, []);

  const handleHashFilenamesChange = useCallback((enabled: boolean) => {
    setHashFilenames(enabled);
    localStorage.setItem('hashFilenames', enabled.toString());
  }, []);

  const asyncPool = async <T,>(
    concurrency: number,
    items: any[],
    fn: (item: any, index: number) => Promise<T>
  ): Promise<T[]> => {
    const results: T[] = [];
    const executing: Promise<void>[] = [];
    
    for (const [index, item] of items.entries()) {
      const p = Promise.resolve().then(() => fn(item, index));
      results[index] = p as any;
      
      const e = p.then((res) => {
        results[index] = res;
        executing.splice(executing.indexOf(e), 1);
      });
      executing.push(e);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    return Promise.all(results);
  };

  const handleFileUpload = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    const filesToProcess: UploadItem[] = [];
    let duplicateCount = 0;

    // We need to check against both existing files and files currently being processed in this batch
    const currentHashes = new Set(files.map(f => f.hash).filter(Boolean));
    const currentNames = new Set(files.map(f => f.name));
    
    // Also track names/hashes in the current batch to avoid duplicates within the batch
    const batchHashes = new Set<string>();
    const batchNames = new Set<string>();

    for (const file of filesToUpload) {
      const hash = await calculateFileHash(file);
      
      if (currentHashes.has(hash) || batchHashes.has(hash)) {
        duplicateCount++;
        continue;
      }

      let displayName = file.name;
      let counter = 1;
      
      while (currentNames.has(displayName) || batchNames.has(displayName)) {
        const dotIndex = file.name.lastIndexOf('.');
        if (dotIndex === -1) {
          displayName = `${file.name} (${counter})`;
        } else {
          const name = file.name.substring(0, dotIndex);
          const ext = file.name.substring(dotIndex);
          displayName = `${name} (${counter})${ext}`;
        }
        counter++;
      }

      batchHashes.add(hash);
      batchNames.add(displayName);
      
      filesToProcess.push({ file, hash, displayName });
    }

    if (duplicateCount > 0) {
       showNotification(t('notifications.duplicateFile'), 'error');
    }

    if (filesToProcess.length === 0) return;

    // Check storage limit
    const currentUsage = files.reduce((acc, f) => acc + f.size, 0);
    const uploadSize = filesToProcess.reduce((acc, item) => acc + item.file.size, 0);
    const limitBytes = storageLimit * 1024 * 1024 * 1024;
    
    // Check individual file size limit (e.g., 5GB to prevent browser crash/issues)
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
    const oversizedFiles = filesToProcess.filter(item => item.file.size > MAX_FILE_SIZE);
    
    if (oversizedFiles.length > 0) {
      showNotification(t('notifications.fileTooLarge', { size: '5GB' }), 'error');
      return;
    }

    if (currentUsage + uploadSize > limitBytes) {
      const dismissedDate = localStorage.getItem('storageLimitPromptDismissedDate');
      const today = new Date().toDateString();
      
      if (dismissedDate !== today) {
        setPendingFiles(filesToProcess);
        setShowLimitModal(true);
        return;
      }
    }
    
    await processUpload(filesToProcess);
  };

  const processUpload = async (items: UploadItem[]) => {
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const expirationMs = expirationMinutes * 60 * 1000;
      const fileProgresses = new Array(items.length).fill(0);
      const totalSize = items.reduce((acc, item) => acc + item.file.size, 0);
      
      const uploadedFiles = await asyncPool(2, items, async (item, index) => {
        const { file, hash, displayName } = item;
        const result = await uploadFileToR2(file, hashFilenames, (progress) => {
          fileProgresses[index] = progress;
          
          // Calculate weighted total progress
          const totalUploaded = items.reduce((acc, item, idx) => {
             return acc + (item.file.size * (fileProgresses[idx] / 100));
          }, 0);
          
          setUploadProgress((totalUploaded / totalSize) * 100);
        }, displayName);
        
        return {
          id: result.fileId,
          name: displayName,
          size: file.size,
          uploadedAt: Date.now(),
          expiresAt: Date.now() + expirationMs,
          url: result.url,
          hash: hash,
        } as FileItem;
      });

      const updatedFiles = [...uploadedFiles, ...files];
      setFiles(updatedFiles);
      await saveFiles(updatedFiles);

      if (items.length === 1) {
        showNotification(t('notifications.uploadSuccess'), 'success');
      } else {
        showNotification(t('notifications.uploadMultiSuccess', { count: items.length }), 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification(t('notifications.uploadError'), 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleLimitConfirm = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      localStorage.setItem('storageLimitPromptDismissedDate', new Date().toDateString());
    }
    setShowLimitModal(false);
    processUpload(pendingFiles);
    setPendingFiles([]);
  };

  const handleLimitCancel = () => {
    setShowLimitModal(false);
    setPendingFiles([]);
  };

  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      await deleteFileFromR2(fileId);
      
      // We need to access the current files state. 
      // Since we can't easily get the *updated* files list for saveFiles without using the state,
      // and we want to avoid 'files' dependency to prevent FileList re-renders when other things change,
      // we can use the functional update pattern for setFiles, but for saveFiles we might need to rely on the effect or just accept the dependency.
      // However, for this specific case, let's just use the dependency.
      // The performance gain of removing 'files' dependency is minimal if 'files' is the main thing changing.
      
      const updatedFiles = files.filter(f => f.id !== fileId);
      
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
  }, [files, t]);


  const handleDeleteSelected = useCallback(async (fileIds: string[]) => {
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
  }, [files, t]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setNotificationFadeOut(false);
    setTimeout(() => {
      setNotificationFadeOut(true);
      setTimeout(() => setNotification(null), 300);
    }, 5000);
  };

  return (
    <div className={`app theme-${theme} ${highContrast ? 'high-contrast' : ''} ${reducedMotion ? 'reduced-motion' : ''}`}>
      <SpeedInsights />
      {isInitializing ? (
        <MainSkeleton />
      ) : (
        <>
          <Header 
            onSettingsClick={() => setShowSettings(true)}  
            theme={theme}
            onThemeToggle={toggleTheme}
            showSettingsButton={!showWizard}
          />
          
          <main id="main-content" className="main-content" role="main" aria-label="File sharing application">
            <div className="container">
              {showWizard ? (
                <div className="lazy-component-wrapper">
                  <Suspense fallback={<OnboardingWizardSkeleton />}>
                    <OnboardingWizard 
                      onComplete={() => setShowWizard(false)}  
                      highContrast={highContrast}
                      onHighContrastChange={handleHighContrastChange}
                    />
                  </Suspense>
                </div>
              ) : (
                <>
                  <div className="hero-section">
                    <h1 className="hero-title">{t('hero.title')}</h1>
                    <p className="hero-subtitle">
                      {t('hero.subtitle', { count: expirationMinutes, minutes: expirationMinutes })}
                    </p>
                  </div>

                  <div className="controls-card">
                    <StorageUsage usedBytes={files.reduce((acc, f) => acc + f.size, 0)} limitGB={storageLimit} />
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
                    progress={uploadProgress}
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
        </>
      )}

      {showSettings && (
        <div className="lazy-modal-wrapper">
          <Suspense fallback={<SettingsSkeleton />}>
            <Settings 
              onClose={() => {
                setShowSettings(false);
                loadStorageLimit();
              }}
              theme={theme}
              onThemeChange={handleThemeChange}
              highContrast={highContrast}
              onHighContrastChange={handleHighContrastChange}
            />
          </Suspense>
        </div>
      )}

      {showLimitModal && (
        <div className="lazy-modal-wrapper" style={{ zIndex: 1100 }}>
          <Suspense fallback={<LimitExceededModalSkeleton />}>
            <LimitExceededModal
              onConfirm={handleLimitConfirm}
              onCancel={handleLimitCancel}
              currentUsage={files.reduce((acc, f) => acc + f.size, 0)}
              uploadSize={pendingFiles.reduce((acc, item) => acc + item.file.size, 0)}
              limitGB={storageLimit}
            />
          </Suspense>
        </div>
      )}

      {pastedFiles.length > 0 && (
        <div className="lazy-modal-wrapper">
          <Suspense fallback={<PasteConfirmationSkeleton />}>
            <PasteConfirmation
              files={pastedFiles}
              onConfirm={() => {
                handleFileUpload(pastedFiles);
                setPastedFiles([]);
              }}
              onCancel={() => setPastedFiles([])}
            />
          </Suspense>
        </div>
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
