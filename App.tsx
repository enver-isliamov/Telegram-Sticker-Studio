
import React, { useState, useCallback, ChangeEvent, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { ProcessedSticker, Sticker } from './types'; // types.ts обычно не требует .js, так как типы удаляются
import { ImageInput } from './components/ImageInput.js'; // Изменено на .js
import { StickerCard } from './components/StickerCard.js'; // Изменено на .js
import { Spinner } from './components/Spinner.js'; // Изменено на .js
import { processImageForSticker } from './utils/imageProcessor.js'; // Изменено на .js
import { useLanguage, Language } from './i18n.js'; // Изменено на .js

const LucideAlertTriangle = window.LucideIcons?.AlertTriangle || (({ className }) => React.createElement('span', { className }, '⚠️'));
const LucideImage = window.LucideIcons?.Image || (({ className }) => React.createElement('span', { className }, '🖼️'));
const LucideArchive = window.LucideIcons?.Archive || (({ className }) => React.createElement('span', { className }, '🗄️'));
const LucideLayers = window.LucideIcons?.Layers || (({ className }) => React.createElement('span', { className }, '겹'));
const LucideFileText = window.LucideIcons?.FileText || (({ className }) => React.createElement('span', { className }, '📄'));
const LucideWifiOff = window.LucideIcons?.WifiOff || (({ className }) => React.createElement('span', { className }, '🚫🌐'));
// const LucideClock = window.LucideIcons?.Clock || (({ className }) => React.createElement('span', { className }, '⏰')); // AI Queue UI removed


const App: React.FC = () => {
  const { t, setLanguage, language } = useLanguage();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [processingStatus, setProcessingStatus] = useState<{ [fileName: string]: string }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addOutline, setAddOutline] = useState<boolean>(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [keepOriginalFilenames, setKeepOriginalFilenames] = useState<boolean>(false);

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  
  const prefixCounterRef = useRef<number>(1);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const generateUniqueName = (baseNameWithExt: string, existingNames: Set<string>): string => {
    let finalName = baseNameWithExt;
    let count = 1;
    const lastDot = finalName.lastIndexOf('.');
    const baseNamePart = lastDot > -1 ? finalName.substring(0, lastDot) : finalName;
    const extension = lastDot > -1 ? finalName.substring(lastDot) : '';

    const cleanBaseNamePart = baseNamePart || "sticker";

    while (existingNames.has(finalName)) {
      finalName = `${cleanBaseNamePart}_${count}${extension}`;
      count++;
    }
    return finalName;
  };
  
  const sanitizeBaseName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
  }

  const handleFileSelection = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      setError(t('errorNoFilesSelected'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setStickers([]); 
    setProcessingStatus({});
    prefixCounterRef.current = 1; 

    const initialStatusUpdates: { [fileName: string]: string } = {};
    for (const file of Array.from(files)) {
      initialStatusUpdates[file.name] = t('statusQueued');
    }
    setProcessingStatus(initialStatusUpdates);
    
    let tempStickers: Sticker[] = [];
    const currentSuggestedNames = new Set<string>();

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setProcessingStatus(prev => ({ ...prev, [file.name]: t('statusSkippedNotImage') }));
        console.warn(`Skipping non-image file: ${file.name}`);
        continue;
      }
      
      setProcessingStatus(prev => ({ ...prev, [file.name]: t('statusProcessing') }));

      try {
        const processed: ProcessedSticker = await processImageForSticker(file, addOutline); 
        
        const originalFullBaseName = processed.filename.substring(0, processed.filename.lastIndexOf('.')) || processed.filename;
        const sanitizedOriginalBase = sanitizeBaseName(originalFullBaseName);
        const STICKER_EXTENSION = '.png';
        
        let finalNameToMakeUnique: string;
        const currentStickerId = `${file.name}-${Date.now()}`;

        if (keepOriginalFilenames) {
          finalNameToMakeUnique = sanitizedOriginalBase + STICKER_EXTENSION;
          setProcessingStatus(prev => ({ ...prev, [file.name]: t('statusUsingOriginalName') }));
        } else {
          const prefix = String(prefixCounterRef.current).padStart(3, '0');
          finalNameToMakeUnique = `${prefix}_${sanitizedOriginalBase}${STICKER_EXTENSION}`;
          prefixCounterRef.current++;
          setProcessingStatus(prev => ({ ...prev, [file.name]: t('statusUsingPrefixedName') }));
        }
        
        const uniqueNameWithExt = generateUniqueName(finalNameToMakeUnique, currentSuggestedNames);
        currentSuggestedNames.add(uniqueNameWithExt);
        
        const newSticker: Sticker = {
          id: currentStickerId,
          originalName: processed.filename, 
          suggestedName: uniqueNameWithExt, 
          dataUrl: processed.dataUrl,
          blob: processed.blob,
        };
        tempStickers.push(newSticker);
        setStickers([...tempStickers]);

      } catch (procError: any) {
        console.error(`Error processing ${file.name}:`, procError);
        const errorMessage = procError.message || t('errorProcessingFailed');
        setProcessingStatus(prev => ({ ...prev, [file.name]: t('statusErrorProcessing', { message: errorMessage }) }));
        setError(prevError => `${prevError ? prevError + '; ' : ''}${t('errorFailedToProcessFile', { fileName: file.name, message: errorMessage })}`);
      }
    }
    setIsLoading(false);
  }, [addOutline, keepOriginalFilenames, t]);


  const handleNameChange = (id: string, newNameWithExt: string) => {
    setStickers(prevStickers => {
      const otherStickerNames = new Set(
        prevStickers.filter(s => s.id !== id).map(s => s.suggestedName)
      );
      const uniqueNewName = generateUniqueName(newNameWithExt, otherStickerNames);

      return prevStickers.map(sticker =>
        sticker.id === id ? { ...sticker, suggestedName: uniqueNewName } : sticker
      );
    });
  };

  const handleDownloadAll = async (format: 'png' | 'webp') => {
    if (stickers.length === 0 || isBatchDownloading) return;
    setIsBatchDownloading(true);
    setError(null);

    const zip = new JSZip();
    const folderName = "TelegramStickers";
    const folder = zip.folder(folderName);
    if (!folder) {
        setError(t('errorZipFolder'));
        setIsBatchDownloading(false);
        return;
    }

    try {
      const downloadedFileNames = new Set<string>();

      if (format === 'png') {
        for (const sticker of stickers) {
          const finalFileName = generateUniqueName(sticker.suggestedName, downloadedFileNames);
          downloadedFileNames.add(finalFileName);
          folder.file(finalFileName, sticker.blob);
        }
      } else if (format === 'webp') {
        const conversionPromises = stickers.map(sticker => {
          return new Promise<{ name: string; blob: Blob }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error(t('errorCanvasContextWebP')));
              ctx.drawImage(img, 0, 0);
              canvas.toBlob(webpBlob => {
                if (webpBlob) {
                  const baseName = sticker.suggestedName.substring(0, sticker.suggestedName.lastIndexOf('.png'));
                  const webpFileName = generateUniqueName(`${baseName}.webp`, downloadedFileNames);
                  downloadedFileNames.add(webpFileName);
                  resolve({ name: webpFileName, blob: webpBlob });
                } else {
                  reject(new Error(t('errorConvertToWebP', { fileName: sticker.originalName })));
                }
              }, 'image/webp', 0.90);
            };
            img.onerror = () => reject(new Error(t('errorLoadImageWebP', {fileName: sticker.originalName})));
            img.src = sticker.dataUrl;
          });
        });
        const results = await Promise.all(conversionPromises);
        results.forEach(result => folder.file(result.name, result.blob));
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${folderName}_${format}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (err: any) {
      console.error("Error creating ZIP file:", err);
      setError(t('errorZipCreate', {message: err.message}));
    } finally {
      setIsBatchDownloading(false);
    }
  };
  
  const toggleLanguage = (lang: Language) => {
    setLanguage(lang);
  };

  const getStatusColor = (statusKey: string) => {
    const statusText = t(statusKey) || statusKey; 
    if (statusText.includes(t('statusErrorPrefix')) || statusText.includes(t('statusFailedPrefix'))) return 'text-red-400';
    if (statusText.includes(t('statusUsingOriginalName')) || statusText.includes(t('statusUsingPrefixedName'))) return 'text-green-400';
    if (statusText.includes(t('statusSkippedPrefix'))) return 'text-yellow-400';
    return 'text-sky-400';
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-100 p-4 sm:p-8 flex flex-col items-center selection:bg-sky-500 selection:text-white">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center z-50 flex items-center justify-center">
          <LucideWifiOff className="w-5 h-5 mr-2" />
          {t('offlineBannerGeneral')} 
        </div>
      )}
      <header className={`text-center mb-8 w-full max-w-4xl ${!isOnline ? 'mt-10' : ''}`}>
        <div className="flex justify-end space-x-2 mb-2">
            <button onClick={() => toggleLanguage('en')} className={`px-3 py-1 text-sm rounded-md ${language === 'en' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>EN</button>
            <button onClick={() => toggleLanguage('ru')} className={`px-3 py-1 text-sm rounded-md ${language === 'ru' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>RU</button>
            <button onClick={() => toggleLanguage('crh')} className={`px-3 py-1 text-sm rounded-md ${language === 'crh' ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>CT</button>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500">
          {t('appTitle')}
        </h1>
        <p className="text-slate-300 mt-2 text-lg">
          {t('appSubtitleNoAi')}
        </p>
      </header>

      <div className="w-full max-w-4xl bg-slate-800 bg-opacity-70 backdrop-blur-md shadow-2xl rounded-xl p-6 sm:p-8">
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-700/50 rounded-lg">
            <label htmlFor="outlineToggle" className="form-switch">
                <input 
                    type="checkbox" 
                    id="outlineToggle"
                    className="form-switch-input" 
                    checked={addOutline} 
                    onChange={(e) => setAddOutline(e.target.checked)}
                    disabled={isLoading || isBatchDownloading}
                />
                <span className="form-switch-toggler">
                    <span className="form-switch-toggler-knob"></span>
                </span>
                <span className="form-switch-label flex items-center">
                    <LucideLayers className="w-5 h-5 mr-2 text-sky-400" />
                    {t('addTelegramOutline')}
                </span>
            </label>
            <label htmlFor="originalFilenameToggle" className="form-switch">
                <input 
                    type="checkbox" 
                    id="originalFilenameToggle"
                    className="form-switch-input" 
                    checked={keepOriginalFilenames} 
                    onChange={(e) => setKeepOriginalFilenames(e.target.checked)}
                    disabled={isLoading || isBatchDownloading}
                />
                <span className="form-switch-toggler">
                    <span className="form-switch-toggler-knob"></span>
                </span>
                <span className="form-switch-label flex items-center">
                    <LucideFileText className="w-5 h-5 mr-2 text-teal-400" />
                    {t('keepOriginalFilenames')}
                </span>
            </label>
        </div>

        <ImageInput onChange={handleFileSelection} disabled={isLoading || isBatchDownloading} />
        
        {error && ( 
          <div className="mt-6 p-4 bg-red-500 bg-opacity-20 text-red-300 border border-red-500 rounded-lg flex items-start">
            <LucideAlertTriangle className="h-6 w-6 mr-3 text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold">{t('errorOccurred')}</h3>
              <p className="text-sm break-words">{error}</p>
            </div>
          </div>
        )}

        {(isLoading || isBatchDownloading) && (
          <div className="mt-8 flex flex-col items-center justify-center text-slate-300">
            <Spinner />
            <p className="mt-4 text-lg">
              {isLoading ? t('loadingProcessing') : t('loadingBatchDownload')}
            </p>
            {isLoading && (
              <div className="mt-4 text-sm w-full max-w-md text-left bg-slate-700 bg-opacity-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                {Object.entries(processingStatus).map(([fileName, statusKey]) => ( 
                  <div key={fileName} className="flex justify-between py-1 border-b border-slate-600 last:border-b-0">
                    <span className="truncate pr-2" title={fileName}>{fileName.length > 30 ? fileName.substring(0,27) + '...' : fileName}:</span>
                    <span className={`font-medium text-right flex-shrink-0 ${getStatusColor(statusKey)}`}>
                      {t(statusKey)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isLoading && !isBatchDownloading && stickers.length > 0 && (
          <div className="mt-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-slate-200 flex items-center mb-4 sm:mb-0">
                <LucideImage className="w-7 h-7 mr-3 text-sky-400" />
                {t('generatedStickersTitle', { count: stickers.length })}
                </h2>
                <div className="flex space-x-3">
                    <button
                        onClick={() => handleDownloadAll('png')}
                        disabled={isBatchDownloading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors duration-150 ease-in-out flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('downloadAllPngTitle')}
                    >
                        <LucideArchive className="w-5 h-5 mr-2" />
                        {t('downloadAllPngButton')}
                    </button>
                    <button
                        onClick={() => handleDownloadAll('webp')}
                        disabled={isBatchDownloading}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors duration-150 ease-in-out flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('downloadAllWebpTitle')}
                    >
                        <LucideArchive className="w-5 h-5 mr-2" />
                        {t('downloadAllWebpButton')}
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {stickers.map(sticker => (
                <StickerCard 
                  key={sticker.id} 
                  sticker={sticker} 
                  onNameChange={handleNameChange}
                  disabled={isLoading || isBatchDownloading}
                />
              ))}
            </div>
             <p className="mt-8 text-sm text-slate-400 text-center">
              {t('stickerResizeInfo')}{' '}
              {t('stickerOutlineInfo', { status: addOutline ? t('enabled') : t('disabled') })}.
              {' '}{t('stickerFileSizeInfo')}
            </p>
          </div>
        )}
        
        {!isLoading && !isBatchDownloading && stickers.length === 0 && !error && Object.keys(processingStatus).length > 0 && !Object.values(processingStatus).some(sKey => t(sKey).startsWith(t('statusProcessingPrefix')) || t(sKey) === t('statusQueued')) && (
             <div className="mt-8 text-center text-slate-400 p-6 bg-slate-700 bg-opacity-40 rounded-lg">
                <h3 className="text-xl font-semibold text-slate-200 mb-2">{t('processingCompleteTitle')}</h3>
                <p>{t('processingCompleteNoStickers')}</p>
                <p className="mt-1">{t('processingCompleteHint')}</p>
             </div>
        )}
      </div>

      <footer className="mt-12 text-center text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} {t('appTitleShort')}. {t('poweredBy')}</p>
        <p className="mt-1">{t('footerPrivacyInfo')}</p>
      </footer>
    </div>
  );
};

export default App;
